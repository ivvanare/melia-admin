import { Component, computed, inject, signal } from '@angular/core';
import type { ListQuery } from 'ng-crud-maker';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { AdminApi, type Role, type UserStatus, type UserSummary } from '../../core/admin-api';
import { AdminTransport } from '../../core/admin-transport';
import { apiErrorCode } from '../../core/api-error';
import { DataTable, type DataTableColumn, type DataTableTagVariant } from '../../shared/data-table/data-table';
import { DialogShell } from '../../shared/dialog-shell/dialog-shell';

const PAGE_SIZE = 20;

/** A status is a pill, and the pill's colour is the design system's decision, not this screen's. */
const STATUS_TAG: Record<UserStatus, DataTableTagVariant> = {
  ACTIVE: 'ok',
  INACTIVE: 'neutral',
  SUSPENDED: 'warn',
};

const SCOPES: readonly { label: string; value: string }[] = [
  { label: 'All accounts', value: '' },
  { label: 'Panel access', value: 'admin' },
  { label: 'App users', value: 'app' },
  { label: 'No role', value: 'none' },
];

/**
 * Users screen (S5): the listing, its search and its two filters.
 *
 * The API exposes no create, update or delete for an account, so nothing here pretends to: an
 * account is invited, then its roles are replaced and its name and status are edited. Ownership of
 * an address stays with its owner — an administrator never sets another person's password.
 */
