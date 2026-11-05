import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApi, type Permission, type Role } from '../../core/admin-api';
import { Roles } from './roles';

const ROLES: Role[] = [
  { id: 'r1', name: 'EDITOR', description: 'Content', status: 'ACTIVE', permissions: ['admin.access', 'place.update'] },
];

const PERMISSIONS: Permission[] = [
  { id: 'p1', code: 'admin.access', module: 'ADMIN', name: 'Panel access', status: 'ACTIVE' },
  { id: 'p2', code: 'user.read', module: 'USERS', name: 'See users', status: 'ACTIVE' },
  { id: 'p3', code: 'user.manage', module: 'USERS', name: 'Manage users', status: 'ACTIVE' },
];

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Characterization tests: they pin what this screen already does before the catalogue table
 * moves onto the panel's base table, so the refactor cannot quietly change the screen.
 */
describe('Roles', () => {
  const listRoles = vi.fn();
  const listPermissions = vi.fn();

  beforeEach(() => {
    TestBed.resetTestingModule();
    listRoles.mockReset().mockResolvedValue(ROLES);
    listPermissions.mockReset().mockResolvedValue(PERMISSIONS);

    TestBed.configureTestingModule({
      imports: [Roles],
      providers: [{ provide: AdminApi, useValue: { listRoles, listPermissions } }],
    });
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(Roles);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders one card per role with its permissions', async () => {
    const element = await render();
    const text = element.textContent ?? '';

    expect(text).toContain('EDITOR');
    expect(text).toContain('admin.access');
    expect(text).toContain('2 of 3 permissions');
  });

  it('renders the permission catalogue with module, code, name and status', async () => {
    const element = await render();
    const text = element.textContent ?? '';

    expect(text).toContain('admin.access');
    expect(text).toContain('Panel access');
    expect(text).toContain('ACTIVE');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(PERMISSIONS.length);
  });

  it('names each module once, on the first row of its group', async () => {
    const element = await render();
    const text = element.textContent ?? '';

    // Both USERS rows are in the catalogue, but the group header is written once.
    expect(text.match(/USERS/g) ?? []).toHaveLength(1);
    expect(text.match(/ADMIN/g) ?? []).toHaveLength(1);
  });

  it('keeps the catalogue usable when it fails to load', async () => {
    listPermissions.mockRejectedValue({ code: 'network_error' });
    const element = await render();

    expect(element.textContent).toContain('network_error');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1); // the empty row
  });
});
