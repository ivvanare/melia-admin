import { Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import {
  AdminApi,
  type AdminPlace,
  type AdminPlaceListStatus,
  type AdminPlaceStatus,
  type AdminPlaceWrite,
  type PlaceCategory,
} from '../../core/admin-api';
import { apiErrorCode } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { DataTable, type DataTableColumn, type DataTableTagVariant } from '../../shared/data-table/data-table';
import { DialogShell } from '../../shared/dialog-shell/dialog-shell';

/** Six per page is the density the chosen artboard accepts. */
const PAGE_SIZE = 6;
const MAX_DESCRIPTION = 2000;

const STATUS_TAG: Record<AdminPlaceStatus, DataTableTagVariant> = {
  ACTIVE: 'ok',
  INACTIVE: 'neutral',
  SUSPENDED: 'warn',
};

/** The listing filter: `DELETED` is not a place status, it selects the logically retired rows. */
const LIST_STATUSES: readonly { value: string; label: string }[] = [
  { value: '', label: 'Live catalogue' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'INACTIVE', label: 'INACTIVE' },
  { value: 'DELETED', label: 'DELETED (retired)' },
];

interface Draft {
  name: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  country: string;
  region: string;
  timezone: string;
  latitude: string;
  longitude: string;
  address: string;
  status: AdminPlaceStatus;
  ownerId: string;
}

function emptyDraft(): Draft {
  return {
    name: '',
    title: '',
    description: '',
    categoryId: '',
    categoryName: '',
    country: 'VE',
    region: '',
    timezone: 'America/Caracas',
    latitude: '',
    longitude: '',
    address: '',
    status: 'ACTIVE',
    ownerId: '',
  };
}

function draftFrom(place: AdminPlace): Draft {
  return {
    name: place.name,
    title: place.title,
    description: place.description ?? '',
    categoryId: place.category.id,
    categoryName: place.category.name,
    country: place.country,
    region: place.region ?? '',
    timezone: place.timezone,
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    address: place.address ?? '',
    status: place.status,
    ownerId: place.coOwnerUser ?? '',
  };
}

/**
 * Places backoffice (T9), on the `03-card-grid-dialog` artboard.
 *
 * The server owns scope: with `place.manage_all` the listing is the whole catalogue, without it only
 * the caller's own rows. So this screen never filters by ownership — doing that again here would be a
 * second, silently divergent copy of an authorization rule.
 *
 * Two permissions shape the UI: `place.manage_all` adds creation, owner reassignment and the status
 * control; `place.delete` adds the retirement action. `coOwnerUser` is only sent with
 * `place.manage_all`, because the API ignores it silently rather than refusing it.
 */
@Component({
  selector: 'app-places',
  imports: [DataTable, DialogShell, NzButtonModule, NzModalModule],
  templateUrl: './places.html',
  styleUrl: './places.css',
})
export class Places {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);

  protected readonly rows = signal<readonly AdminPlace[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly listErrorCode = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly countryFilter = signal('');
  protected readonly regionFilter = signal('');
  protected readonly listStatuses = LIST_STATUSES;

  protected readonly view = signal<'cards' | 'table'>('cards');

  /** The active taxonomy: the form offers a select instead of asking for a uuid. */
  protected readonly categories = signal<readonly PlaceCategory[]>([]);

  protected readonly canManageAll = computed(() =>
    this.auth.permissions().includes('place.manage_all'),
  );
  protected readonly canDelete = computed(() => this.auth.permissions().includes('place.delete'));

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return '0 of 0';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    return `${start}–${Math.min(this.page() * PAGE_SIZE, total)} of ${total}`;
  });

  protected readonly subtitle = computed(() => {
    const total = this.total();
    return this.canManageAll()
      ? `${total} ${total === 1 ? 'venue' : 'venues'} · whole catalogue, owner included`
      : `${total} ${total === 1 ? 'venue' : 'venues'} · the server scopes this to your places`;
  });

  protected readonly emptyLabel = computed(() =>
    this.loading() ? 'Loading places…' : 'No place matches these filters.',
  );

  /** The owner column exists only where the session can act on it. */
  protected readonly columns = computed<readonly DataTableColumn<AdminPlace>[]>(() => {
    const base: DataTableColumn<AdminPlace>[] = [
      { label: 'Title', value: (row) => row.title },
      { label: 'Category', value: (row) => row.category.name },
      { label: 'Where', value: (row) => [row.region, row.country].filter(Boolean).join(', ') || row.country },
      { label: 'Status', tag: (row) => ({ label: row.status, variant: STATUS_TAG[row.status] }) },
      { label: 'Updated', value: (row) => row.updatedAt.slice(0, 10), variant: 'muted' },
    ];
    return this.canManageAll()
      ? [
          ...base,
          {
            label: 'Owner',
            value: (row) => row.coOwnerUser ?? 'curated by the platform',
            variant: 'mono',
          },
        ]
      : base;
  });

  // ---- editor -------------------------------------------------------------

  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<AdminPlace | null>(null);
  protected readonly draft = signal<Draft>(emptyDraft());
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly saving = signal(false);
  protected readonly saveErrorCode = signal<string | null>(null);

  // ---- retirement ---------------------------------------------------------

  protected readonly deleteTarget = signal<AdminPlace | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteErrorCode = signal<string | null>(null);

  constructor() {
    void this.load();
    void this.loadCategories();
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categories.set(await this.api.listPlaceCategories('ACTIVE'));
    } catch {
      // Without the catalogue the select falls back to the place's own category, so editing still
      // works; creating a place keeps the field disabled rather than offering a made-up id.
      this.categories.set([]);
    }
  }

  /**
   * A place may sit in a category that has since been deactivated. Dropping it from the options
   * would silently move the place on the next save, so the current one is kept and marked.
   */
  protected categoryOptions = computed(() => {
    const draft = this.draft();
    const options = this.categories().map((category) => ({
      id: category.coPlaceCategory,
      label: `${category.name} (${category.code})`,
    }));
    if (draft.categoryId !== '' && !options.some((option) => option.id === draft.categoryId)) {
      options.unshift({
        id: draft.categoryId,
        label: `${draft.categoryName || 'Current category'} (inactive)`,
      });
    }
    return options;
  });

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.listErrorCode.set(null);
    try {
      const result = await this.api.listAdminPlaces({
        page: this.page(),
        limit: PAGE_SIZE,
        q: this.search().trim() || null,
        status: (this.statusFilter() as AdminPlaceListStatus | '') || null,
        country: this.countryFilter().trim() || null,
        region: this.regionFilter().trim() || null,
      });
      this.rows.set(result.data);
      this.total.set(result.total);
    } catch (error) {
      this.listErrorCode.set(apiErrorCode(error));
      this.rows.set([]);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  protected apply(): void {
    this.page.set(1);
    void this.load();
  }

  protected previous(): void {
    if (this.page() === 1) return;
    this.page.update((page) => page - 1);
    void this.load();
  }

  protected next(): void {
    if (this.page() >= this.pageCount()) return;
    this.page.update((page) => page + 1);
    void this.load();
  }

  protected setView(view: 'cards' | 'table'): void {
    this.view.set(view);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.draft.set(emptyDraft());
    this.errors.set([]);
    this.saveErrorCode.set(null);
    this.editorOpen.set(true);
  }

  protected openEditor(place: AdminPlace): void {
    this.editing.set(place);
    this.draft.set(draftFrom(place));
    this.errors.set([]);
    this.saveErrorCode.set(null);
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
    this.editing.set(null);
    this.errors.set([]);
    this.saveErrorCode.set(null);
  }

  protected patch(field: keyof Draft, value: string): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    const draft = this.draft();
    const errors = validate(draft);
    this.errors.set(errors);
    if (errors.length > 0) return;

    this.saving.set(true);
    this.saveErrorCode.set(null);
    const editing = this.editing();
    try {
      const body = toWrite(draft, this.canManageAll());
      if (editing) {
        await this.api.updateAdminPlace(editing.coPlace, body);
      } else {
        await this.api.createAdminPlace(body);
      }
      await this.load();
      this.closeEditor();
    } catch (error) {
      // Stay open: closing would discard the form and hide the reason.
      this.saveErrorCode.set(apiErrorCode(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected askDelete(place: AdminPlace): void {
    this.deleteErrorCode.set(null);
    this.deleteTarget.set(place);
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteErrorCode.set(null);
  }

  /**
   * Logical retirement: the row stays and leaves discovery, reviews and check-ins, which is why
   * the confirmation says "retire" rather than promising the data is gone.
   */
  protected async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target || this.deleting()) return;
    this.deleting.set(true);
    this.deleteErrorCode.set(null);
    try {
      await this.api.deleteAdminPlace(target.coPlace);
      await this.load();
      this.closeEditor();
      this.cancelDelete();
    } catch (error) {
      this.deleteErrorCode.set(apiErrorCode(error));
    } finally {
      this.deleting.set(false);
    }
  }

  /** A `404` is deliberate: it means the row does not exist *or* is not yours. */
  protected saveErrorMessage(code: string): string {
    return code === 'not_found'
      ? 'That place does not exist or is not yours.'
      : `The place was not saved: ${code}`;
  }

  protected updatedLabel(place: AdminPlace): string {
    return place.updatedAt.slice(0, 10);
  }

  protected ownerLabel(place: AdminPlace): string {
    return place.coOwnerUser ?? 'curated by the platform';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validate(draft: Draft): readonly string[] {
  const errors: string[] = [];
  if (draft.title.trim() === '') errors.push('The commercial title is required (title).');
  if (draft.name.trim() === '') errors.push('The real or legal name is required (name).');
  if (draft.timezone.trim() === '') errors.push('A timezone is required.');
  if (!/^[A-Z]{2}$/.test(draft.country.trim())) {
    errors.push('Country must be two uppercase letters, like VE.');
  }
  if (draft.categoryId.trim() !== '' && !UUID.test(draft.categoryId.trim())) {
    errors.push('The category id must be a uuid.');
  }
  if (
    Number.isNaN(Number(draft.latitude)) ||
    Number(draft.latitude) < -90 ||
    Number(draft.latitude) > 90
  ) {
    errors.push('Latitude must be a number between -90 and 90.');
  }
  if (
    Number.isNaN(Number(draft.longitude)) ||
    Number(draft.longitude) < -180 ||
    Number(draft.longitude) > 180
  ) {
    errors.push('Longitude must be a number between -180 and 180.');
  }
  if (draft.description.length > MAX_DESCRIPTION) {
    errors.push(`The description cannot exceed ${MAX_DESCRIPTION} characters.`);
  }
  return errors;
}

/**
 * Empty text becomes `null` where the column is nullable, so a cleared field actually clears it.
 * `coOwnerUser` and `status` travel only for a session that may manage the catalogue.
 */
function toWrite(draft: Draft, manageAll: boolean): AdminPlaceWrite {
  const body: AdminPlaceWrite = {
    name: draft.name.trim(),
    title: draft.title.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    country: draft.country.trim().toUpperCase(),
    region: draft.region.trim() === '' ? null : draft.region.trim(),
    timezone: draft.timezone.trim(),
    latitude: Number(draft.latitude),
    longitude: Number(draft.longitude),
    address: draft.address.trim() === '' ? null : draft.address.trim(),
  };

  if (draft.categoryId.trim() !== '') body.coPlaceCategory = draft.categoryId.trim();
  if (manageAll) {
    body.status = draft.status;
    body.coOwnerUser = draft.ownerId === '' ? null : draft.ownerId;
  }
  return body;
}
