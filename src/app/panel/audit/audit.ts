import { Component, computed, inject, signal } from '@angular/core';
import type { ListQuery } from 'ng-crud-maker';
import type { AuditEvent } from '../../core/admin-api';
import { AdminTransport } from '../../core/admin-transport';
import { DataTable, type DataTableColumn } from '../../shared/data-table/data-table';

/** Page size the API's own paging default suggests; the log is read newest-first. */
const PAGE_SIZE = 20;

/** Long values would break the row: the cell truncates rather than wrapping. */
function truncate(value: unknown, length: number): string {
  if (value === null || value === undefined || value === '') return '—';
  const text = String(value);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function stamp(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '—';
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return value;
  return when.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Audit log: read-only and append-only, so there is nothing to create, edit or sort — the API
 * answers newest first and takes no sort parameter. The only filters are the ones
 * `admin/audit-events` accepts: the exact event, the user, the address hash, and a date range.
 *
 * The address is never shown in clear: the API stores an HMAC-SHA256 (`api/API.md` §7), which is
 * why the only way to follow one mailbox is the hash.
 */
@Component({
  selector: 'app-audit',
  imports: [DataTable],
  templateUrl: './audit.html',
  styleUrl: './audit.css',
})
export class Audit {
  private readonly transport = inject(AdminTransport);

  protected readonly rows = signal<readonly AuditEvent[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly eventFilter = signal('');
  protected readonly userFilter = signal('');
  protected readonly emailHashFilter = signal('');
  protected readonly fromFilter = signal('');
  protected readonly toFilter = signal('');

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return '0 of 0';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    return `${start}–${Math.min(this.page() * PAGE_SIZE, total)} of ${total}`;
  });

  protected readonly subtitle = computed(
    () => `${this.total()} events · append-only, newest first · emails are never stored in clear`,
  );

  protected readonly emptyLabel = computed(() =>
    this.loading() ? 'Loading events…' : 'No events match these filters.',
  );

  /**
   * Filter keys are `field_kind`, the shape `AdminTransport` translates: it strips the suffix and
   * maps the bare field to the API's parameter, and folds the `between` pair into `from`/`to`.
   */
  protected readonly columns: readonly DataTableColumn<AuditEvent>[] = [
    { label: 'Event', value: (row) => row.event },
    { label: 'When', value: (row) => stamp(row.created_at) },
    { label: 'User', value: (row) => truncate(row.user_id, 12), variant: 'mono' },
    { label: 'Actor', value: (row) => truncate(row.actor_user_id, 12), variant: 'mono' },
    { label: 'Email hash', value: (row) => truncate(row.email_hash, 12), variant: 'mono' },
    { label: 'IP', value: (row) => row.ip ?? '—', variant: 'mono' },
    { label: 'Country', value: (row) => row.country ?? '—' },
    { label: 'City', value: (row) => row.city ?? '—' },
    { label: 'Agent', value: (row) => truncate(row.user_agent, 34), variant: 'muted' },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const query: ListQuery = {
        page: this.page(),
        pageSize: PAGE_SIZE,
        // The API takes no sort parameter: it answers newest first, always.
        sort: null,
        search: '',
        filters: {
          event_eq: this.eventFilter().trim(),
          user_id_eq: this.userFilter().trim(),
          email_hash_eq: this.emailHashFilter().trim(),
          created_at_between: [this.fromFilter(), this.toFilter()],
        },
      };
      const result = await this.transport.list('admin/audit-events', query);
      this.rows.set(result.rows as unknown as AuditEvent[]);
      this.total.set(result.total);
    } catch (error) {
      // The transport already parsed the envelope: `code` is what a client reads.
      this.errorCode.set((error as { code?: string }).code ?? 'network_error');
      this.rows.set([]);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  /** Every filter is applied from the first page: keeping the offset would skip rows. */
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
}
