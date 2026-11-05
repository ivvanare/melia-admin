import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from './api-url.token';

/** Envelope every list endpoint answers with (`api/API.md` §1). */
export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/** `UserSummary` in `api/openapi.yaml`. */
export interface UserSummary {
  id: string;
  name: string | null;
  email: string | null;
  status: UserStatus;
  email_verified_at: string | null;
  roles: string[];
  created_at: string;
}

/** `Role` in `api/openapi.yaml`. */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  permissions: string[];
}

/** A place's own lifecycle, as the backoffice writes it. */
export type AdminPlaceStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

/**
 * `status` on the listing is a **filter**, not a state: `DELETED` lists the logically retired
 * rows, which is the only way to see them. It is never written onto a place.
 */
export type AdminPlaceListStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

/** `AdminPlace` in `api/openapi.yaml`. */
export interface AdminPlace {
  coPlace: string;
  /** `null` for a place the backoffice curates itself. */
  coOwnerUser: string | null;
  /** Legal name, admin-only: never part of a public read. */
  name: string;
  title: string;
  description: string | null;
  category: { id: string; name: string };
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string;
  region: string | null;
  timezone: string;
  latitude: number;
  longitude: number;
  address: string | null;
  status: AdminPlaceStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

/**
 * `AdminPlaceWrite` in `api/openapi.yaml`. On a patch, an absent field means "unchanged" and an
 * explicit `null` clears a nullable — so this type must stay `Partial`-shaped rather than carry
 * defaults.
 */
export interface AdminPlaceWrite {
  name?: string;
  title?: string;
  description?: string | null;
  coPlaceCategory?: string;
  country?: string;
  region?: string | null;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  address?: string | null;
  status?: AdminPlaceStatus;
  /** Honoured only for a caller with `place.manage_all`; silently ignored otherwise. */
  coOwnerUser?: string | null;
}

export type ReviewStatus = 'ACTIVE' | 'INACTIVE' | 'MODERATED';

/**
 * `Review` in `api/openapi.yaml`, as the moderation listing returns it.
 *
 * `viaFollowedAuthor` is viewer-relative — true when the reader follows the author — so it
 * describes this read, not the row. Moderation never uses it, and storing it under a key that
 * lacks the viewer would be a bug; it stays only because the wire schema requires it.
 */
export interface AdminReview {
  coReview: string;
  coPlace: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  /** Display-safe author fields: the API never exposes the address here. */
  author: { id: string; name: string | null };
  createdAt: string;
  updatedAt: string;
  viaFollowedAuthor: boolean;
}

/** `Permission` in `api/openapi.yaml`. */
export interface Permission {
  id: string;
  code: string;
  module: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

/** `AuditEvent` in `api/openapi.yaml`. Emails are never in clear: only an HMAC. */
export interface AuditEvent {
  id: string;
  event: string;
  user_id: string | null;
  actor_user_id: string | null;
  email_hash: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PageQuery {
  page: number;
  limit: number;
}

export interface UsersQuery extends PageQuery {
  /** Case-insensitive match on name or email. */
  q?: string | null;
  status?: UserStatus | null;
}

export interface AdminPlacesQuery extends PageQuery {
  q?: string | null;
  status?: AdminPlaceListStatus | null;
  categoryId?: string | null;
  country?: string | null;
  region?: string | null;
}

export interface AdminReviewsQuery extends PageQuery {
  /** Omitted means every status, moderated and logically deleted rows included. */
  status?: ReviewStatus | null;
  placeId?: string | null;
  authorId?: string | null;
}

export interface AuditQuery extends PageQuery {
  /** Exact event name, e.g. `auth.login.failed`. */
  event?: string | null;
  userId?: string | null;
  from?: string | null;
  to?: string | null;
}

/**
 * The admin endpoints the panel uses, with this API's dialect. It exists because
 * `ng-crud-maker`'s `HttpTransport` speaks a different one (`perPage` instead of
 * `limit`, and a `field_kind` filter grammar this API does not have), and because
 * these entities are read-only here: role assignment is a replacement call, not
 * a generic update.
 *
 * Errors propagate as `HttpErrorResponse`; callers parse `error.error.code`,
 * never `message` (`api/API.md` §1).
 */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL).replace(/\/+$/, '');

  listUsers(query: UsersQuery): Promise<Page<UserSummary>> {
    return firstValueFrom(
      this.http.get<Page<UserSummary>>(`${this.baseUrl}/admin/users`, {
        params: toParams({
          page: query.page,
          limit: query.limit,
          q: query.q,
          status: query.status,
        }),
      }),
    );
  }

  /**
   * Edits what an administrator owns: the display name and the account status. The
   * email is not editable here — `api/API.md` proves the address before the row
   * exists, so an admin-side change would skip verification.
   */
  updateUser(
    userId: string,
    patch: { name?: string; status?: UserStatus },
  ): Promise<UserSummary> {
    return firstValueFrom(
      this.http.patch<UserSummary>(
        `${this.baseUrl}/admin/users/${encodeURIComponent(userId)}`,
        patch,
      ),
    );
  }

