import { Component, computed, inject, signal } from '@angular/core';
import { AdminApi, type AdminReview, type ReviewStatus } from '../../core/admin-api';
import { DataTable, type DataTableColumn, type DataTableTagVariant } from '../../shared/data-table/data-table';

const PAGE_SIZE = 20;

/** A status is a pill; the colour is the design system's decision, not this screen's. */
const STATUS_TAG: Record<ReviewStatus, DataTableTagVariant> = {
  ACTIVE: 'ok',
  INACTIVE: 'neutral',
  MODERATED: 'warn',
};

const STATUSES: readonly ReviewStatus[] = ['ACTIVE', 'INACTIVE', 'MODERATED'];

/** Missing values read as an em dash rather than as an empty cell. */
function truncate(value: string | null, length: number): string {
  if (value === null || value.trim() === '') return '—';
  const text = value.trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function stamp(value: string): string {
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return value;
  return when.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Review moderation: the screen that makes `review.moderate` reachable at all.
 *
 * `PATCH /admin/reviews/{coReview}` needs a review id, and nothing else in the API hands one
 * out, so the admin listing exists purely to give a moderator a page to work from. It does not
 * apply the public visibility predicate: moderated and logically deleted rows are here on
 * purpose, which is why the state is a pill on every row and nothing is filtered client-side.
 *
 * One control per row, not two. Moderating changes a status — it neither deletes the review nor
 * blocks its author, and the author may review that place again.
 */
@Component({
  selector: 'app-reviews',
  imports: [DataTable],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class Reviews {
  private readonly api = inject(AdminApi);

  protected readonly rows = signal<readonly AdminReview[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly statusFilter = signal('');
  protected readonly placeFilter = signal('');
  protected readonly authorFilter = signal('');
  protected readonly statuses = STATUSES;

  /** The row whose status is being written, so only that select is locked. */
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
    return `${total} ${total === 1 ? 'review' : 'reviews'} · moderated and deleted rows included`;
  });

  protected readonly emptyLabel = computed(() =>
    this.loading() ? 'Loading reviews…' : 'No review matches these filters.',
  );

  protected readonly columns: readonly DataTableColumn<AdminReview>[] = [
    { label: 'When', value: (row) => stamp(row.createdAt) },
    { label: 'Place', value: (row) => row.coPlace, variant: 'mono' },
    {
      label: 'Author',
      value: (row) => (row.author.name?.trim() ? row.author.name : row.author.id),
    },
    { label: 'Rating', value: (row) => `${row.rating}/5`, variant: 'mono' },
    { label: 'Review', value: (row) => truncate(row.comment, 72), variant: 'muted' },
    {
      label: 'Status',
      tag: (row) => ({ label: row.status, variant: STATUS_TAG[row.status] }),
    },
  ];

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const result = await this.api.listAdminReviews({
        page: this.page(),
        limit: PAGE_SIZE,
        status: (this.statusFilter() as ReviewStatus | '') || null,
        placeId: this.placeFilter().trim() || null,
        authorId: this.authorFilter().trim() || null,
      });
      this.rows.set(result.data);
      this.total.set(result.total);
    } catch (error) {
      this.errorCode.set((error as { code?: string }).code ?? 'network_error');
      this.rows.set([]);
      this.total.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  /** A narrowed list must not stay on a page that no longer exists. */
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

  /**
   * Writes one status and re-reads the page, so the row shows what the server confirmed.
   * An optimistic update would leave the table claiming a moderation that may have been refused.
   */
  protected async changeStatus(
    review: AdminReview,
    status: string,
    select: HTMLSelectElement,
  ): Promise<void> {
    if (this.savingId() !== null || status === review.status) return;
    this.savingId.set(review.coReview);
    this.errorCode.set(null);
    try {
      await this.api.setReviewStatus(review.coReview, status as ReviewStatus);
      await this.load();
    } catch (error) {
      // Nothing changed on the server, so the control must not keep claiming it did: a bound
      // value that did not move is invisible to change detection, so this resets the element.
      select.value = review.status;
      this.errorCode.set((error as { code?: string }).code ?? 'network_error');
    } finally {
      this.savingId.set(null);
    }
  }
}
