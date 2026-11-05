import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DataTable, type DataTableColumn } from './data-table';

interface Row {
  name: string;
  code: string;
}

const COLUMNS: readonly DataTableColumn<Row>[] = [
  { label: 'Name', value: (row) => row.name },
  { label: 'Code', value: (row) => row.code, variant: 'mono', align: 'right' },
];

@Component({
  imports: [DataTable],
  template: `
    <ng-template #actions let-row>
      <button class="row-action" type="button">{{ row.name }}</button>
    </ng-template>
    <app-data-table
      [rows]="rows"
      [columns]="columns"
      caption="Example rows"
      empty="No example rows"
      [rowActions]="showActions ? actions : undefined"
    />
  `,
})
class DataTableHost {
  readonly columns = COLUMNS;
  rows: readonly Row[] = [];
  showActions = false;
}

describe('DataTable', () => {
  async function render(host: DataTableHost): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(DataTableHost);
    fixture.componentInstance.rows = host.rows;
    fixture.componentInstance.showActions = host.showActions;
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders columns in order and applies their cell variants and alignment', async () => {
    const host = new DataTableHost();
    host.rows = [{ name: 'Alpha', code: 'A-1' }];
    const element = await render(host);

    const headers = [...element.querySelectorAll('thead th')].map((cell) =>
      cell.textContent?.trim(),
    );
    expect(headers).toEqual(['Name', 'Code']);
    const cells = element.querySelectorAll('tbody td');
    expect(cells[0]?.textContent?.trim()).toBe('Alpha');
    expect(cells[1]?.textContent?.trim()).toBe('A-1');
    expect(cells[1]?.classList).toContain('mono');
    expect(cells[1]?.classList).toContain('right');
    expect(element.querySelector('caption')?.textContent).toContain('Example rows');
  });

  it('uses the full column count, including actions, for the empty state', async () => {
    const host = new DataTableHost();
    host.showActions = true;
    const element = await render(host);

    const empty = element.querySelector<HTMLTableCellElement>('tbody td.empty');
    expect(empty?.textContent?.trim()).toBe('No example rows');
    expect(empty?.getAttribute('colspan')).toBe('3');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('renders the actions column only with a template and gives it the row', async () => {
    const host = new DataTableHost();
    host.rows = [{ name: 'Alpha', code: 'A-1' }];
    const withoutActions = await render(host);
    expect(withoutActions.querySelector('th.actions')).toBeNull();
    expect(withoutActions.querySelector('td.actions')).toBeNull();

    host.showActions = true;
    const withActions = await render(host);
    expect(withActions.querySelector('th.actions')).not.toBeNull();
    expect(withActions.querySelector('td.actions .row-action')?.textContent?.trim()).toBe('Alpha');
  });
});
