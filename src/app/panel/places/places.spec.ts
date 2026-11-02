import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, type Me } from '../../core/auth.service';
import { Places } from './places';
import { PlacesStore, PLACE_SEED } from './places.store';

/** A store owner: the panel opens, but only their own venues are theirs to edit. */
const OWNER: Me = {
  id: 'u-ana',
  name: 'Ana Rondón',
  email: 'ana@melia.test',
  status: 'ACTIVE',
  email_verified_at: '2026-03-15T10:00:00Z',
  roles: ['OWNER'],
  permissions: ['admin.access', 'place.update', 'menu.manage'],
  created_at: '2026-03-15T10:00:00Z',
};

/** The platform team: sees every venue, creates, deletes and reassigns. */
const PLATFORM: Me = {
  id: 'u-ivan',
  name: 'Ivan Are',
  email: 'ivan@melia.test',
  status: 'ACTIVE',
  email_verified_at: '2026-03-01T10:00:00Z',
  roles: ['SUPERADMIN'],
  permissions: [
    'admin.access',
    'user.read',
    'user.manage',
    'role.manage',
    'place.create',
    'place.update',
    'place.delete',
    'menu.manage',
    'review.moderate',
    'route.manage',
  ],
  created_at: '2026-03-01T10:00:00Z',
};

const OTHERS = PLACE_SEED.filter((place) => place.owner !== null && place.owner.id !== OWNER.id);
const MINE = PLACE_SEED.filter((place) => place.owner?.id === OWNER.id);

