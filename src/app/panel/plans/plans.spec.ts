import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApi, type AdminPlan } from '../../core/admin-api';
import { Plans } from './plans';

const PLAN: AdminPlan = {
  coRoute: 'r1',
  coUser: 'u1',
  name: 'Cena de cumpleaños',
  description: null,
  visibility: 'PUBLIC',
  status: 'ACTIVE',
  scheduledAt: '2026-12-01T20:00:00Z',
  partySize: 6,
  // A moderator belongs to no plan, so the API answers with the empty string.
  viewerRole: '',
  memberCount: 4,
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z',
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Plans', () => {
  const listAdminPlans = vi.fn();
  const setPlanStatus = vi.fn();

  beforeEach(() => {
    TestBed.resetTestingModule();
    listAdminPlans.mockReset().mockResolvedValue({ data: [PLAN], page: 1, limit: 20, total: 1 });
    setPlanStatus.mockReset().mockResolvedValue({ ...PLAN, status: 'INACTIVE' });
    TestBed.configureTestingModule({
      imports: [Plans],
      providers: [{ provide: AdminApi, useValue: { listAdminPlans, setPlanStatus } }],
    });
  });

  async function render(): Promise<{
    element: HTMLElement;
    fixture: ReturnType<typeof TestBed.createComponent<Plans>>;
  }> {
    const fixture = TestBed.createComponent(Plans);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, fixture };
  }

  function button(element: HTMLElement, text: string): HTMLButtonElement {
    const found = [...element.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === text,
    );
    if (!found) throw new Error(`no button "${text}"`);
    return found as HTMLButtonElement;
  }

  it('lists the site plans with their status', async () => {
    const { element } = await render();

    expect(listAdminPlans).toHaveBeenCalled();
    expect(element.textContent).toContain('Cena de cumpleaños');
    expect(element.textContent).toContain('ACTIVE');
    expect(element.textContent).toContain('1 plan');
  });

  it('suspends a plan and then offers to reactivate it', async () => {
    listAdminPlans
      .mockResolvedValueOnce({ data: [PLAN], page: 1, limit: 20, total: 1 })
      .mockResolvedValue({ data: [{ ...PLAN, status: 'INACTIVE' }], page: 1, limit: 20, total: 1 });

    const { element, fixture } = await render();
    button(element, 'Suspend').click();
    await tick();
    await tick();
    fixture.detectChanges();

    expect(setPlanStatus).toHaveBeenCalledWith('r1', 'INACTIVE');
    expect(() => button(element, 'Reactivate')).not.toThrow();
  });

  it('sends the status filter as the API names it', async () => {
    const { element, fixture } = await render();

    const status = element.querySelector<HTMLSelectElement>('select')!;
    status.value = 'INACTIVE';
    status.dispatchEvent(new Event('change'));
    await tick();
    fixture.detectChanges();

    expect(listAdminPlans.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'INACTIVE', page: 1 });
  });
});
