import { Component, input } from '@angular/core';

/**
 * Shared body structure for an ng-zorro dialog. The modal still owns the portal, focus and footer;
 * this shell only keeps the lead, errors and projected field columns consistent across screens.
 */
@Component({
  selector: 'app-dialog-shell',
  templateUrl: './dialog-shell.html',
  styleUrl: './dialog-shell.css',
})
export class DialogShell {
  readonly lead = input('');
  readonly errors = input<readonly string[]>([]);
  readonly errorCode = input<string | null>(null);
}