/** One macrotask: drains the microtasks chained off a resolved promise. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Places', () => {
  const me = signal<Me | null>(null);

  beforeEach(() => {
    TestBed.resetTestingModule();
    me.set(PLATFORM);

    TestBed.configureTestingModule({
      imports: [Places],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: me.asReadonly(),
            permissions: computed(() => me()?.permissions ?? []),
          },
        },
      ],
    });
  });

  afterEach(() => {
    // The dialog is portalled to <body>; leaving it behind leaks into the next test.
    document.body
      .querySelectorAll('.cdk-overlay-container, .ant-modal-root')
      .forEach((node) => node.remove());
  });

  function inDialog<T extends Element>(selector: string): NodeListOf<T> {
    return document.body.querySelectorAll<T>(selector);
  }

  function dialogButton(text: string): HTMLButtonElement {
    const found = [...inDialog<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === text,
    );
    if (!found) throw new Error(`no dialog button labelled "${text}"`);
    return found;
  }

  function buttonByText(root: HTMLElement, text: string): HTMLButtonElement {
    const found = [...root.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === text,
    );
    if (!found) throw new Error(`no button labelled "${text}"`);
    return found as HTMLButtonElement;
  }

  /** The toolbar lives inside the fixture, so the search field is read from it. */
  function setSearch(root: HTMLElement, value: string): void {
    const field = root.querySelector<HTMLInputElement>('#places-search');
    if (!field) throw new Error('no search field');
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  async function render(): Promise<{
    element: HTMLElement;
    fixture: ReturnType<typeof TestBed.createComponent<Places>>;
    store: PlacesStore;
  }> {
    const fixture = TestBed.createComponent(Places);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return {
      element: fixture.nativeElement as HTMLElement,
      fixture,
      store: TestBed.inject(PlacesStore),
    };
  }

  function setDialogValue(selector: string, value: string): void {
    const field = inDialog<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)[0];
    if (!field) throw new Error(`no dialog field "${selector}"`);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('change'));
  }

  async function openFirstCard(
    element: HTMLElement,
    fixture: { detectChanges: () => void },
  ): Promise<void> {
    buttonByText(element, 'Edit record').click();
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
  }

  it('shows every venue with its owner to a platform session, and offers creation', async () => {
    const { element } = await render();

    // Six per page is the density the chosen direction accepts; the pager states the rest.
    expect(element.querySelectorAll('article.place')).toHaveLength(6);
    expect(element.textContent).toContain('1–6 of 9');
    expect(element.textContent).toContain('ana@melia.test');
    expect(element.textContent).toContain('curated by the platform');
    expect(() => buttonByText(element, 'New place')).not.toThrow();
  });

  it('shows an owner only their own venues and none of the platform actions', async () => {
    me.set(OWNER);
    const { element } = await render();

    expect(element.querySelectorAll('article.place')).toHaveLength(MINE.length);
    expect(element.textContent).toContain(MINE[0]!.title);

    for (const other of OTHERS) {
      expect(element.textContent).not.toContain(other.title);
      if (other.owner?.email) expect(element.textContent).not.toContain(other.owner.email);
    }

    // No creation and no ownership filter: both are platform capabilities.
    const labels = [...element.querySelectorAll('button')].map((button) => button.textContent?.trim());
    expect(labels).not.toContain('New place');
    expect(element.textContent).not.toContain('Unowned');
  });

  it('opens the dialog with the venue values and saves the edited fields', async () => {
    const { element, fixture, store } = await render();
    const update = vi.spyOn(store, 'update');
    const first = PLACE_SEED[0]!;

    await openFirstCard(element, fixture);

    expect(inDialog<HTMLInputElement>('#place-title')[0]!.value).toBe(first.title);

    setDialogValue('#place-title', 'Melia Centro Renovado');
    setDialogValue('#place-desc', 'Recién reformado.');
    setDialogValue('#place-addr', 'Av. Bolívar 46');
    setDialogValue('#place-lat', '10.5');
    setDialogValue('#place-lng', '-66.9');
    setDialogValue('#place-ig', '@melia.centro');

    dialogButton('Save changes').click();
    await tick();
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith(
      first.id,
      expect.objectContaining({
        title: 'Melia Centro Renovado',
        description: 'Recién reformado.',
        address: 'Av. Bolívar 46',
        latitude: 10.5,
        longitude: -66.9,
        social: expect.objectContaining({ instagram: '@melia.centro' }),
      }),
    );
    // The card re-reads the store, so the change is visible without a reload.
    expect(element.textContent).toContain('Melia Centro Renovado');
  });

  it('refuses to save without a commercial title', async () => {
    const { element, fixture, store } = await render();
    const update = vi.spyOn(store, 'update');

    await openFirstCard(element, fixture);
    setDialogValue('#place-title', '');
    dialogButton('Save changes').click();
    await tick();
    fixture.detectChanges();

    expect(update).not.toHaveBeenCalled();
    const alert = inDialog<HTMLElement>('[role="alert"]');
    expect(alert.length).toBeGreaterThan(0);
    expect(alert[0]!.textContent).toContain('title');
  });

  it('refuses a latitude outside the range the database accepts', async () => {
    const { element, fixture, store } = await render();
    const update = vi.spyOn(store, 'update');

    await openFirstCard(element, fixture);
    setDialogValue('#place-lat', '120');
    dialogButton('Save changes').click();
    await tick();
    fixture.detectChanges();

    expect(update).not.toHaveBeenCalled();
    expect(inDialog<HTMLElement>('[role="alert"]')[0]!.textContent).toContain('Latitude');
  });

  it('narrows the grid with the search box and says when nothing matches', async () => {
    const { element, fixture } = await render();

    setSearch(element, 'miramar');
    fixture.detectChanges();
    await tick();

    expect(element.querySelectorAll('article.place')).toHaveLength(1);
    expect(element.textContent).toContain('Hotel Miramar');

    setSearch(element, 'zzzz no existe');
    fixture.detectChanges();
    await tick();

    expect(element.querySelectorAll('article.place')).toHaveLength(0);
    expect(element.textContent?.toLowerCase()).toContain('no venue matches');
  });

  it('reassigns a venue from a platform session and reflects it on the card', async () => {
    const { element, fixture, store } = await render();
    const update = vi.spyOn(store, 'update');
    const unowned = PLACE_SEED.find((place) => place.owner === null)!;

    // Narrow to that venue instead of relying on which page it lands on.
    setSearch(element, unowned.title);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();

    await openFirstCard(element, fixture);

    setDialogValue('#place-owner', OWNER.id);
    dialogButton('Save changes').click();
    await tick();
    fixture.detectChanges();

    expect(update).toHaveBeenCalledWith(
      unowned.id,
      expect.objectContaining({ owner_id: OWNER.id }),
    );
    const card = element.querySelector('article.place');
    expect(card?.textContent).toContain(OWNER.email);
  });

  it('hides the ownership and status controls from an owner session', async () => {
    me.set(OWNER);
    const { element, fixture } = await render();

    await openFirstCard(element, fixture);

    expect(inDialog('#place-title')).toHaveLength(1);
    // Reassigning a venue and suspending it are platform capabilities: the controls are
    // absent, not disabled.
    expect(inDialog('#place-owner')).toHaveLength(0);
    expect(inDialog('#place-status')).toHaveLength(0);
  });

  it('switches to the table view with the same page of venues', async () => {
    const { element, fixture } = await render();

    buttonByText(element, 'Table').click();
    fixture.detectChanges();
    await tick();

    const rows = element.querySelectorAll('table.panel-table tbody tr');
    expect(rows).toHaveLength(6);
    expect(element.textContent).toContain('Owner');
  });
});
