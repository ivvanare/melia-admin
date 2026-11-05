import { Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { AuthService } from '../../core/auth.service';
import { DataTable, type DataTableColumn } from '../../shared/data-table/data-table';
import { DialogShell } from '../../shared/dialog-shell/dialog-shell';
import {
  PlacesStore,
  type Place,
  type PlacePatch,
  type PlaceSocial,
  type PlaceStatus,
} from './places.store';

/** Page size the chosen direction accepts: fewer venues, more identity per card. */
const PAGE_SIZE = 6;

const MAX_DESCRIPTION = 600;

type View = 'cards' | 'table';

/**
 * The dialog's working copy. Kept separate from the stored venue so cancelling leaves no
 * half-applied edit behind, and so a rejected save can keep what was typed.
 */
interface Draft {
  name: string;
  title: string;
  description: string;
  category: string;
  status: PlaceStatus;
  address: string;
  latitude: string;
  longitude: string;
  instagram: string;
  web: string;
  owner_id: string;
}

/**
 * Places screen (T9), on the `03-card-grid-dialog` artboard: a card grid that reads like the
 * app's own catalogue, and a two-column dialog — the same ng-zorro dialog idiom the Users and
 * Roles screens already use.
 *
 * Two sessions share this one screen. What an owner may do is decided *before* rendering:
 * `place.delete` marks a platform session (the catalogue has no `place.assign` yet, so
 * reassignment rides on it until T7 adds the code), and `place.create` decides whether the
 * creation button exists at all. The list narrows by `owner.id`, which is the same boundary
 * the API will apply in T2 — the screen never claims authority the server does not grant.
 */
@Component({
  selector: 'app-places',
  imports: [NzButtonModule, NzModalModule, DataTable, DialogShell],
  templateUrl: './places.html',
  styleUrl: './places.css',
})
export class Places {
  private readonly auth = inject(AuthService);
  private readonly store = inject(PlacesStore);

  protected readonly places = this.store.places;
  protected readonly owners = this.store.owners;

  protected readonly search = signal('');
  protected readonly category = signal<string | null>(null);
  protected readonly onlyUnowned = signal(false);
  protected readonly view = signal<View>('cards');
  protected readonly page = signal(1);

  /** A platform session sees and edits every venue; an owner sees only what is theirs. */
  protected readonly isPlatform = computed(() =>
    this.auth.permissions().includes('place.delete'),
  );
  protected readonly canCreate = computed(() => this.auth.permissions().includes('place.create'));

  private readonly mine = computed(() => {
    const userId = this.auth.user()?.id;
    return this.places().filter((place) => place.owner?.id === userId);
  });

  protected readonly categories = computed(() => {
    const seen = new Set<string>();
    for (const place of this.scope()) seen.add(place.category);
    return [...seen].sort((a, b) => a.localeCompare(b));
  });

  /** Everything this session may list, before the toolbar narrows it further. */
  private readonly scope = computed(() => (this.isPlatform() ? this.places() : this.mine()));

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const category = this.category();
    const unowned = this.onlyUnowned() && this.isPlatform();

    return this.scope()
      .filter((place) => {
        if (category && place.category !== category) return false;
        if (unowned && place.owner !== null) return false;
        if (term === '') return true;
        return [place.title, place.name, place.category, place.address ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  });

  protected readonly total = computed(() => this.filtered().length);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected readonly paged = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  /** Text columns keep the base table reusable; the card view retains the richer status tag. */
  protected readonly tableColumns: readonly DataTableColumn<Place>[] = [
    { label: 'Title', value: (place) => place.title },
    { label: 'Category', value: (place) => place.category },
    { label: 'Address', value: (place) => place.address ?? '—', variant: 'muted' },
    { label: 'Owner', value: (place) => place.owner?.email ?? 'platform', variant: 'mono' },
    { label: 'Status', value: (place) => place.status },
  ];

  /** `1–6 de 9`: a range, so an empty list and a full last page both read honestly. */
  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return '0 of 0';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    const end = Math.min(this.page() * PAGE_SIZE, total);
    return `${start}–${end} of ${total}`;
  });

  protected readonly subtitle = computed(() => {
    const total = this.total();
    return this.isPlatform()
      ? `${total} ${total === 1 ? 'venue' : 'venues'} · every venue, with its owner`
      : `${total} ${total === 1 ? 'venue' : 'venues'} · edit your own records; creating and deleting belong to the platform`;
  });

  // ---- dialog state -------------------------------------------------------

  protected readonly open = signal(false);
  protected readonly editing = signal<Place | null>(null);
  protected readonly draft = signal<Draft>(emptyDraft());
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly saving = signal(false);
  protected readonly saveErrorCode = signal<string | null>(null);

  /** The dialog names one venue: the notice above the form says which session is editing it. */
  protected readonly editingIsMine = computed(() => {
    const place = this.editing();
    const userId = this.auth.user()?.id;
    return place !== null && place.owner?.id === userId;
  });

  /** The shell takes text here so the modal's lead cannot become another markup escape hatch. */
  protected readonly editingLead = computed(() => {
    const place = this.editing();
    if (!place) return '';
    const suffix = this.editingIsMine()
      ? ' · your venue'
      : this.isPlatform()
        ? ` · ${place.owner?.email ?? 'curated by the platform'}`
        : '';
    return `${place.id} · ${place.category}${suffix}`;
  });

  protected onSearch(value: string): void {
    this.search.set(value);
    // A narrowed list must not stay on a page that no longer exists.
    this.page.set(1);
  }

  protected onCategory(value: string | null): void {
    this.category.set(value);
    this.page.set(1);
  }

  protected toggleUnowned(): void {
    this.onlyUnowned.update((value) => !value);
    this.page.set(1);
  }

  protected setView(view: View): void {
    this.view.set(view);
  }

  protected previous(): void {
    this.page.update((page) => Math.max(1, page - 1));
  }

  protected next(): void {
    this.page.update((page) => Math.min(this.pageCount(), page + 1));
  }

  protected openEditor(place: Place): void {
    this.editing.set(place);
    this.draft.set({
      name: place.name,
      title: place.title,
      description: place.description ?? '',
      category: place.category,
      status: place.status,
      address: place.address ?? '',
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      instagram: place.social.instagram ?? '',
      web: place.social.web ?? '',
      owner_id: place.owner?.id ?? '',
    });
    this.errors.set([]);
    this.saveErrorCode.set(null);
    this.open.set(true);
  }

  protected closeEditor(): void {
    this.open.set(false);
    this.editing.set(null);
    this.errors.set([]);
    this.saveErrorCode.set(null);
  }

  /** One field setter keeps the template free of `$event` plumbing. */
  protected patch(field: keyof Draft, value: string): void {
    this.draft.update((draft) => ({ ...draft, [field]: value }));
  }

  protected async save(): Promise<void> {
    const place = this.editing();
    if (!place || this.saving()) return;

    const draft = this.draft();
    const errors = validate(draft);
    this.errors.set(errors);
    if (errors.length > 0) {
      // Stay open: closing would discard what the person typed.
      this.saveErrorCode.set(null);
      return;
    }

    this.saving.set(true);
    this.saveErrorCode.set(null);
    try {
      await this.store.update(place.id, toPatch(draft, this.isPlatform()));
      this.closeEditor();
    } catch (error) {
      this.saveErrorCode.set(error instanceof Error ? error.message : 'unknown_error');
    } finally {
      this.saving.set(false);
    }
  }

  protected updatedLabel(place: Place): string {
    const when = new Date(place.updated_at);
    const stamp = Number.isNaN(when.getTime())
      ? place.updated_at
      : when.toISOString().slice(0, 10);
    return place.updated_by ? `${stamp} · ${place.updated_by}` : stamp;
  }
}

