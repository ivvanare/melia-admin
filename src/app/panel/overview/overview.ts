import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminApi,
  type AdminPlace,
  type AdminReview,
  type AuditEvent,
} from '../../core/admin-api';
import { apiErrorCode } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { formatDateTime } from '../../core/format';
import { ICON_PATHS, visibleModules } from '../panel-nav';

/**
 * Panel overview dashboard. Every metric and preview comes from real endpoints
 * that exist — there are no placeholder or fake statistics.
 */
@Component({
  selector: 'app-overview',
  imports: [RouterLink],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview {
  private readonly api = inject(AdminApi);
  protected readonly auth = inject(AuthService);

  protected readonly icons = ICON_PATHS;
  protected readonly modules = computed(() => visibleModules(this.auth.permissions()));
  protected readonly formatDateTime = formatDateTime;

  protected readonly loading = signal(true);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly usersTotal = signal<number | null>(null);
  protected readonly rolesTotal = signal<number | null>(null);
  protected readonly permissionsTotal = signal<number | null>(null);
  protected readonly eventsTotal = signal<number | null>(null);
  protected readonly placesTotal = signal<number | null>(null);
  protected readonly reviewsTotal = signal<number | null>(null);
  protected readonly plansTotal = signal<number | null>(null);

  protected readonly recent = signal<readonly AuditEvent[]>([]);
  protected readonly recentPlaces = signal<readonly AdminPlace[]>([]);
  protected readonly recentReviews = signal<readonly AdminReview[]>([]);

  protected readonly canReadUsers = computed(() => this.auth.permissions().includes('user.read'));
  protected readonly canManageRoles = computed(() => this.auth.permissions().includes('role.manage'));
  protected readonly canManagePlaces = computed(
    () =>
      this.auth.permissions().includes('place.update') ||
      this.auth.permissions().includes('place.manage_all'),
  );
  protected readonly canModerateReviews = computed(() =>
    this.auth.permissions().includes('review.moderate'),
  );
  protected readonly canModeratePlans = computed(() =>
    this.auth.permissions().includes('plan.moderate'),
  );

  /** First name, or the local part of the email when there is no name. */
  protected readonly greetingName = computed(() => {
    const user = this.auth.user();
    const name = user?.name?.trim();
    if (name) return name.split(/\s+/)[0]!;
    const email = user?.email?.trim();
    return email ? email.split('@')[0]! : 'there';
  });

  protected readonly operatorInitials = computed(() => {
    const user = this.auth.user();
    const name = user?.name?.trim();
    if (name) {
      const parts = name.split(/\s+/);
      return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
    }
    const email = user?.email?.trim();
    return (email ? email.slice(0, 2) : 'OP').toUpperCase();
  });

  constructor() {
    void this.load();
  }

  protected starRating(rating: number): string {
    const rounded = Math.round(Math.max(1, Math.min(5, rating)));
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  }

  protected placeLocation(place: AdminPlace): string {
    return [place.region, place.country].filter(Boolean).join(', ') || place.country;
  }

  protected placeRating(place: AdminPlace): string {
    return place.rating
      ? `${place.rating.average.toFixed(1)} ★ (${place.rating.count})`
      : 'No reviews';
  }

  /**
   * One round trip per source, in parallel: totals come from the same list
   * endpoints the modules use, with `limit=1` or small limits for recent items.
   */
  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const perms = this.auth.permissions();
      const tasks: Promise<unknown>[] = [];

      if (typeof this.api.listUsers === 'function') {
        tasks.push(
          this.api.listUsers({ page: 1, limit: 1 }).then((res) => this.usersTotal.set(res.total)),
        );
      }
      if (typeof this.api.listRoles === 'function') {
        tasks.push(this.api.listRoles().then((res) => this.rolesTotal.set(res.length)));
      }
      if (typeof this.api.listPermissions === 'function') {
        tasks.push(
          this.api.listPermissions().then((res) => this.permissionsTotal.set(res.length)),
        );
      }
      if (typeof this.api.listAuditEvents === 'function') {
        tasks.push(
          this.api.listAuditEvents({ page: 1, limit: 5 }).then((res) => {
            this.eventsTotal.set(res.total);
            this.recent.set(res.data);
          }),
        );
      }
      if (
        (perms.includes('place.update') || perms.includes('place.manage_all')) &&
        typeof this.api.listAdminPlaces === 'function'
      ) {
        tasks.push(
          this.api.listAdminPlaces({ page: 1, limit: 3 }).then((res) => {
            this.placesTotal.set(res.total);
            this.recentPlaces.set(res.data);
          }),
        );
      }
      if (perms.includes('review.moderate') && typeof this.api.listAdminReviews === 'function') {
        tasks.push(
          this.api.listAdminReviews({ page: 1, limit: 3 }).then((res) => {
            this.reviewsTotal.set(res.total);
            this.recentReviews.set(res.data);
          }),
        );
      }
      if (perms.includes('plan.moderate') && typeof this.api.listAdminPlans === 'function') {
        tasks.push(
          this.api.listAdminPlans({ page: 1, limit: 1 }).then((res) => {
            this.plansTotal.set(res.total);
          }),
        );
      }

      await Promise.all(tasks);
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }
}
