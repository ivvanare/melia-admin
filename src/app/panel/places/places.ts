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
  type PlaceSchedule,
  type PlaceAttribute,
  type PlaceMenu,
  type PlaceMenuItem,
  type PlacePhoto,
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

/** One editable day. `enabled` false means "closed that day", which is expressed by omission. */
interface DayDraft {
  dayOfWeek: number;
  enabled: boolean;
  open: string;
  close: string;
}

const DAYS: readonly string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
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

function emptyWeek(): DayDraft[] {
  return DAYS.map((_, index) => ({
    dayOfWeek: index + 1,
    enabled: false,
    open: '09:00',
    close: '18:00',
  }));
}

/** A stored set becomes a full week: a missing day is a closed day, and the form must say so. */
function weekFrom(schedules: readonly PlaceSchedule[]): DayDraft[] {
  return emptyWeek().map((day) => {
    const stored = schedules.find((slot) => slot.dayOfWeek === day.dayOfWeek);
    return stored
      ? { ...day, enabled: true, open: stored.open.slice(0, 5), close: stored.close.slice(0, 5) }
      : day;
  });
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
  protected readonly categoryFilter = signal('');
  protected readonly listStatuses = LIST_STATUSES;

  protected readonly view = signal<'cards' | 'table'>('cards');

  protected readonly days = DAYS;
  protected readonly week = signal<readonly DayDraft[]>(emptyWeek());
  protected readonly schedulesLoading = signal(false);

  /** The attribute vocabulary and the codes on this place. */
  protected readonly attributes = signal<readonly PlaceAttribute[]>([]);
  protected readonly draftCodes = signal<readonly string[]>([]);

  /** The menu being edited: sections, each with its dishes. Sent whole on save. */
  protected readonly menus = signal<readonly PlaceMenu[]>([]);

  /** The place's photos, read with the rest of its detail. */
  protected readonly photos = signal<readonly PlacePhoto[]>([]);
  protected readonly uploading = signal(false);
  protected readonly photoErrorCode = signal<string | null>(null);

  /** 5 MB is the server's limit; refusing earlier gives the same answer without the upload. */
  private readonly maxPhotoBytes = 5 * 1024 * 1024;
  private readonly allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];

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
    void this.loadAttributes();
  }

  private async loadAttributes(): Promise<void> {
    try {
      this.attributes.set(await this.api.listPlaceAttributes('ACTIVE'));
    } catch {
      // No vocabulary, no checkboxes: leaving them empty is honest, inventing codes is not.
      this.attributes.set([]);
    }
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
        categoryId: this.categoryFilter() || null,
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
    this.draftCodes.set([]);
    this.menus.set([]);
    this.photos.set([]);
    this.photoErrorCode.set(null);
    this.errors.set([]);
    this.saveErrorCode.set(null);
    this.editorOpen.set(true);
  }

  protected openEditor(place: AdminPlace): void {
    this.editing.set(place);
    this.draft.set(draftFrom(place));
    this.week.set(emptyWeek());
    this.draftCodes.set([]);
    this.menus.set([]);
    this.photos.set([]);
    this.photoErrorCode.set(null);
    this.errors.set([]);
    this.saveErrorCode.set(null);
    this.editorOpen.set(true);
    void this.loadDetail(place.coPlace);
  }

  /**
   * One read fills the whole dialog: the place detail carries its schedules, attribute codes, menu
   * and photos. Asking four endpoints for the same row would be four chances to show a half-loaded
   * form, and one of them — the gallery — had no route of its own at all.
   */
  private async loadDetail(coPlace: string): Promise<void> {
    this.schedulesLoading.set(true);
    try {
      const place = await this.api.getAdminPlace(coPlace);
      this.week.set(weekFrom(place.schedules));
      this.draftCodes.set(place.attributes);
      this.menus.set(place.menus);
      this.photos.set(place.photos);
    } catch {
      // A failed read must not turn into "this place is closed all week and has no photos":
      // the editor stays empty and says so instead of saving over data it never saw.
      this.week.set(emptyWeek());
      this.errors.set(['The place detail could not be loaded, so its content was left untouched.']);
    } finally {
      this.schedulesLoading.set(false);
    }
  }

  /**
   * Uploads one file. The client refuses what the server would refuse anyway — size and declared
   * type — because a 5 MB round trip to learn "too big" is a waste of the operator's time. The server
   * still sniffs the bytes, so the declared type is a courtesy, not a guarantee.
   */
  protected async uploadPhoto(file: File, type: 'COVER' | 'GALLERY'): Promise<void> {
    const place = this.editing();
    if (!place || this.uploading()) return;

    this.photoErrorCode.set(null);
    if (file.size > this.maxPhotoBytes) {
      this.photoErrorCode.set('too_long');
      return;
    }
    if (!this.allowedPhotoTypes.includes(file.type)) {
      this.photoErrorCode.set('invalid_type');
      return;
    }

    this.uploading.set(true);
    try {
      // A gallery photo goes last; a cover always sits at the front. Reordering existing photos
      // still needs the bulk PUT the API has not shipped yet.
      const order =
        type === 'COVER'
          ? 0
          : this.photos().reduce((max, photo) => Math.max(max, photo.order), -1) + 1;
      const photo = await this.api.uploadPlacePhoto(place.coPlace, file, type, order);
      // A new cover replaces the old one server-side, so the list has to agree.
      this.photos.update((photos) =>
        type === 'COVER'
          ? [...photos.filter((p) => p.type !== 'COVER'), photo]
          : [...photos, photo],
      );
    } catch (error) {
      this.photoErrorCode.set(apiErrorCode(error));
    } finally {
      this.uploading.set(false);
    }
  }

  protected photoSrc(photo: PlacePhoto): string {
    return this.api.photoUrl(photo.url);
  }

  protected async removePhoto(photo: PlacePhoto): Promise<void> {
    const place = this.editing();
    if (!place || this.uploading()) return;
    this.photoErrorCode.set(null);
    this.uploading.set(true);
    try {
      await this.api.deletePlacePhoto(place.coPlace, photo.coPhoto);
      this.photos.update((photos) => photos.filter((p) => p.coPhoto !== photo.coPhoto));
    } catch (error) {
      this.photoErrorCode.set(apiErrorCode(error));
    } finally {
      this.uploading.set(false);
    }
  }

  protected onPhotoPicked(event: Event, type: 'COVER' | 'GALLERY'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.uploadPhoto(file, type);
  }

  protected toggleCode(code: string): void {
    const current = this.draftCodes();
    this.draftCodes.set(
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  protected isCodeOn(code: string): boolean {
    return this.draftCodes().includes(code);
  }

  // ---- menu editing -------------------------------------------------------

  protected addSection(): void {
    this.menus.update((menus) => [...menus, { name: '', description: null, items: [] }]);
  }

  protected removeSection(index: number): void {
    this.menus.update((menus) => menus.filter((_, i) => i !== index));
  }

  protected patchSection(index: number, field: 'name' | 'description', value: string): void {
    this.menus.update((menus) =>
      menus.map((menu, i) =>
        i === index ? { ...menu, [field]: value === '' ? (field === 'description' ? null : '') : value } : menu,
      ),
    );
  }

  protected addItem(section: number): void {
    this.menus.update((menus) =>
      menus.map((menu, i) =>
        i === section
          ? { ...menu, items: [...menu.items, { name: '', description: null, price: 0, currency: 'USD' }] }
          : menu,
      ),
    );
  }

  protected removeItem(section: number, item: number): void {
    this.menus.update((menus) =>
      menus.map((menu, i) =>
        i === section ? { ...menu, items: menu.items.filter((_, j) => j !== item) } : menu,
      ),
    );
  }

  protected patchItem<K extends keyof PlaceMenuItem>(
    section: number,
    item: number,
    field: K,
    value: PlaceMenuItem[K],
  ): void {
    this.menus.update((menus) =>
      menus.map((menu, i) =>
        i === section
          ? {
              ...menu,
              items: menu.items.map((dish, j) => (j === item ? { ...dish, [field]: value } : dish)),
            }
          : menu,
      ),
    );
  }

  protected patchDay(dayOfWeek: number, field: 'enabled' | 'open' | 'close', value: boolean | string): void {
    this.week.update((week) =>
      week.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, [field]: value } : day)),
    );
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
    const week = this.week();
    const errors = [...validate(draft), ...validateWeek(week), ...validateMenus(this.menus())];
    this.errors.set(errors);
    if (errors.length > 0) return;

    this.saving.set(true);
    this.saveErrorCode.set(null);
    const editing = this.editing();
    try {
      const body = toWrite(draft, this.canManageAll());
      let coPlace = editing?.coPlace ?? '';
      if (editing) {
        await this.api.updateAdminPlace(editing.coPlace, body);
      } else {
        coPlace = (await this.api.createAdminPlace(body)).coPlace;
      }
      await this.api.replacePlaceAttributes(coPlace, [...this.draftCodes()]);
      await this.api.replacePlaceMenu(coPlace, [...this.menus()]);
      // The whole set travels: a day left disabled is a day the venue is closed.
      const defined = week.filter((day) => day.enabled);
      if (defined.length > 0 || editing) {
        await this.api.replacePlaceSchedules(
          coPlace,
          defined.map((day) => ({ dayOfWeek: day.dayOfWeek, open: day.open, close: day.close })),
        );
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

/**
 * Equal hours are rejected: the pair would read as "closed all day" or "open all day" depending on
 * who asks. A `close` earlier than `open` is *not* an error — it is how a night that crosses
 * midnight is written.
 */
function validateWeek(week: readonly DayDraft[]): readonly string[] {
  const errors: string[] = [];
  for (const day of week) {
    if (!day.enabled) continue;
    if (day.open === day.close) {
      errors.push(`${DAYS[day.dayOfWeek - 1]}: opening and closing cannot be the same time.`);
    }
  }
  return errors;
}

/**
 * A section with no dishes is legal — a menu that exists but is not filled in yet — so only the
 * things a dish cannot do without are refused: a name, a non-negative price and a currency.
 */
function validateMenus(menus: readonly PlaceMenu[]): readonly string[] {
  const errors: string[] = [];
  menus.forEach((menu, index) => {
    if (menu.name.trim() === '') {
      errors.push(`Menu ${index + 1}: a section needs a name.`);
    }
    menu.items.forEach((dish, position) => {
      const where = `Menu ${index + 1}, dish ${position + 1}`;
      if (dish.name.trim() === '') errors.push(`${where}: a name is required.`);
      if (Number.isNaN(dish.price) || dish.price < 0) errors.push(`${where}: the price must be zero or more.`);
      if (dish.currency.trim() === '') errors.push(`${where}: a currency is required.`);
    });
  });
  return errors;
}