function emptyDraft(): Draft {
  return {
    name: '',
    title: '',
    description: '',
    category: '',
    status: 'ACTIVE',
    address: '',
    latitude: '',
    longitude: '',
    instagram: '',
    web: '',
    owner_id: '',
  };
}

/**
 * The same rules the database enforces (`nu_latitude`/`nu_longitude` checks in
 * `04-core-tables.sql`), checked here so the dialog answers before a round trip.
 */
function validate(draft: Draft): readonly string[] {
  const errors: string[] = [];
  if (draft.title.trim() === '') {
    errors.push('The commercial title is required (title).');
  }
  if (draft.name.trim() === '') {
    errors.push('The real or legal name is required (name).');
  }
  if (Number.isNaN(Number(draft.latitude)) || Number(draft.latitude) < -90 || Number(draft.latitude) > 90) {
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

/** Empty text becomes `null`, never `''`: the column is nullable and the API distinguishes them. */
function toPatch(draft: Draft, platform: boolean): PlacePatch {
  const social: PlaceSocial = {};
  if (draft.instagram.trim() !== '') social.instagram = draft.instagram.trim();
  if (draft.web.trim() !== '') social.web = draft.web.trim();

  const patch: PlacePatch = {
    name: draft.name.trim(),
    title: draft.title.trim(),
    description: draft.description.trim() === '' ? null : draft.description.trim(),
    category: draft.category.trim(),
    address: draft.address.trim() === '' ? null : draft.address.trim(),
    latitude: Number(draft.latitude),
    longitude: Number(draft.longitude),
    social,
  };

  // Ownership and status are platform-only: an owner session has no control for either, so
  // sending them would be a capability the UI pretends not to have.
  if (platform) {
    patch.status = draft.status;
    patch.owner_id = draft.owner_id === '' ? null : draft.owner_id;
  }
  return patch;
}

export { PAGE_SIZE, MAX_DESCRIPTION };
