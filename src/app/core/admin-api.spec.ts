import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { API_URL } from './api-url.token';
import { AdminApi } from './admin-api';

const API = 'https://api.test/v1';

describe('AdminApi', () => {
  let api: AdminApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: API_URL, useValue: API },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    api = TestBed.inject(AdminApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('maps a users query to page/limit/q and omits an empty filter', async () => {
    const pending = api.listUsers({ page: 2, limit: 20, q: 'ana', status: null });
    const req = http.expectOne((r) => r.url === `${API}/admin/users`);

    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.get('q')).toBe('ana');
    // A null filter must not travel as `status=` — the API would see a value.
    expect(req.request.params.has('status')).toBe(false);

    req.flush({ data: [], page: 2, limit: 20, total: 0 });
    await expect(pending).resolves.toEqual({ data: [], page: 2, limit: 20, total: 0 });
  });

  it('replaces the role set with a PATCH carrying exactly the given names', async () => {
    const pending = api.setUserRoles('user-1', ['EDITOR']);
    const req = http.expectOne(`${API}/admin/users/user-1/roles`);

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ roles: ['EDITOR'] });

    req.flush({ id: 'user-1', status: 'ACTIVE', roles: ['EDITOR'] });
    await expect(pending).resolves.toMatchObject({ roles: ['EDITOR'] });
  });

  it('unwraps the data array of the role and permission catalogues', async () => {
    const roles = api.listRoles();
    http
      .expectOne(`${API}/admin/roles`)
      .flush({ data: [{ id: 'r1', name: 'ADMIN', description: null, status: 'ACTIVE', permissions: [] }] });
    await expect(roles).resolves.toHaveLength(1);

    const permissions = api.listPermissions();
    http
      .expectOne(`${API}/admin/permissions`)
      .flush({ data: [{ id: 'p1', code: 'admin.access', module: 'ADMIN', name: 'Access', status: 'ACTIVE' }] });
    await expect(permissions).resolves.toHaveLength(1);
  });

  it('sends only the audit filters that have a value', async () => {
    const pending = api.listAuditEvents({ page: 1, limit: 20, event: 'auth.login.failed' });
    const req = http.expectOne((r) => r.url === `${API}/admin/audit-events`);

    expect(req.request.params.get('event')).toBe('auth.login.failed');
    expect(req.request.params.has('userId')).toBe(false);
    expect(req.request.params.has('from')).toBe(false);

    req.flush({ data: [], page: 1, limit: 20, total: 0 });
    await pending;
  });

  it('replaces the gallery with a PUT carrying the placements', async () => {
    const pending = api.replacePlacePhotos('pl-1', [
      { coPhoto: 'p1', type: 'COVER', order: 0 },
      { coPhoto: 'p2', type: 'GALLERY', order: 1 },
    ]);
    const req = http.expectOne(`${API}/admin/places/pl-1/photos`);

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      photos: [
        { coPhoto: 'p1', type: 'COVER', order: 0 },
        { coPhoto: 'p2', type: 'GALLERY', order: 1 },
      ],
    });

    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(pending).resolves.toBeUndefined();
  });

  it('posts a new role with its optional fields', async () => {
    const pending = api.createRole({
      name: 'CURATOR',
      description: 'Curates content',
      permissions: ['place.update'],
    });
    const req = http.expectOne(`${API}/admin/roles`);

    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'CURATOR',
      description: 'Curates content',
      permissions: ['place.update'],
    });

    req.flush({
      id: 'r-curator',
      name: 'CURATOR',
      description: 'Curates content',
      status: 'ACTIVE',
      permissions: ['place.update'],
    });
    const role = await pending;
    expect(role.id).toBe('r-curator');
    expect(role.name).toBe('CURATOR');
  });

  it('updates a role with PATCH', async () => {
    const pending = api.updateRole('r-1', {
      name: 'EDITOR_SENIOR',
      status: 'INACTIVE',
    });
    const req = http.expectOne(`${API}/admin/roles/r-1`);

    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      name: 'EDITOR_SENIOR',
      status: 'INACTIVE',
    });

    req.flush({
      id: 'r-1',
      name: 'EDITOR_SENIOR',
      description: null,
      status: 'INACTIVE',
      permissions: [],
    });
    const role = await pending;
    expect(role.name).toBe('EDITOR_SENIOR');
  });

  it('retires a role with DELETE', async () => {
    const pending = api.retireRole('r-1');
    const req = http.expectOne(`${API}/admin/roles/r-1`);

    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(pending).resolves.toBeUndefined();
  });

  it('replaces role permissions with PUT carrying codes', async () => {
    const pending = api.replaceRolePermissions('r-1', ['place.update', 'review.moderate']);
    const req = http.expectOne(`${API}/admin/roles/r-1/permissions`);

    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ codes: ['place.update', 'review.moderate'] });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await expect(pending).resolves.toBeUndefined();
  });
});
