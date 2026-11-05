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
  const getPlaceSchedules = vi.fn();
  const replacePlaceSchedules = vi.fn();

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
    getPlaceSchedules
      .mockReset()
      .mockResolvedValue([{ dayOfWeek: 1, open: '07:00', close: '22:00' }]);
    replacePlaceSchedules.mockReset().mockResolvedValue(undefined);

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
            getPlaceSchedules,
            replacePlaceSchedules,
            getAdminPlace: vi.fn(),
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
            getPlaceSchedules,
            replacePlaceSchedules,
            getAdminPlace: vi.fn(),
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

    expect(getPlaceSchedules).toHaveBeenCalledWith('pl-1');
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
    getPlaceSchedules.mockResolvedValue([{ dayOfWeek: 1, open: '09:00', close: '09:00' }]);
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
