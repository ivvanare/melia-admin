import { Component, computed, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { AdminApi, type Permission, type Role } from '../../core/admin-api';
import { apiErrorCode } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { DataTable, type DataTableColumn, type DataTableTagVariant } from '../../shared/data-table/data-table';
import { DialogShell } from '../../shared/dialog-shell/dialog-shell';

/** One catalogue row, flattened so the table can stay a value-driven component. */
interface CatalogueRow {
  module: string;
  /** The module name is written once per group, on its first row. */
  showModule: boolean;
  code: string;
  name: string;
  status: Permission['status'];
}

const STATUS_TAG: Record<Permission['status'], DataTableTagVariant> = {
  ACTIVE: 'ok',
  INACTIVE: 'neutral',
};

/**
 * Roles and the permission catalogue (S1–S7).
 *
 * Role authoring is gated by `role.manage` (S1): creating, editing, retiring, and replacing
 * permissions require this capability. Sessions with only `admin.access` view the read-only
 * catalogues to understand capabilities and assign roles in the Users module.
 *
 * `SUPERADMIN` is protected by system rules (S6): it cannot be renamed, deactivated, retired,
 * or stripped of `role.manage`.
 */
@Component({
  selector: 'app-roles',
  imports: [DataTable, DialogShell, NzButtonModule, NzModalModule],
  templateUrl: './roles.html',
  styleUrl: './roles.css',
})
export class Roles {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);
  private readonly messages = inject(NzMessageService);

  protected readonly roles = signal<readonly Role[]>([]);
  protected readonly permissions = signal<readonly Permission[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<string | null>(null);

  /**
   * Role management is guarded by `role.manage`. Sessions without it see the
   * read-only catalogue and cannot author or mutate roles.
   */
  protected readonly canManage = computed(() =>
    this.auth.permissions().includes('role.manage'),
  );

  /** Permission catalogue grouped by module, the way the API orders it. */
  protected readonly grouped = computed(() => {
    const buckets = new Map<string, Permission[]>();
    for (const permission of this.permissions()) {
      const bucket = buckets.get(permission.module) ?? [];
      bucket.push(permission);
      buckets.set(permission.module, bucket);
    }
    return [...buckets.entries()]
      .map(([module, items]) => ({ module, items }))
      .sort((a, b) => a.module.localeCompare(b.module));
  });

  /**
   * The same catalogue as a flat list. A base-table cell renders a value, so the module name
   * travels as a flag instead of as markup: the component decides nothing about grouping.
   */
  protected readonly catalogueRows = computed<readonly CatalogueRow[]>(() =>
    this.grouped().flatMap((group) =>
      group.items.map((permission, index) => ({
        module: group.module,
        showModule: index === 0,
        code: permission.code,
        name: permission.name,
        status: permission.status,
      })),
    ),
  );

  protected readonly catalogueColumns: readonly DataTableColumn<CatalogueRow>[] = [
    { label: 'Module', value: (row) => (row.showModule ? row.module : '') },
    { label: 'Code', value: (row) => row.code, variant: 'mono' },
    { label: 'Name', value: (row) => row.name },
    {
      label: 'Status',
      tag: (row) => ({ label: row.status, variant: STATUS_TAG[row.status] }),
    },
  ];

  protected readonly emptyCatalogue = computed(() =>
    this.loading() ? 'Loading permissions…' : 'The catalogue is empty.',
  );

  // ---- Create role modal --------------------------------------------------

  protected readonly createOpen = signal(false);
  protected readonly createName = signal('');
  protected readonly createDescription = signal('');
  protected readonly createPermissions = signal<readonly string[]>([]);
  protected readonly creating = signal(false);
  protected readonly createErrorCode = signal<string | null>(null);

  // ---- Edit role modal ----------------------------------------------------

  protected readonly editingRole = signal<Role | null>(null);
  protected readonly editOpen = signal(false);
  protected readonly editName = signal('');
  protected readonly editDescription = signal('');
  protected readonly editStatus = signal<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  protected readonly savingEdit = signal(false);
  protected readonly editErrorCode = signal<string | null>(null);

  // ---- Permissions modal --------------------------------------------------

  protected readonly permissionsRole = signal<Role | null>(null);
  protected readonly permissionsOpen = signal(false);
  protected readonly draftPermissions = signal<readonly string[]>([]);
  protected readonly savingPermissions = signal(false);
  protected readonly permissionsErrorCode = signal<string | null>(null);

  // ---- Retire modal -------------------------------------------------------

  protected readonly retireTarget = signal<Role | null>(null);
  protected readonly retireOpen = signal(false);
  protected readonly retiring = signal(false);
  protected readonly retireErrorCode = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorCode.set(null);
    try {
      const [roles, permissions] = await Promise.all([
        this.api.listRoles(),
        this.api.listPermissions(),
      ]);
      this.roles.set(roles);
      this.permissions.set(permissions);
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.loading.set(false);
    }
  }

  // ---- Create -------------------------------------------------------------

  protected openCreate(): void {
    this.createName.set('');
    this.createDescription.set('');
    this.createPermissions.set([]);
    this.createErrorCode.set(null);
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    this.createOpen.set(false);
    this.createErrorCode.set(null);
  }

  protected toggleCreatePermission(code: string): void {
    const current = this.createPermissions();
    this.createPermissions.set(
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
    );
  }

  protected isCreatePermissionChecked(code: string): boolean {
    return this.createPermissions().includes(code);
  }

  protected async saveCreate(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    this.createErrorCode.set(null);
    try {
      await this.api.createRole({
        name: this.createName().trim(),
        description: this.createDescription().trim() || null,
        permissions: [...this.createPermissions()],
      });
      await this.load();
      this.closeCreate();
      this.messages.success('Role created');
    } catch (error) {
      this.createErrorCode.set(apiErrorCode(error));
    } finally {
      this.creating.set(false);
    }
  }

  // ---- Edit ---------------------------------------------------------------

  protected openEdit(role: Role): void {
    this.editingRole.set(role);
    this.editName.set(role.name);
    this.editDescription.set(role.description ?? '');
    this.editStatus.set(role.status);
    this.editErrorCode.set(null);
    this.editOpen.set(true);
  }

  protected closeEdit(): void {
    this.editOpen.set(false);
    this.editingRole.set(null);
    this.editErrorCode.set(null);
  }

  protected async saveEdit(): Promise<void> {
    const role = this.editingRole();
    if (!role || this.savingEdit()) return;
    this.savingEdit.set(true);
    this.editErrorCode.set(null);
    try {
      await this.api.updateRole(role.id, {
        name: role.name === 'SUPERADMIN' ? undefined : this.editName().trim(),
        description: this.editDescription().trim() || null,
        status: role.name === 'SUPERADMIN' ? undefined : this.editStatus(),
      });
      await this.load();
      this.closeEdit();
      this.messages.success('Role updated');
    } catch (error) {
      this.editErrorCode.set(apiErrorCode(error));
    } finally {
      this.savingEdit.set(false);
    }
  }

  // ---- Permissions --------------------------------------------------------

  protected openPermissions(role: Role): void {
    this.permissionsRole.set(role);
    this.draftPermissions.set([...role.permissions]);
    this.permissionsErrorCode.set(null);
    this.permissionsOpen.set(true);
  }

  protected closePermissions(): void {
    this.permissionsOpen.set(false);
    this.permissionsRole.set(null);
    this.permissionsErrorCode.set(null);
  }

  protected toggleDraftPermission(code: string): void {
    const role = this.permissionsRole();
    if (role?.name === 'SUPERADMIN' && code === 'role.manage') return;
    const current = this.draftPermissions();
    this.draftPermissions.set(
      current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
    );
  }

  protected isDraftPermissionChecked(code: string): boolean {
    return this.draftPermissions().includes(code);
  }

  protected isDraftPermissionLocked(code: string): boolean {
    return this.permissionsRole()?.name === 'SUPERADMIN' && code === 'role.manage';
  }

  protected async savePermissions(): Promise<void> {
    const role = this.permissionsRole();
    if (!role || this.savingPermissions()) return;
    this.savingPermissions.set(true);
    this.permissionsErrorCode.set(null);
    try {
      await this.api.replaceRolePermissions(role.id, [...this.draftPermissions()]);
      await this.load();
      this.closePermissions();
      this.messages.success('Permissions updated');
    } catch (error) {
      this.permissionsErrorCode.set(apiErrorCode(error));
    } finally {
      this.savingPermissions.set(false);
    }
  }

  // ---- Retire -------------------------------------------------------------

  protected openRetire(role: Role): void {
    if (role.name === 'SUPERADMIN') return;
    this.retireTarget.set(role);
    this.retireErrorCode.set(null);
    this.retireOpen.set(true);
  }

  protected closeRetire(): void {
    this.retireOpen.set(false);
    this.retireTarget.set(null);
    this.retireErrorCode.set(null);
  }

  protected async confirmRetire(): Promise<void> {
    const role = this.retireTarget();
    if (!role || this.retiring()) return;
    this.retiring.set(true);
    this.retireErrorCode.set(null);
    try {
      await this.api.retireRole(role.id);
      await this.load();
      this.closeRetire();
      this.messages.success('Role retired');
    } catch (error) {
      this.retireErrorCode.set(apiErrorCode(error));
    } finally {
      this.retiring.set(false);
    }
  }
}
