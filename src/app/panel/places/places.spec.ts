import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, type Me } from '../../core/auth.service';
import { AdminApi, type AdminPlace } from '../../core/admin-api';
import { Places } from './places';

function me(permissions: string[]): Me {
  return {
    id: 'u-ana',
    name: 'Ana Rondón',
    email: 'ana@melia.test',
    status: 'ACTIVE',
    email_verified_at: '2026-03-15T10:00:00Z',
    roles: ['OWNER'],
    permissions,
    created_at: '2026-03-15T10:00:00Z',
  };
}

/** The platform team: sees the whole catalogue, creates, deletes and reassigns. */
const PLATFORM = me(['admin.access', 'place.update', 'place.delete', 'place.manage_all']);
/** A store owner: sees only its own rows, which the server already scoped. */
const OWNER = me(['admin.access', 'place.update']);

const PLACES: AdminPlace[] = [
  {
    coPlace: 'pl-1',
    coOwnerUser: 'u-ana',
    name: 'Inversiones Melia C.A.',
    title: 'Melia Centro',
    description: 'Hotel boutique en el centro.',
    category: { id: '11111111-1111-4111-8111-111111111111', name: 'Hotel' },
    country: 'VE',
    region: 'Distrito Capital',
    timezone: 'America/Caracas',
    latitude: 10.480594,
    longitude: -66.903606,
    address: 'Av. Bolívar 45',
    status: 'ACTIVE',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-11-01T09:40:00Z',
    rating: null,
    schedules: [],
    attributes: [],
    menus: [],
    photos: [],
    deletedAt: null,
  },
  {
    coPlace: 'pl-2',
    coOwnerUser: null,
    name: 'Ruta del Café',
    title: 'Ruta del Café',
    description: null,
    category: { id: '22222222-2222-4222-8222-222222222222', name: 'Café' },
    country: 'VE',
    region: null,
    timezone: 'America/Caracas',
    latitude: 10.5055,
    longitude: -66.8991,
    address: null,
    status: 'SUSPENDED',
    createdAt: '2026-03-16T10:00:00Z',
    updatedAt: '2026-10-27T14:00:00Z',
    rating: null,
    schedules: [],
    attributes: [],
    menus: [],
    photos: [],
    deletedAt: null,
  },
];

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Places', () => {
  const current = signal<Me | null>(PLATFORM);
  const listAdminPlaces = vi.fn();
  const updateAdminPlace = vi.fn();
  const createAdminPlace = vi.fn();
  const deleteAdminPlace = vi.fn();
  const listPlaceCategories = vi.fn();
  const getAdminPlace = vi.fn();
  const replacePlaceSchedules = vi.fn();
  const listPlaceAttributes = vi.fn();
  const replacePlaceAttributes = vi.fn();
  const replacePlaceMenu = vi.fn();
  const uploadPlacePhoto = vi.fn();
  const deletePlacePhoto = vi.fn();
  const photoUrl = vi.fn((path: string) => `http://api.test${path}`);

  const ATTRIBUTES = [
    { coPlaceAttribute: '44444444-4444-4444-8444-444444444444', code: 'terraza', name: 'Terraza', status: 'ACTIVE' as const },
    { coPlaceAttribute: '55555555-5555-4555-8555-555555555555', code: 'petfriendly', name: 'Pet friendly', status: 'ACTIVE' as const },
  ];

  const CATEGORIES = [
    { coPlaceCategory: '11111111-1111-4111-8111-111111111111', code: 'hotel', name: 'Hotel', status: 'ACTIVE' as const },
    { coPlaceCategory: '33333333-3333-4333-8333-333333333333', code: 'arepera', name: 'Arepera', status: 'ACTIVE' as const },
  ];

  beforeEach(() => {
    TestBed.resetTestingModule();
    current.set(PLATFORM);
    listAdminPlaces.mockReset().mockResolvedValue({ data: PLACES, page: 1, limit: 6, total: 2 });
    updateAdminPlace.mockReset().mockResolvedValue(PLACES[0]);
    createAdminPlace.mockReset().mockResolvedValue(PLACES[0]);
    deleteAdminPlace.mockReset().mockResolvedValue(undefined);
    listPlaceCategories.mockReset().mockResolvedValue(CATEGORIES);
    getAdminPlace.mockReset().mockResolvedValue({
      ...PLACES[0],
      rating: null,
      schedules: [{ dayOfWeek: 1, open: '07:00', close: '22:00' }],
      attributes: ['terraza'],
      menus: [],
      photos: [],
    });
    replacePlaceSchedules.mockReset().mockResolvedValue(undefined);
    listPlaceAttributes.mockReset().mockResolvedValue(ATTRIBUTES);
    replacePlaceAttributes.mockReset().mockResolvedValue(undefined);
    replacePlaceMenu.mockReset().mockResolvedValue(undefined);
    uploadPlacePhoto.mockReset().mockResolvedValue({
      coPhoto: 'ph1',
      url: '/media/places/pl-1/a.jpg',
      type: 'COVER',
      order: 0,
    });
    deletePlacePhoto.mockReset().mockResolvedValue(undefined);
    photoUrl.mockClear();

    TestBed.configureTestingModule({
      imports: [Places],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: current.asReadonly(),
            permissions: computed(() => current()?.permissions ?? []),
          },
        },
        {
          provide: AdminApi,
          useValue: {
            listAdminPlaces,
            updateAdminPlace,
            createAdminPlace,
            deleteAdminPlace,
            listPlaceCategories,
            getAdminPlace,
            replacePlaceSchedules,
            listPlaceAttributes,
            replacePlaceAttributes,
            replacePlaceMenu,
            uploadPlacePhoto,
            deletePlacePhoto,
            photoUrl,
          },
        },
      ],
    });
  });

  afterEach(() => {
    document.body
      .querySelectorAll('.cdk-overlay-container, .ant-modal-root')
      .forEach((node) => node.remove());
  });

  async function render(): Promise<{
    element: HTMLElement;
    fixture: ReturnType<typeof TestBed.createComponent<Places>>;
  }> {
    const fixture = TestBed.createComponent(Places);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, fixture };
  }

  function inDialog<T extends Element>(selector: string): NodeListOf<T> {
    return document.body.querySelectorAll<T>(selector);
  }

  function buttonIn(root: ParentNode, text: string): HTMLButtonElement {
    const found = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === text,
    );
    if (!found) throw new Error(`no button labelled "${text}"`);
    return found as HTMLButtonElement;
  }

  async function openFirst(
    element: HTMLElement,
    fixture: { detectChanges: () => void },
  ): Promise<void> {
    buttonIn(element, 'Edit record').click();
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
  }

  it('renders exactly the rows the server scoped, with their status', async () => {
    const { element } = await render();

    // Scope is the server's job: the screen must not filter by ownership again.
    expect(element.querySelectorAll('article.place')).toHaveLength(PLACES.length);
    expect(element.textContent).toContain('Melia Centro');
    expect(element.textContent).toContain('ACTIVE');
    expect(element.textContent).toContain('SUSPENDED');
    expect(listAdminPlaces).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 6 }),
    );
  });

  it('offers creation only with place.manage_all', async () => {
    const platform = await render();
    expect(() => buttonIn(platform.element, 'New place')).not.toThrow();

    TestBed.resetTestingModule();
    current.set(OWNER);
    TestBed.configureTestingModule({
      imports: [Places],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: current.asReadonly(),
            permissions: computed(() => current()?.permissions ?? []),
          },
        },
        {
          provide: AdminApi,
          useValue: {
            listAdminPlaces,
            updateAdminPlace,
            createAdminPlace,
            deleteAdminPlace,
            listPlaceCategories,
            getAdminPlace,
            replacePlaceSchedules,
            listPlaceAttributes,
            replacePlaceAttributes,
            replacePlaceMenu,
            uploadPlacePhoto,
            deletePlacePhoto,
            photoUrl,
          },
        },
      ],
    });
    const owner = await render();
    const labels = [...owner.element.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).not.toContain('New place');
  });

  it('sends the owner only when the session may manage the catalogue', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);

    expect(inDialog('#place-owner').length).toBe(1);
    buttonIn(document.body, 'Save changes').click();
    await tick();

    expect(updateAdminPlace).toHaveBeenCalledWith(
      'pl-1',
      expect.objectContaining({ coOwnerUser: 'u-ana' }),
    );
  });

  it('never sends the owner without place.manage_all', async () => {
    current.set(OWNER);
    const { element, fixture } = await render();
    await openFirst(element, fixture);

    expect(inDialog('#place-owner').length).toBe(0);
    buttonIn(document.body, 'Save changes').click();
    await tick();

    const patch = updateAdminPlace.mock.calls.at(-1)?.[1] as Record<string, unknown>;
    expect(patch).toBeDefined();
    expect('coOwnerUser' in patch).toBe(false);
  });

  it('offers the active categories in a select and sends the chosen uuid', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);

    expect(listPlaceCategories).toHaveBeenCalledWith('ACTIVE');
    const select = inDialog<HTMLSelectElement>('#place-category')[0]!;
    expect(select.tagName).toBe('SELECT');
    // Two active categories, and the place's own category is one of them.
    expect([...select.options].map((option) => option.value)).toContain(CATEGORIES[1]!.coPlaceCategory);

    select.value = CATEGORIES[1]!.coPlaceCategory;
    select.dispatchEvent(new Event('change'));
    buttonIn(document.body, 'Save changes').click();
    await tick();

    expect(updateAdminPlace).toHaveBeenCalledWith(
      'pl-1',
      expect.objectContaining({ coPlaceCategory: CATEGORIES[1]!.coPlaceCategory }),
    );
  });

  it('narrows the listing by category with a select fed by the catalogue', async () => {
    const { element, fixture } = await render();

    const select = element.querySelector<HTMLSelectElement>('#places-category')!;
    expect(select.tagName).toBe('SELECT');
    expect([...select.options].map((option) => option.value)).toContain(
      CATEGORIES[1]!.coPlaceCategory,
    );

    select.value = CATEGORIES[1]!.coPlaceCategory;
    select.dispatchEvent(new Event('change'));
    await tick();
    fixture.detectChanges();

    expect(listAdminPlaces.mock.calls.at(-1)?.[0]).toMatchObject({
      categoryId: CATEGORIES[1]!.coPlaceCategory,
      page: 1,
    });
  });

  it('loads the week and sends the whole set, dropping a disabled day', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    expect(getAdminPlace).toHaveBeenCalledWith('pl-1');
    // Monday was stored, so only Monday is enabled.
    const toggles = [...inDialog<HTMLInputElement>('.day-toggle input')];
    expect(toggles).toHaveLength(7);
    expect(toggles[0]!.checked).toBe(true);
    expect(toggles[1]!.checked).toBe(false);

    // Open Tuesday too, then save: both days travel, the other five are omitted.
    toggles[1]!.checked = true;
    toggles[1]!.dispatchEvent(new Event('change'));
    buttonIn(document.body, 'Save changes').click();
    await tick();
    await tick();

    expect(replacePlaceSchedules).toHaveBeenCalledWith('pl-1', [
      { dayOfWeek: 1, open: '07:00', close: '22:00' },
      { dayOfWeek: 2, open: '09:00', close: '18:00' },
    ]);
  });

  it('refuses a day whose opening and closing are the same time', async () => {
    getAdminPlace.mockResolvedValue({
      ...PLACES[0],
      rating: null,
      schedules: [{ dayOfWeek: 1, open: '09:00', close: '09:00' }],
      attributes: [],
      menus: [],
      photos: [],
    });
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    buttonIn(document.body, 'Save changes').click();
    await tick();
    fixture.detectChanges();

    expect(replacePlaceSchedules).not.toHaveBeenCalled();
    expect(inDialog<HTMLElement>('[role="alert"]')[0]!.textContent).toContain('same time');
  });

  it('offers the attribute vocabulary and sends the chosen codes whole', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    expect(listPlaceAttributes).toHaveBeenCalledWith('ACTIVE');
    const boxes = [...inDialog<HTMLInputElement>('.attr input')];
    expect(boxes).toHaveLength(ATTRIBUTES.length);
    // The stored code is already on.
    expect(boxes[0]!.checked).toBe(true);

    boxes[1]!.checked = true;
    boxes[1]!.dispatchEvent(new Event('change'));
    buttonIn(document.body, 'Save changes').click();
    await tick();
    await tick();

    expect(replacePlaceAttributes).toHaveBeenCalledWith('pl-1', ['terraza', 'petfriendly']);
  });

  it('sends the whole menu, and accepts a section with no dishes', async () => {
    getAdminPlace.mockResolvedValue({
      ...PLACES[0],
      rating: null,
      schedules: [],
      attributes: [],
      menus: [
        { name: 'Cena', description: null, items: [{ name: 'Arepa', description: null, price: 4.5, currency: 'USD' }] },
        { name: 'Postres', description: null, items: [] },
      ],
      photos: [],
    });
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    buttonIn(document.body, 'Save changes').click();
    await tick();
    await tick();

    // The empty section survives: a menu loaded without dishes is a real state, not an error.
    expect(replacePlaceMenu).toHaveBeenCalledWith('pl-1', [
      { name: 'Cena', description: null, items: [{ name: 'Arepa', description: null, price: 4.5, currency: 'USD' }] },
      { name: 'Postres', description: null, items: [] },
    ]);
  });

  it('reads the existing gallery with the place detail', async () => {
    getAdminPlace.mockResolvedValue({
      ...PLACES[0],
      rating: null,
      schedules: [],
      attributes: [],
      menus: [],
      photos: [
        { coPhoto: 'ph-old', url: '/media/places/pl-1/old.jpg', type: 'COVER', order: 0 },
        { coPhoto: 'ph-g', url: '/media/places/pl-1/g.jpg', type: 'GALLERY', order: 1 },
      ],
    });
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    // The whole dialog comes from one read, gallery included: without it the operator would
    // see an empty strip and could not tell the place already had a cover.
    const imgs = inDialog<HTMLImageElement>('.thumb img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0]!.getAttribute('src')).toBe('http://api.test/media/places/pl-1/old.jpg');
    expect(document.body.textContent).toContain('COVER');
  });

  it('uploads a cover and shows the preview through the API origin', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    const input = inDialog<HTMLInputElement>('input[type="file"]')[0]!;
    const file = new File(['bytes'], 'fachada.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await tick();
    await tick();
    fixture.detectChanges();

    // The type travels as the form field the API documents, not as a query parameter.
    // The cover goes to the front; the order travels because the handler now honours it.
    expect(uploadPlacePhoto).toHaveBeenCalledWith('pl-1', file, 'COVER', 0);
    const img = inDialog<HTMLImageElement>('.thumb img')[0]!;
    expect(img.getAttribute('src')).toBe('http://api.test/media/places/pl-1/a.jpg');
  });

  it('refuses an oversized file before the round trip', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    const input = inDialog<HTMLInputElement>('input[type="file"]')[0]!;
    const big = new File(['x'], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024, configurable: true });
    Object.defineProperty(input, 'files', { value: [big], configurable: true });
    input.dispatchEvent(new Event('change'));
    await tick();
    fixture.detectChanges();

    expect(uploadPlacePhoto).not.toHaveBeenCalled();
    expect(inDialog<HTMLElement>('[role="alert"]')[0]!.textContent).toContain('too_long');
  });

  it('removes a photo it uploaded', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    await tick();
    fixture.detectChanges();

    const input = inDialog<HTMLInputElement>('input[type="file"]')[1]!;
    const file = new File(['bytes'], 'sala.jpg', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    uploadPlacePhoto.mockResolvedValue({
      coPhoto: 'ph2',
      url: '/media/places/pl-1/b.png',
      type: 'GALLERY',
      order: 1,
    });
    input.dispatchEvent(new Event('change'));
    await tick();
    await tick();
    fixture.detectChanges();

    const remove = [...inDialog<HTMLButtonElement>('.thumb button')][0]!;
    remove.click();
    await tick();
    await tick();

    expect(uploadPlacePhoto).toHaveBeenCalledWith('pl-1', file, 'GALLERY', 0);
    expect(deletePlacePhoto).toHaveBeenCalledWith('pl-1', 'ph2');
    expect(inDialog('.thumb')).toHaveLength(0);
  });

  it('confirms before retiring a place, and only offers it with place.delete', async () => {
    const { element, fixture } = await render();
    await openFirst(element, fixture);

    buttonIn(document.body, 'Delete place').click();
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    expect(deleteAdminPlace).not.toHaveBeenCalled();

    buttonIn(document.body, 'Retire place').click();
    await tick();
    expect(deleteAdminPlace).toHaveBeenCalledWith('pl-1');
  });

  it('tells a 404 apart: it does not exist or it is not yours', async () => {
    updateAdminPlace.mockRejectedValue(
      new HttpErrorResponse({ status: 404, error: { error: { code: 'not_found' } } }),
    );
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    buttonIn(document.body, 'Save changes').click();
    await tick();
    await tick();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('does not exist or is not yours');
    expect(document.body.textContent).not.toContain('permission');
  });

  it('sends status=DELETED as the listing filter', async () => {
    const { element, fixture } = await render();

    const status = element.querySelector<HTMLSelectElement>('#places-status')!;
    status.value = 'DELETED';
    status.dispatchEvent(new Event('change'));
    await tick();
    fixture.detectChanges();

    expect(listAdminPlaces.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'DELETED', page: 1 });
  });

  it('keeps the dialog open with the code when a save is rejected', async () => {
    updateAdminPlace.mockRejectedValue(
      new HttpErrorResponse({ status: 422, error: { error: { code: 'validation_failed' } } }),
    );
    const { element, fixture } = await render();
    await openFirst(element, fixture);
    buttonIn(document.body, 'Save changes').click();
    await tick();
    await tick();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('validation_failed');
    expect(inDialog('#place-title').length).toBe(1);
  });
});