  /**
   * Queues an invitation to an address. Nothing is created: the person registers and
   * proves the address, and the role is granted afterwards.
   */
  inviteUser(email: string, name?: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${this.baseUrl}/admin/users/invitations`, { email, name }),
    );
  }

  /** Sends the account's reset code to its owner. An admin never sets a password. */
  requestPasswordReset(userId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${this.baseUrl}/admin/users/${encodeURIComponent(userId)}/password-reset`,
        {},
      ),
    );
  }

  /** Replaces the whole role set: a role left out of `roles` is removed. */
  setUserRoles(userId: string, roles: string[]): Promise<UserSummary> {
    return firstValueFrom(
      this.http.patch<UserSummary>(
        `${this.baseUrl}/admin/users/${encodeURIComponent(userId)}/roles`,
        { roles },
      ),
    );
  }

  /**
   * The places backoffice. The server decides scope: with `place.manage_all` this returns the
   * whole catalogue, without it only the caller's own places — so the screen never filters by
   * ownership itself, or it would be re-implementing an authorization rule.
   */
  listAdminPlaces(query: AdminPlacesQuery): Promise<Page<AdminPlace>> {
    return firstValueFrom(
      this.http.get<Page<AdminPlace>>(`${this.baseUrl}/admin/places`, {
        params: toParams({
          page: query.page,
          limit: query.limit,
          q: query.q,
          status: query.status,
          categoryId: query.categoryId,
          country: query.country,
          region: query.region,
        }),
      }),
    );
  }

  /** A row the caller may not see answers `404`, deliberately: a `403` would confirm it exists. */
  getAdminPlace(coPlace: string): Promise<AdminPlace> {
    return firstValueFrom(
      this.http.get<AdminPlace>(`${this.baseUrl}/admin/places/${encodeURIComponent(coPlace)}`),
    );
  }

  /** Creating and assigning an owner belong to `place.manage_all`. */
  createAdminPlace(body: AdminPlaceWrite): Promise<AdminPlace> {
    return firstValueFrom(this.http.post<AdminPlace>(`${this.baseUrl}/admin/places`, body));
  }

  /** Partial: absent means unchanged, `null` clears a nullable. */
  updateAdminPlace(coPlace: string, body: AdminPlaceWrite): Promise<AdminPlace> {
    return firstValueFrom(
      this.http.patch<AdminPlace>(`${this.baseUrl}/admin/places/${encodeURIComponent(coPlace)}`, body),
    );
  }

  /** Logical delete: the row stays and leaves discovery, reviews and check-ins. */
  deleteAdminPlace(coPlace: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.baseUrl}/admin/places/${encodeURIComponent(coPlace)}`),
    );
  }

  /**
   * The moderation listing: newest first, every filter optional.
   *
   * It deliberately ignores the public visibility predicate, so it returns moderated and
   * logically deleted reviews too. A screen must show the state per row and never filter what
   * this returns by "the public listing would not show it".
   */
  listAdminReviews(query: AdminReviewsQuery): Promise<Page<AdminReview>> {
    return firstValueFrom(
      this.http.get<Page<AdminReview>>(`${this.baseUrl}/admin/reviews`, {
        params: toParams({
          page: query.page,
          limit: query.limit,
          status: query.status,
          placeId: query.placeId,
          authorId: query.authorId,
        }),
      }),
    );
  }

  /** Changes one review's status. Moderating neither deletes it nor blocks its author. */
  setReviewStatus(coReview: string, status: ReviewStatus): Promise<AdminReview> {
    return firstValueFrom(
      this.http.patch<AdminReview>(
        `${this.baseUrl}/admin/reviews/${encodeURIComponent(coReview)}`,
        { status },
      ),
    );
  }

  async listRoles(): Promise<Role[]> {
    const body = await firstValueFrom(
      this.http.get<{ data: Role[] }>(`${this.baseUrl}/admin/roles`),
    );
    return body.data;
  }

  async listPermissions(): Promise<Permission[]> {
    const body = await firstValueFrom(
      this.http.get<{ data: Permission[] }>(`${this.baseUrl}/admin/permissions`),
    );
    return body.data;
  }

  listAuditEvents(query: AuditQuery): Promise<Page<AuditEvent>> {
    return firstValueFrom(
      this.http.get<Page<AuditEvent>>(`${this.baseUrl}/admin/audit-events`, {
        params: toParams({
          page: query.page,
          limit: query.limit,
          event: query.event,
          userId: query.userId,
          from: query.from,
          to: query.to,
        }),
      }),
    );
  }
}

/** Drops empty values so an absent filter never travels as `?q=`. */
function toParams(values: Record<string, string | number | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text === '') continue;
    params = params.set(key, text);
  }
  return params;
}
