import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApi, type AdminInvitation } from '../../core/admin-api';
import { Invitations } from './invitations';

const PENDING: AdminInvitation = {
  coInvitation: 'i1',
  coRoute: 'r1',
  coUser: 'u2',
  status: 'PENDING',
  mode: 'SURPRISE',
  message: null,
  hint: null,
  expiresAt: '2026-12-01T00:00:00Z',
  expired: false,
  createdAt: '2026-11-01T10:00:00Z',
  respondedAt: null,
  inviteeName: 'Luis Marín',
  planName: 'Cena de cumpleaños',
  planScheduledAt: null,
};

const ACCEPTED: AdminInvitation = {
  ...PENDING,
  coInvitation: 'i2',
  status: 'ACCEPTED',
  inviteeName: 'Ana Rondón',
  respondedAt: '2026-11-02T10:00:00Z',
};

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Invitations', () => {
  const listAdminInvitations = vi.fn();
  const revokeInvitation = vi.fn();

  beforeEach(() => {
    TestBed.resetTestingModule();
    listAdminInvitations
      .mockReset()
      .mockResolvedValue({ data: [PENDING, ACCEPTED], page: 1, limit: 20, total: 2 });
    revokeInvitation.mockReset().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [Invitations],
      providers: [{ provide: AdminApi, useValue: { listAdminInvitations, revokeInvitation } }],
    });
  });

  async function render(): Promise<{
    element: HTMLElement;
    fixture: ReturnType<typeof TestBed.createComponent<Invitations>>;
  }> {
    const fixture = TestBed.createComponent(Invitations);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, fixture };
  }

  function revokeButtons(element: HTMLElement): HTMLButtonElement[] {
    return [...element.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Revoke',
    ) as HTMLButtonElement[];
  }

  it('shows the plan and the invitee by name, not by uuid', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('Cena de cumpleaños');
    expect(element.textContent).toContain('Luis Marín');
    expect(element.textContent).toContain('2 invitations');
  });

  it('offers revocation only for a pending invitation', async () => {
    const { element } = await render();

    // Two rows, one PENDING: an accepted invitation is history and cannot be revoked.
    expect(revokeButtons(element)).toHaveLength(1);
  });

  it('revokes the pending one and reloads the page', async () => {
    const { element, fixture } = await render();
    revokeButtons(element)[0]!.click();
    await tick();
    await tick();
    fixture.detectChanges();

    expect(revokeInvitation).toHaveBeenCalledWith('i1');
    expect(listAdminInvitations).toHaveBeenCalledTimes(2);
  });

  it('marks a stale pending invitation as expired instead of looking live', async () => {
    listAdminInvitations.mockResolvedValue({
      data: [{ ...PENDING, expired: true }],
      page: 1,
      limit: 20,
      total: 1,
    });
    const { element } = await render();

    expect(element.textContent).toContain('expired');
  });
});
