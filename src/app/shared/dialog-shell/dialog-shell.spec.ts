import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DialogShell } from './dialog-shell';

@Component({
  imports: [DialogShell],
  template: `
    <app-dialog-shell [lead]="lead" [errors]="errors" [errorCode]="errorCode">
      <span slot="error-message">The change was rejected:</span>
      <div slot="left" class="col">
        <label for="left-field">Left field</label>
        <input id="left-field" />
      </div>
      <div slot="right" class="col">
        <p>Right field</p>
      </div>
    </app-dialog-shell>
  `,
})
class DialogShellHost {
  lead = '';
  errors: readonly string[] = [];
  errorCode: string | null = null;
}

describe('DialogShell', () => {
  async function render(host: DialogShellHost): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(DialogShellHost);
    fixture.componentInstance.lead = host.lead;
    fixture.componentInstance.errors = host.errors;
    fixture.componentInstance.errorCode = host.errorCode;
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the lead only when one is supplied', async () => {
    const host = new DialogShellHost();
    const withoutLead = await render(host);
    expect(withoutLead.querySelector('.dialog > .lead')).toBeNull();

    host.lead = 'ana@melia.test';
    const withLead = await render(host);
    expect(withLead.querySelector('.dialog > .lead')?.textContent).toContain('ana@melia.test');
  });

  it('lists validation errors and exposes the API error code', async () => {
    const host = new DialogShellHost();
    host.errors = ['Title is required.', 'Latitude is invalid.'];
    host.errorCode = 'permission_denied';
    const element = await render(host);

    const alert = element.querySelector('.dialog > .alert');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('Title is required.');
    expect(alert?.textContent).toContain('Latitude is invalid.');
    const saveError = element.querySelector('.dialog > .save-error');
    expect(saveError?.getAttribute('role')).toBe('alert');
    expect(saveError?.textContent).toContain('The change was rejected:');
    expect(saveError?.querySelector('code')?.textContent).toBe('permission_denied');
  });

  it('projects the left and right elements into the two columns', async () => {
    const host = new DialogShellHost();
    const element = await render(host);

    const columns = element.querySelector('.dialog > .columns');
    expect(columns?.querySelector('[slot="left"] #left-field')).not.toBeNull();
    expect(columns?.querySelector('[slot="right"]')?.textContent).toContain('Right field');
  });
});
