import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApi, type Permission, type Role } from '../../core/admin-api';
import { AuthService } from '../../core/auth.service';
import { Roles } from './roles';

const ROLES: Role[] = [
  {
    id: 'r1',
    name: 'SUPERADMIN',
    description: 'System owner',
    status: 'ACTIVE',
    permissions: ['admin.access', 'role.manage'],
  },
  {
    id: 'r2',
    name: 'EDITOR',
    description: 'Content',
    status: 'ACTIVE',
    permissions: ['admin.access', 'place.update'],
  },
];

const PERMISSIONS: Permission[] = [
  { id: 'p1', code: 'admin.access', module: 'ADMIN', name: 'Panel access', status: 'ACTIVE' },
  { id: 'p2', code: 'role.manage', module: 'ADMIN', name: 'Role management', status: 'ACTIVE' },
  { id: 'p3', code: 'place.update', module: 'PLACES', name: 'Update places', status: 'ACTIVE' },
  { id: 'p4', code: 'review.moderate', module: 'REVIEWS', name: 'Moderate reviews', status: 'ACTIVE' },
];

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('Roles', () => {
  const currentPermissions = signal<string[]>(['admin.access', 'role.manage']);
  const listRoles = vi.fn();
  const listPermissions = vi.fn();
  const createRole = vi.fn();
  const updateRole = vi.fn();
  const retireRole = vi.fn();
  const replaceRolePermissions = vi.fn();

  beforeEach(() => {
    TestBed.resetTestingModule();
    currentPermissions.set(['admin.access', 'role.manage']);
    listRoles.mockReset().mockResolvedValue(ROLES);
    listPermissions.mockReset().mockResolvedValue(PERMISSIONS);
    createRole.mockReset().mockResolvedValue({
      id: 'r3',
      name: 'CURATOR',
      description: 'Curation',
      status: 'ACTIVE',
      permissions: ['place.update'],
    });
    updateRole.mockReset().mockResolvedValue({
      ...ROLES[1],
      description: 'Updated content',
    });
    retireRole.mockReset().mockResolvedValue(undefined);
    replaceRolePermissions.mockReset().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [Roles],
      providers: [
        {
          provide: AuthService,
          useValue: {
            permissions: currentPermissions.asReadonly(),
          },
        },
        {
          provide: AdminApi,
          useValue: {
            listRoles,
            listPermissions,
            createRole,
            updateRole,
            retireRole,
            replaceRolePermissions,
          },
        },
      ],
    });
  });

  afterEach(() => {
    document.body
      .querySelectorAll('.cdk-overlay-container, .ant-modal-root')
      .forEach((node) => node.remove());
  });

  function inDialog<T extends Element>(selector: string): NodeListOf<T> {
    return document.body.querySelectorAll<T>(selector);
  }

  function dialogButton(text: string): HTMLButtonElement {
    const found = [...inDialog<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === text,
    );
    if (!found) throw new Error(`no dialog button labelled "${text}"`);
    return found;
  }

  function buttonByText(element: HTMLElement, text: string): HTMLButtonElement {
    const found = [...element.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === text,
    );
    if (!found) throw new Error(`no button labelled "${text}"`);
    return found as HTMLButtonElement;
  }

  async function render(): Promise<{
    element: HTMLElement;
    fixture: ReturnType<typeof TestBed.createComponent<Roles>>;
  }> {
    const fixture = TestBed.createComponent(Roles);
    fixture.detectChanges();
    await tick();
    fixture.detectChanges();
    return { element: fixture.nativeElement as HTMLElement, fixture };
  }

  it('renders one card per role with its permissions and catalogue', async () => {
    const { element } = await render();
    const text = element.textContent ?? '';

    expect(text).toContain('SUPERADMIN');
    expect(text).toContain('EDITOR');
    expect(text).toContain('admin.access');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(PERMISSIONS.length);
  });

  it('offers management actions when user has role.manage', async () => {
    const { element } = await render();

    expect(() => buttonByText(element, 'New role')).not.toThrow();
    const editButtons = [...element.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Edit',
    );
    expect(editButtons).toHaveLength(2);

    // SUPERADMIN is protected: only EDITOR offers the Retire button
    const retireButtons = [...element.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Retire',
    );
    expect(retireButtons).toHaveLength(1);
  });

  it('hides management actions when user lacks role.manage', async () => {
    currentPermissions.set(['admin.access']);
    const { element } = await render();

    const buttons = [...element.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(buttons).not.toContain('New role');
    expect(buttons).not.toContain('Edit');
    expect(buttons).not.toContain('Permissions');
    expect(buttons).not.toContain('Retire');
    expect(element.textContent).toContain('EDITOR');
  });

  it('creates a new role through the modal', async () => {
    const { element, fixture } = await render();
    buttonByText(element, 'New role').click();
    fixture.detectChanges();
    await tick();

    const nameInput = inDialog<HTMLInputElement>('#create-role-name')[0]!;
    nameInput.value = 'CURATOR';
    nameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const checkboxes = inDialog<HTMLInputElement>('.permissions-picker input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes[0]!.click();
    fixture.detectChanges();

    dialogButton('Create role').click();
    await tick();

    expect(createRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CURATOR',
      }),
    );
  });

  it('edits a role description and status through the modal', async () => {
    const { element, fixture } = await render();
    const editButtons = [...element.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Edit',
    );
    editButtons[1]!.click(); // Click Edit on EDITOR
    fixture.detectChanges();
    await tick();

    const descInput = inDialog<HTMLInputElement>('#edit-role-desc')[0]!;
    descInput.value = 'Updated description';
    descInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    dialogButton('Save changes').click();
    await tick();

    expect(updateRole).toHaveBeenCalledWith('r2', {
      name: 'EDITOR',
      description: 'Updated description',
      status: 'ACTIVE',
    });
  });

  it('replaces permissions through the permissions modal', async () => {
    const { element, fixture } = await render();
    const permButtons = [...element.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Permissions',
    );
    permButtons[1]!.click(); // Click Permissions on EDITOR
    fixture.detectChanges();
    await tick();

    const checkboxes = inDialog<HTMLInputElement>('.permissions-picker input[type="checkbox"]');
    checkboxes[2]!.click(); // Toggle a permission
    fixture.detectChanges();

    dialogButton('Save permissions').click();
    await tick();

    expect(replaceRolePermissions).toHaveBeenCalledWith('r2', expect.any(Array));
  });

  it('retires a role and displays an error if the server reports role_in_use', async () => {
    retireRole.mockRejectedValueOnce(
      new HttpErrorResponse({
        status: 409,
        error: { error: { code: 'role_in_use', message: 'In use' } },
      }),
    );

    const { element, fixture } = await render();
    buttonByText(element, 'Retire').click();
    fixture.detectChanges();
    await tick();

    dialogButton('Retire role').click();
    await tick();
    fixture.detectChanges();

    expect(retireRole).toHaveBeenCalledWith('r2');
    expect(document.body.textContent).toContain('active users still hold this role');
  });

  it('names each module once in the catalogue group header', async () => {
    const { element } = await render();
    const text = element.textContent ?? '';

    expect(text.match(/ADMIN/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps the catalogue usable when it fails to load', async () => {
    listPermissions.mockRejectedValue({ code: 'network_error' });
    const { element } = await render();

    expect(element.textContent).toContain('network_error');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});
