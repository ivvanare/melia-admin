import { Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { AdminApi, type AdminPlan, type PlanStatus } from '../../core/admin-api';
import { apiErrorCode } from '../../core/api-error';
import { DataTable, type DataTableColumn, type DataTableTagVariant } from '../../shared/data-table/data-table';

const PAGE_SIZE = 20;

const STATUS_TAG: Record<PlanStatus, DataTableTagVariant> = {
  ACTIVE: 'ok',
  INACTIVE: 'neutral',
};

/**
 * Plans moderation: the whole site's plans, and one action that matters — suspending one.
 *
 * Suspending is what hides a plan: the owner and its members keep access, everyone else gets a `404`.
 * The panel does not join, edit or read a plan as a participant; that is the client's surface.
 */
@Component({
  selector: 'app-plans',
  imports: [DataTable, NzButtonModule],
  templateUrl: './plans.html',
  styleUrl: './plans.css',
})
export class Plans {
  private readonly api = inject(AdminApi);

  protected readonly rows = signal<readonly AdminPlan[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<string | null>(null);
  protected readonly statusFilter = signal('');
  protected readonly savingId = signal<string | null>(null);

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return '0 of 0';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    return `${start}–${Math.min(this.page() * PAGE_SIZE, total)} of ${total}`;
  });

  protected readonly subtitle = computed(() => {
    const total = this.total();
    return `${total} ${total === 1 ? 'plan' : 'plans'} · suspending one hides it from everyone but its owner and members`;
  });

  protected readonly emptyLabel = computed(() =>
    this.loading() ? 'Loading plans…' : 'No plan matches this filter.',
  );

  protected readonly columns: readonly DataTableColumn<AdminPlan>[] = [
    { label: 'Plan', value: (row) => row.name },
    { label: 'Visibility', value: (row) => row.visibility },
    { label: 'Members', value: (row) => row.memberCount, variant: 'mono' },
    { label: 'Scheduled', value: (row) => (row.scheduledAt ?? '—').slice(0, 16).replace('T', ' ') },
    { label: 'Owner', value: (row) => row.coUser, variant: 'mono' },
    { label: 'Status', tag: (row) => ({ label: row.status, variant: STATUS_TAG[row.status] }) },
    { label: 'Updated', value: (row) => row.updatedAt.slice(0, 10), variant: 'muted' },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const result = await this.api.listAdminPlans({
        page: this.page(),
        limit: PAGE_SIZE,
        status: (this.statusFilter() as PlanStatus | '') || null,
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

  /** One action, two directions: suspending hides, reactivating restores. */
  protected async toggleStatus(plan: AdminPlan): Promise<void> {
    if (this.savingId() !== null) return;
    const next: PlanStatus = plan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.savingId.set(plan.coRoute);
    this.errorCode.set(null);
    try {
      await this.api.setPlanStatus(plan.coRoute, next);
      await this.load();
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.savingId.set(null);
    }
  }
}
