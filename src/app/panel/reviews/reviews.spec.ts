import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApi, type AdminReview } from '../../core/admin-api';
import { Reviews } from './reviews';

const REVIEWS: AdminReview[] = [
  {
    coReview: 'r1',
    coPlace: 'p1',
    rating: 5,
    comment: 'Excelente atención y el café impecable.',
    status: 'ACTIVE',
    author: { id: 'u1', name: 'Ana Rondón' },
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    viaFollowedAuthor: false,
  },
  {
    coReview: 'r2',
    coPlace: 'p2',
    rating: 1,
    comment: null,
    status: 'MODERATED',
    author: { id: 'u2', name: null },
    createdAt: '2026-10-30T10:00:00Z',
    updatedAt: '2026-10-31T10:00:00Z',
    viaFollowedAuthor: true,
  },
];

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Reviews', () => {
  const listAdminReviews = vi.fn();
  const setReviewStatus = vi.fn();

  beforeEach(() => {
    TestBed.resetTestingModule();
    listAdminReviews.mockReset().mockResolvedValue({ data: REVIEWS, page: 1, limit: 20, total: 2 });
    setReviewStatus.mockReset();

    TestBed.configureTestingModule({
      imports: [Reviews],
      providers: [{ provide: AdminApi, useValue: { listAdminReviews, setReviewStatus } }],
    });
  });

  afterEach(() => {
    document.body
      .querySelectorAll('.cdk-overlay-container, .ant-modal-root')
      .forEach((node) => node.remove());
  });

  async function render(): Promise<{
    element: HTMLElement;
    fixture: ReturnType<typeof TestBed.createComponent<Reviews>>;
  }> {
    const fixture = TestBed.createComponent(Reviews);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, fixture };
  }

  function statusSelects(element: HTMLElement): HTMLSelectElement[] {
    return [...element.querySelectorAll<HTMLSelectElement>('tbody select')];
  }

  async function choose(
    element: HTMLElement,
    fixture: { detectChanges: () => void },
    index: number,
    value: string,
  ): Promise<void> {
    const select = statusSelects(element)[index]!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await tick();
    await tick();
    fixture.detectChanges();
  }

  it('lists the reviews the API returns, with their status and the total', async () => {
    const { element } = await render();
    const text = element.textContent ?? '';

    expect(listAdminReviews).toHaveBeenCalled();
    expect(text).toContain('Ana Rondón');
    expect(text).toContain('ACTIVE');
    expect(text).toContain('2 reviews');

    const pills = [...element.querySelectorAll('tbody span.tag')].map((pill) =>
      pill.textContent?.trim(),
    );
    expect(pills).toEqual(['ACTIVE', 'MODERATED']);
  });

  it('lists moderated rows instead of hiding them', async () => {
    const { element } = await render();

    // The admin listing ignores the public visibility predicate: the row stays even though
    // a public reader would never see it, and the screen never filters it out.
    expect(element.querySelectorAll('tbody tr')).toHaveLength(REVIEWS.length);
    expect(element.textContent).toContain('u2');
  });

  it('changes one row status through the API and shows what the server confirmed', async () => {
    setReviewStatus.mockResolvedValue({ ...REVIEWS[0], status: 'INACTIVE' });
    listAdminReviews
      .mockResolvedValueOnce({ data: REVIEWS, page: 1, limit: 20, total: 2 })
      .mockResolvedValue({
        data: [{ ...REVIEWS[0], status: 'INACTIVE' }, REVIEWS[1]],
        page: 1,
        limit: 20,
        total: 2,
      });

    const { element, fixture } = await render();
    await choose(element, fixture, 0, 'INACTIVE');

    expect(setReviewStatus).toHaveBeenCalledWith('r1', 'INACTIVE');
    expect(statusSelects(element)[0]!.value).toBe('INACTIVE');
  });

  it('keeps the row and surfaces the code when the change is rejected', async () => {
    setReviewStatus.mockRejectedValue({ code: 'permission_denied' });

    const { element, fixture } = await render();
    await choose(element, fixture, 0, 'INACTIVE');

    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(statusSelects(element)[0]!.value).toBe('ACTIVE');
    expect(element.textContent).toContain('permission_denied');
  });

  it('sends the three filters as the API names them', async () => {
    const { element, fixture } = await render();

    const status = element.querySelector<HTMLSelectElement>('#reviews-status')!;
    status.value = 'MODERATED';
    status.dispatchEvent(new Event('change'));

    const place = element.querySelector<HTMLInputElement>('#reviews-place')!;
    place.value = 'p1';
    place.dispatchEvent(new Event('input'));

    const author = element.querySelector<HTMLInputElement>('#reviews-author')!;
    author.value = 'u1';
    author.dispatchEvent(new Event('input'));
    await tick();
    fixture.detectChanges();

    const last = listAdminReviews.mock.calls.at(-1)?.[0];
    expect(last).toMatchObject({ status: 'MODERATED', placeId: 'p1', authorId: 'u1', page: 1, limit: 20 });
  });

  it('reports the code when the listing itself fails', async () => {
    listAdminReviews.mockRejectedValue({ code: 'permission_denied' });
    const { element } = await render();

    expect(element.textContent).toContain('permission_denied');
    // The base table still renders its empty row; what must not exist is a data row.
    expect(element.querySelectorAll('tbody select')).toHaveLength(0);
    expect(element.textContent).toContain('0 reviews');
  });
});
