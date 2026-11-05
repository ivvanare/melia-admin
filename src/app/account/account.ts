import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApi, type NotificationPreference } from '../core/admin-api';
import { AuthService } from '../core/auth.service';

/**
 * The first real screen (S1): it renders what `GET /v1/me` returned, so it proves the
 * whole path end to end — login, session transport, interceptor, protected read — and
 * gives the operator somewhere to end the session.
 */
@Component({
  selector: 'app-account',
  imports: [RouterLink],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AdminApi);

  /**
   * Notification kinds and their switches. The API returns the whole catalogue and treats an absent
   * row as enabled, so this list is what decides which switches exist — never a hardcoded pair.
   */
  protected readonly preferences = signal<readonly NotificationPreference[]>([]);
  protected readonly preferencesLoading = signal(true);
  protected readonly preferencesErrorCode = signal<string | null>(null);
  /** The kind currently being written, so only that switch is locked. */
  protected readonly savingKind = signal<string | null>(null);

  /** `form` asks for the new address, `code` proves it, `done` closes the session. */
  protected readonly emailStep = signal<'form' | 'code' | 'done'>('form');
  protected readonly newEmail = signal('');
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly sentTo = signal('');
  protected readonly submitting = signal(false);
  protected readonly errorCode = signal<string | null>(null);

  protected readonly canConfirm = computed(() => /^\d{6}$/.test(this.code()));

  constructor() {
    void this.loadPreferences();
  }

  private async loadPreferences(): Promise<void> {
    this.preferencesLoading.set(true);
    this.preferencesErrorCode.set(null);
    try {
      this.preferences.set(await this.api.getNotificationPreferences());
    } catch (error) {
      this.preferences.set([]);
      this.preferencesErrorCode.set(apiErrorCode(error));
    } finally {
      this.preferencesLoading.set(false);
    }
  }

  /**
   * Writes one switch and re-reads the catalogue, so the control shows what the server confirmed.
   * On refusal the element goes back to its previous value: a bound property that did not change
   * is invisible to change detection, so a rejected write would otherwise keep claiming success.
   */
  protected async togglePreference(
    preference: NotificationPreference,
    enabled: boolean,
    input: HTMLInputElement,
  ): Promise<void> {
    if (this.savingKind() !== null) return;
    this.savingKind.set(preference.kind);
    this.preferencesErrorCode.set(null);
    try {
      await this.api.setNotificationPreference(preference.kind, enabled);
      await this.loadPreferences();
    } catch (error) {
      input.checked = preference.enabled;
      this.preferencesErrorCode.set(apiErrorCode(error));
    } finally {
      this.savingKind.set(null);
    }
  }

  protected async requestChange(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.newEmail().trim();
    if (this.submitting() || email === '' || this.password() === '') return;

    this.submitting.set(true);
    this.errorCode.set(null);
    try {
      await this.auth.requestEmailChange(email, this.password());
      // The code was mailed to the new address, which is what the screen must say.
      this.sentTo.set(email);
      this.password.set('');
      this.emailStep.set('code');
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async confirmChange(event: Event): Promise<void> {
    event.preventDefault();
    if (this.submitting() || !this.canConfirm()) return;

    this.submitting.set(true);
    this.errorCode.set(null);
    try {
      await this.auth.confirmEmailChange(this.code());
      this.emailStep.set('done');
    } catch (error) {
      this.errorCode.set(apiErrorCode(error));
    } finally {
      this.submitting.set(false);
    }
  }

  protected backToForm(): void {
    this.emailStep.set('form');
    this.code.set('');
    this.errorCode.set(null);
  }

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}

/** Clients parse `error.code`, never `message` (`api/API.md` §1). */
function apiErrorCode(error: unknown): string {
  const code = (error as { error?: { error?: { code?: unknown } } })?.error?.error?.code;
  return typeof code === 'string' && code !== '' ? code : 'network_error';
}
