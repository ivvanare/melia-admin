import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminApi,
  type AdminPlace,
  type AdminReview,
  type AuditEvent,
} from '../../core/admin-api';
import { AuthService } from '../../core/auth.service';
import { Overview } from './overview';

const ME = {
  id: 'u1',
  name: 'Ana Díaz',
  email: 'ana@melia.test',
  status: 'ACTIVE',
  email_verified_at: null,
  roles: ['SUPERADMIN'],
  permissions: ['admin.access', 'user.read', 'role.manage', 'place.create', 'place.update'],
  created_at: '2026-01-01T00:00:00Z',
};

const EVENT: AuditEvent = {
  id: 'e1',
  event: 'auth.login.failed',
  user_id: null,
  actor_user_id: null,
  email_hash: null,
  ip: '127.0.0.1',
  country: 'VE',
  city: null,
  user_agent: null,
  metadata: null,
  created_at: '2026-10-31T12:00:00Z',
};

const SAMPLE_PLACE: AdminPlace = {
  coPlace: 'p-1',
  coOwnerUser: 'u-1',
  name: 'Bistro Central Legal',
  title: 'Bistro Central',
  description: 'Nice food',
  category: { id: 'c1', name: 'Restaurante' },
  country: 'VE',
  region: 'Miranda',
  timezone: 'America/Caracas',
  latitude: 10.49,
  longitude: -66.85,
  address: 'Av Principal',
  status: 'ACTIVE',
  rating: { average: 4.8, count: 25 },
  schedules: [],
  attributes: [],
  menus: [],
  photos: [],
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  deletedAt: null,
};

const SAMPLE_REVIEW: AdminReview = {
  coReview: 'r-1',
  coPlace: 'p-1',
  rating: 5,
  comment: 'Outstanding atmosphere and service!',
  status: 'ACTIVE',
  author: { id: 'u-2', name: 'Carlos Gomez' },
  place: { id: 'p-1', title: 'Bistro Central' },
  createdAt: '2026-10-15T14:00:00Z',
  updatedAt: '2026-10-15T14:00:00Z',
  viaFollowedAuthor: false,
};

/** One macrotask: drains every microtask chained off a resolved response. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Overview', () => {
  function setup(
    listUsers: ReturnType<typeof vi.fn>,
    extraApi: Record<string, unknown> = {},
    customPermissions = ME.permissions,
  ): void {
    TestBed.configureTestingModule({
      imports: [Overview],
      providers: [
        provideRouter([]),
        {
          provide: AdminApi,
          useValue: {
            listUsers,
            listRoles: vi.fn().mockResolvedValue([{}, {}, {}]),
            listPermissions: vi.fn().mockResolvedValue([{}, {}]),
            listAuditEvents: vi
              .fn()
              .mockResolvedValue({ data: [EVENT], page: 1, limit: 5, total: 42 }),
            ...extraApi,
          },
        },
        {
          provide: AuthService,
          useValue: {
            user: signal({ ...ME, permissions: customPermissions }),
            permissions: signal(customPermissions),
          },
        },
      ],
    });
  }

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Overview);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the real totals, the recent events and the module status', async () => {
    setup(vi.fn().mockResolvedValue({ data: [], page: 1, limit: 1, total: 7 }));
    const element = await render();
    const text = element.textContent ?? '';

    expect(text).toContain('Welcome back, Ana');
    expect(text).toContain('7'); // users total
    expect(text).toContain('3'); // roles
    expect(text).toContain('2'); // permissions
    expect(text).toContain('42'); // audit events
    expect(text).toContain('auth.login.failed');
    expect(text).toContain('Users');
    // The module catalogue lists what this session may open. Places is keyed on
    // `place.update`, the code an OWNER holds, so the fixture carries it too.
    expect(text).toContain('Places');
    expect(text).not.toContain('Mock data');
  });

  it('renders places and reviews preview widgets when permissions allow', async () => {
    const perms = [...ME.permissions, 'review.moderate', 'plan.moderate'];
    setup(
      vi.fn().mockResolvedValue({ data: [], page: 1, limit: 1, total: 15 }),
      {
        listAdminPlaces: vi.fn().mockResolvedValue({
          data: [SAMPLE_PLACE],
          page: 1,
          limit: 3,
          total: 8,
        }),
        listAdminReviews: vi.fn().mockResolvedValue({
          data: [SAMPLE_REVIEW],
          page: 1,
          limit: 3,
          total: 19,
        }),
        listAdminPlans: vi.fn().mockResolvedValue({
          data: [],
          page: 1,
          limit: 1,
          total: 5,
        }),
      },
      perms,
    );
    const element = await render();
    const text = element.textContent ?? '';

    // KPI numbers
    expect(text).toContain('8'); // places total
    expect(text).toContain('19'); // reviews total
    expect(text).toContain('5'); // plans total

    // Places preview widget
    expect(text).toContain('Bistro Central');
    expect(text).toContain('Restaurante');
    expect(text).toContain('Miranda, VE');

    // Reviews preview widget
    expect(text).toContain('Outstanding atmosphere and service!');
    expect(text).toContain('Carlos Gomez');

    // Operator card
    expect(text).toContain('AD');
    expect(text).toContain('SUPERADMIN');
  });

  it('shows the API error code, never the message, when a total cannot load', async () => {
    setup(
      vi
        .fn()
        .mockRejectedValue(
          new HttpErrorResponse({
            status: 403,
            error: { error: { code: 'permission_denied', message: 'No.' } },
          }),
        ),
    );
    const element = await render();
    const text = element.textContent ?? '';

    expect(text).toContain('permission_denied');
    expect(text).not.toContain('No.');
    expect(element.querySelector('[role="alert"]')).toBeTruthy();
  });
});
