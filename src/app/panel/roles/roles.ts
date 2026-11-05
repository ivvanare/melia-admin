import { Component, computed, inject, signal } from '@angular/core';
import { AdminApi, type Permission, type Role } from '../../core/admin-api';
import { apiErrorCode } from '../../core/api-error';
import { DataTable, type DataTableColumn, type DataTableTagVariant } from '../../shared/data-table/data-table';

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
 * Roles and the permission catalogue, read-only (S4): the API lets a role be
 * assigned to a user, not edited here, so showing mutation controls would be a
 * button that always fails. The two lists answer the question the screen exists
 * for — which role grants what.
 */
@Component({
  selector: 'app-roles',
  imports: [DataTable],
  templateUrl: './roles.html',
  styleUrl: './roles.css',
})
export class Roles {
  private readonly api = inject(AdminApi);

  protected readonly roles = signal<readonly Role[]>([]);
  protected readonly permissions = signal<readonly Permission[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorCode = signal<string | null>(null);

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
}
