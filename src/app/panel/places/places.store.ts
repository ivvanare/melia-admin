import { Injectable, signal } from '@angular/core';

/**
 * Local administration placeholder. `GET /v1/admin/places` does not exist yet (T1-T3 in
 * `odd/tasks/place-ownership.md` are `melia` work), so this store answers from memory with
 * the payload shape those tasks will serve: an owner object, never a bare id, so the screen
 * never has to resolve a second request per card.
 *
 * When T1-T7 land, this class is the only thing replaced: the screen reads a signal and
 * calls `update`, which is exactly what an HTTP client would expose.
 */
export type PlaceStatus = 'ACTIVE' | 'SUSPENDED';

/** `place.owner` is nullable on purpose: a place curated by the platform has no owner. */
export interface PlaceOwner {
  id: string;
  name: string | null;
  email: string | null;
}

export interface PlaceSocial {
  instagram?: string;
  web?: string;
}

export interface Place {
  id: string;
  /** Real or legal name; not what the app shows. */
  name: string;
  /** Commercial title: the name the app's user reads. */
  title: string;
  description: string | null;
  category: string;
  address: string | null;
  latitude: number;
  longitude: number;
  social: PlaceSocial;
  status: PlaceStatus;
  owner: PlaceOwner | null;
  /** Caption of the cover photo. Uploads need the API, so the card renders a placeholder. */
  cover: string | null;
  updated_at: string;
  updated_by: string | null;
}

/** What an administrator can change. `owner_id` is separate: it is a reassignment, not an edit. */
export interface PlacePatch {
  name?: string;
  title?: string;
  description?: string | null;
  category?: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  social?: PlaceSocial;
  status?: PlaceStatus;
  owner_id?: string | null;
}

const OWNERS: readonly PlaceOwner[] = [
  { id: 'u-ana', name: 'Ana Rondón', email: 'ana@melia.test' },
  { id: 'u-luis', name: 'Luis Marín', email: 'luis@miramar.test' },
];

const OWNER_BY_ID = new Map(OWNERS.map((owner) => [owner.id, owner]));

/**
 * Nine venues: four owned by `u-ana`, one by another owner, four curated by the platform.
 * The array is ordered newest-first and the screen sorts by `updated_at`, so the first card
 * is `PLACE_SEED[0]` while the platform-curated venues spill onto the second page.
 */