@Component({
  selector: 'app-users',
  imports: [DataTable, DialogShell, NzButtonModule, NzModalModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  private readonly api = inject(AdminApi);
  private readonly transport = inject(AdminTransport);
  private readonly messages = inject(NzMessageService);

  protected readonly rows = signal<readonly UserSummary[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly listErrorCode = signal<string | null>(null);

  protected readonly search = signal('');
  protected readonly statusFilter = signal('');
  protected readonly scopeFilter = signal('');
  protected readonly scopes = SCOPES;
  protected readonly statuses: readonly UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  protected readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return '0 of 0';
    const start = (this.page() - 1) * PAGE_SIZE + 1;
    return `${start}–${Math.min(this.page() * PAGE_SIZE, total)} of ${total}`;
  });

  /**
   * The header line reads the total signal inside a `computed`, so it recomputes only when the
   * total changes — never once per change-detection pass.
   */
  protected readonly subtitle = computed(() => {
    const total = this.total();
    return `${total} ${total === 1 ? 'account' : 'accounts'} · roles are replaced, never merged`;
  });

  protected readonly emptyLabel = computed(() =>
    this.loading() ? 'Loading accounts…' : 'No account matches these filters.',
  );

  protected readonly columns: readonly DataTableColumn<UserSummary>[] = [
    { label: 'Name', value: (row) => row.name ?? '—' },
    { label: 'Email', value: (row) => row.email ?? '—', variant: 'mono' },
    {
      label: 'Status',
      tag: (row) => ({ label: row.status, variant: STATUS_TAG[row.status] }),
    },
    { label: 'Roles', value: (row) => (row.roles.length ? row.roles.join(', ') : 'no role') },
    { label: 'Created', value: (row) => row.created_at.slice(0, 10), variant: 'muted' },
  ];

  // ---- dialogs ------------------------------------------------------------

  protected readonly roles = signal<readonly Role[]>([]);
  protected readonly editingUser = signal<UserSummary | null>(null);
  protected readonly rolesModalOpen = signal(false);

  protected readonly profileUser = signal<UserSummary | null>(null);
  protected readonly profileModalOpen = signal(false);
  protected readonly profileName = signal('');
  protected readonly profileStatus = signal<UserStatus>('ACTIVE');
  protected readonly profileSaving = signal(false);
  protected readonly profileErrorCode = signal<string | null>(null);

  protected readonly inviteModalOpen = signal(false);
  protected readonly inviteEmail = signal('');
  protected readonly inviteName = signal('');
  protected readonly inviting = signal(false);
  protected readonly inviteErrorCode = signal<string | null>(null);

  protected readonly draftRoles = signal<readonly string[]>([]);
  protected readonly saving = signal(false);
  protected readonly saveErrorCode = signal<string | null>(null);

  /** Per-row feedback for the reset trigger: idle, sending, sent, or the API code. */
  protected readonly resettingId = signal<string | null>(null);
  protected readonly resetSentId = signal<string | null>(null);
  protected readonly resetErrorCode = signal<string | null>(null);

  constructor() {
    void this.load();
    void this.loadRoles();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.listErrorCode.set(null);
    try {
      // `status` and `scope` are the API's own filters; `q` searches name and email.
      const query: ListQuery = {
        page: this.page(),
        pageSize: PAGE_SIZE,
        // This API takes no sort parameter: a sort affordance would change state and return
        // the same order.
        sort: null,
        search: this.search().trim(),
        filters: {
          status_eq: this.statusFilter(),
          scope_eq: this.scopeFilter(),
        },
      };
      const result = await this.transport.list('admin/users', query);
      this.rows.set(result.rows as unknown as UserSummary[]);
      this.total.set(result.total);
    } catch (error) {
      this.listErrorCode.set((error as { code?: string }).code ?? 'network_error');
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

  protected openInvite(): void {
    this.inviteErrorCode.set(null);
    this.inviteEmail.set('');
    this.inviteName.set('');
    this.inviteModalOpen.set(true);
  }

  protected closeInvite(): void {
    this.inviteModalOpen.set(false);
    this.inviteErrorCode.set(null);
  }

  protected onInviteEmail(value: string): void {
    this.inviteEmail.set(value);
  }

  protected onInviteName(value: string): void {
    this.inviteName.set(value);
  }

  protected async sendInvite(): Promise<void> {
    if (this.inviting()) return;
    this.inviting.set(true);
    this.inviteErrorCode.set(null);
    try {
      const email = this.inviteEmail().trim();
      await this.api.inviteUser(email, this.inviteName().trim() || undefined);
      // 202 means "queued", never "they now have access", and the answer is identical
      // when the address already has an account — the panel is not an oracle.
      this.closeInvite();
      this.messages.success(`Invitation queued for ${email}`);
    } catch (error) {
      // Stay open with the code visible: closing would lose what was typed.
      this.inviteErrorCode.set(apiErrorCode(error));
    } finally {
      this.inviting.set(false);
    }
  }

  protected async sendReset(user: UserSummary): Promise<void> {
    if (this.resettingId() !== null) return;
    this.resettingId.set(user.id);
    this.resetErrorCode.set(null);
    this.resetSentId.set(null);
    try {
      await this.api.requestPasswordReset(user.id);
      this.resetSentId.set(user.id);
      this.messages.success(`Reset code sent to ${user.email ?? 'the user'}`);
    } catch (error) {
      this.resetErrorCode.set(apiErrorCode(error));
    } finally {
      this.resettingId.set(null);
    }
  }

  protected openRoles(user: UserSummary): void {
    this.saveErrorCode.set(null);
    this.editingUser.set(user);
    this.draftRoles.set([...user.roles]);
    this.rolesModalOpen.set(true);
  }

  protected closeRoles(): void {
    this.rolesModalOpen.set(false);
    this.editingUser.set(null);
    this.saveErrorCode.set(null);
  }

  protected openProfile(user: UserSummary): void {
    this.profileErrorCode.set(null);
    this.profileUser.set(user);
    this.profileName.set(user.name ?? '');
    this.profileStatus.set(user.status);
    this.profileModalOpen.set(true);
  }

  protected closeProfile(): void {
    this.profileModalOpen.set(false);
    this.profileUser.set(null);
    this.profileErrorCode.set(null);
  }

  protected onProfileName(value: string): void {
    this.profileName.set(value);
  }

  protected onProfileStatus(value: string): void {
    this.profileStatus.set(value as UserStatus);
  }

  protected async saveProfile(): Promise<void> {
    const user = this.profileUser();
    if (!user || this.profileSaving()) return;
    this.profileSaving.set(true);
    this.profileErrorCode.set(null);
    try {
      await this.api.updateUser(user.id, {
        name: this.profileName().trim(),
        status: this.profileStatus(),
      });
      await this.load();
      this.closeProfile();
      this.messages.success('User updated');
    } catch (error) {
      this.profileErrorCode.set(apiErrorCode(error));
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected isChecked(role: Role): boolean {
    return this.draftRoles().includes(role.name);
  }

  protected toggleRole(role: Role): void {
    const current = this.draftRoles();
    this.draftRoles.set(
      current.includes(role.name)
        ? current.filter((name) => name !== role.name)
        : [...current, role.name],
    );
  }

  /** The endpoint replaces the set, so exactly the checked names are sent. */
  protected async saveRoles(): Promise<void> {
    const user = this.editingUser();
    if (!user || this.saving()) return;
    this.saving.set(true);
    this.saveErrorCode.set(null);
    try {
      await this.api.setUserRoles(user.id, [...this.draftRoles()]);
      await this.load();
      this.closeRoles();
      this.messages.success('Roles updated');
    } catch (error) {
      this.saveErrorCode.set(apiErrorCode(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async loadRoles(): Promise<void> {
    try {
      this.roles.set(await this.api.listRoles());
    } catch {
      // The listing still works without the catalogue; the editor says so.
      this.roles.set([]);
    }
  }
}
