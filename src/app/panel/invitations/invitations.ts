import { Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import {
  AdminApi,
  type AdminInvitation,
  type InvitationStatus,
} from '../../core/admin-api';
import { apiErrorCode } from '../../core/api-error';
import { DataTable, type DataTableColumn, type DataTableTagVariant } from '../../shared/data-table/data-table';

const PAGE_SIZE = 20;

const STATUS_TAG: Record<InvitationStatus, DataTableTagVariant> = {
  PENDING: 'info',
  ACCEPTED: 'ok',
  DECLINED: 'neutral',
  EXPIRED: 'neutral',
  REVOKED: 'danger',
};

/**
 * Invitations moderation: every invitation on the site, with one action — revoking a pending one.
 *
 * Revocation is terminal and needs no new client-side handling: `accept` only matches `PENDING`, so a
 * revoked invitation simply stops being usable. Accepted, declined and expired rows are history, and the
 * panel does not resurrect them.
 */
@Component({
  selector: 'app-invitations',
  imports: [DataTable, NzButtonModule],
  templateUrl: './invitations.html',
  styleUrl: './invitations.css',
})
export class Invitations {
  private readonly api = inject(AdminApi);

  protected readonly rows = signal<readonly AdminInvitation[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<string | null>(null);
  protected readonly statusFilter = signal('');
  protected readonly revokingId = signal<string | null>(null);
  protected readonly statuses: readonly InvitationStatus[] = [
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED',
    'REVOKED',
  ];

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return '0 of 0';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    return `${start}–${Math.min(this.page() * PAGE_SIZE, total)} of ${total}`;
  });

  protected readonly subtitle = computed(() => {
    const total = this.total();
    return `${total} ${total === 1 ? 'invitation' : 'invitations'} · revoking is terminal; accepted and declined rows are history`;
  });

  protected readonly emptyLabel = computed(() =>
    this.loading() ? 'Loading invitations…' : 'No invitation matches this filter.',
  );

  protected readonly columns: readonly DataTableColumn<AdminInvitation>[] = [
    { label: 'Plan', value: (row) => row.planName ?? row.coRoute },
    { label: 'Invitee', value: (row) => row.inviteeName ?? row.coUser },
    { label: 'Mode', value: (row) => row.mode, variant: 'mono' },
    {
      label: 'Expires',
      // `expired` is the read predicate's verdict, so a stale PENDING row says so instead of looking live.
      value: (row) => (row.expired ? 'expired' : row.expiresAt.slice(0, 10)),
      variant: 'muted',
    },
    { label: 'Answered', value: (row) => (row.respondedAt ?? '—').slice(0, 10), variant: 'muted' },
    { label: 'Status', tag: (row) => ({ label: row.status, variant: STATUS_TAG[row.status] }) },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const result = await this.api.listAdminInvitations({
        page: this.page(),
        limit: PAGE_SIZE,
        status: (this.statusFilter() as InvitationStatus | '') || null,
      });
      this.rows.set(result.data);
      this.total.set(result.total);
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
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

  /** Only a pending invitation can be revoked: the rest are already answered or unusable. */
  protected canRevoke(invitation: AdminInvitation): boolean {
    return invitation.status === 'PENDING';
  }

  protected async revoke(invitation: AdminInvitation): Promise<void> {
    if (this.revokingId() !== null) return;
    this.revokingId.set(invitation.coInvitation);
    this.errorCode.set(null);
    try {
      await this.api.revokeInvitation(invitation.coInvitation);
      await this.load();
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.revokingId.set(null);
    }
  }
}