export const PLACE_SEED: readonly Place[] = [
  {
    id: 'pl-melia-centro',
    name: 'Inversiones Melia C.A.',
    title: 'Melia Centro',
    description:
      'Hotel boutique en el centro de la ciudad. Desayuno incluido, terraza con vista y estacionamiento propio. A dos cuadras de la plaza Bolívar.',
    category: 'Hotel',
    address: 'Av. Bolívar 45, Melia',
    latitude: 10.480594,
    longitude: -66.903606,
    social: { instagram: '@meliacentro', web: 'melia.test' },
    status: 'ACTIVE',
    owner: OWNER_BY_ID.get('u-ana')!,
    cover: 'fachada.jpg',
    updated_at: '2026-11-01T09:40:00Z',
    updated_by: 'Ana Rondón',
  },
  {
    id: 'pl-melia-terraza',
    name: 'Café La Terraza C.A.',
    title: 'Melia La Terraza',
    description: 'Café de especialidad con vista al parque. Abre todos los días, también feriados.',
    category: 'Café',
    address: 'Calle 8 con 5, Melia',
    latitude: 10.4912,
    longitude: -66.8831,
    social: { instagram: '@laterrazacafe' },
    status: 'ACTIVE',
    owner: OWNER_BY_ID.get('u-ana')!,
    cover: 'terraza.jpg',
    updated_at: '2026-10-31T15:10:00Z',
    updated_by: 'Ana Rondón',
  },
  {
    id: 'pl-los-nogales',
    name: 'Areperas Los Nogales C.A.',
    title: 'Arepera Los Nogales',
    description: null,
    category: 'Arepera',
    address: 'Carrera 19 #4-2, Melia',
    latitude: 10.4711,
    longitude: -66.9102,
    social: {},
    status: 'SUSPENDED',
    owner: OWNER_BY_ID.get('u-ana')!,
    cover: null,
    updated_at: '2026-10-24T11:00:00Z',
    updated_by: 'Ana Rondón',
  },
  {
    id: 'pl-mirador',
    name: 'Mirador del Valle S.A.',
    title: 'Mirador del Valle',
    description: 'Parador de montaña con vista al valle y cocina de leña los fines de semana.',
    category: 'Parque',
    address: 'Km 12 vía El Valle',
    latitude: 10.4213,
    longitude: -66.8805,
    social: { web: 'miradorelvalle.test' },
    status: 'ACTIVE',
    owner: OWNER_BY_ID.get('u-ana')!,
    cover: 'mirador.jpg',
    updated_at: '2026-10-30T18:25:00Z',
    updated_by: 'Ana Rondón',
  },
  {
    id: 'pl-hotel-miramar',
    name: 'Hoteles Miramar C.A.',
    title: 'Hotel Miramar',
    description: 'Frente al mar, 48 habitaciones y restaurant propio abierto al público.',
    category: 'Hotel',
    address: 'Paseo Colón 210',
    latitude: 10.6011,
    longitude: -66.9412,
    social: { instagram: '@hotelmiramar', web: 'miramar.test' },
    status: 'ACTIVE',
    owner: OWNER_BY_ID.get('u-luis')!,
    cover: 'miramar.jpg',
    updated_at: '2026-10-28T09:05:00Z',
    updated_by: 'Luis Marín',
  },
  {
    id: 'pl-ruta-cafe',
    name: 'Ruta del Café',
    title: 'Ruta del Café',
    description: null,
    category: 'Café',
    address: null,
    latitude: 10.5055,
    longitude: -66.8991,
    social: {},
    status: 'ACTIVE',
    owner: null,
    cover: null,
    updated_at: '2026-10-27T14:00:00Z',
    updated_by: null,
  },
  {
    id: 'pl-el-parque',
    name: 'Arepera El Parque',
    title: 'Arepera El Parque',
    description: 'Puesto fijo en el parque Los Caobos; cerrado por refacción desde marzo.',
    category: 'Arepera',
    address: 'Parque Los Caobos',
    latitude: 10.4987,
    longitude: -66.8912,
    social: {},
    status: 'SUSPENDED',
    owner: null,
    cover: 'parque.jpg',
    updated_at: '2026-10-11T10:30:00Z',
    updated_by: null,
  },
  {
    id: 'pl-casa-azul',
    name: 'Posada Casa Azul',
    title: 'Posada Casa Azul',
    description: 'Nueve habitaciones en una casa colonial restaurada, a tres cuadras de la catedral.',
    category: 'Hotel',
    address: 'Calle Real 12',
    latitude: 10.5121,
    longitude: -66.8712,
    social: { instagram: '@casazulposada' },
    status: 'ACTIVE',
    owner: null,
    cover: 'casa.jpg',
    updated_at: '2026-10-05T16:45:00Z',
    updated_by: null,
  },
  {
    id: 'pl-mercado',
    name: 'Mercado de Buen Gusto',
    title: 'Mercado de Buen Gusto',
    description: 'Mercado gastronómico con doce puestos y música en vivo los jueves.',
    category: 'Café',
    address: 'Esquina de Pajaritos',
    latitude: 10.5063,
    longitude: -66.9148,
    social: {},
    status: 'ACTIVE',
    owner: null,
    cover: 'mercado.jpg',
    updated_at: '2026-09-29T12:15:00Z',
    updated_by: null,
  },
];

/** Owner catalogue for the reassignment select; a real client would page `GET /admin/users`. */
export const PLACE_OWNERS: readonly PlaceOwner[] = OWNERS;

@Injectable({ providedIn: 'root' })
export class PlacesStore {
  private readonly state = signal<readonly Place[]>(PLACE_SEED.map((place) => ({ ...place })));

  readonly places = this.state.asReadonly();
  readonly owners = PLACE_OWNERS;

  /**
   * Applies a patch and resolves with the stored venue, the way `PATCH /admin/places/{id}`
   * will: the screen re-reads the signal instead of patching its own copy, so there is one
   * source of truth for what the list shows.
   */
  async update(id: string, patch: PlacePatch): Promise<Place> {
    const existing = this.state().find((place) => place.id === id);
    if (!existing) {
      throw new Error(`unknown place: ${id}`);
    }

    const { owner_id, ...fields } = patch;
    const next: Place = {
      ...existing,
      ...fields,
      social: fields.social ? { ...fields.social } : existing.social,
      owner: owner_id === undefined ? existing.owner : resolveOwner(owner_id),
      updated_at: new Date().toISOString(),
      updated_by: 'You',
    };

    this.state.update((places) => places.map((place) => (place.id === id ? next : place)));
    return next;
  }
}

/** `null` means the platform curates the venue; an unknown id must not invent an owner. */
function resolveOwner(ownerId: string | null): PlaceOwner | null {
  if (ownerId === null) return null;
  const owner = OWNER_BY_ID.get(ownerId);
  if (!owner) throw new Error(`unknown owner: ${ownerId}`);
  return owner;
}
