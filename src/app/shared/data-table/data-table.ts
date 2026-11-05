import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, TemplateRef } from '@angular/core';

export interface DataTableCell {
  text: string;
  variant?: 'muted' | 'mono';
}

/** The design system's `.tag` variants; a status never invents a colour of its own. */
export type DataTableTagVariant = 'ok' | 'warn' | 'info' | 'neutral' | 'danger';

export interface DataTableTag {
  label: string;
  variant: DataTableTagVariant;
}

export interface DataTableColumn<T> {
  label: string;
  /** Text column. Omitted when the column renders a tag instead. */
  value?: (row: T) => string | number | null;
  variant?: 'muted' | 'mono';
  align?: 'left' | 'right';
  /**
   * A pill instead of text. Declarative on purpose: it is one of the design system's own
   * components, so it is a variant of the table rather than an escape hatch per cell.
   */
  tag?: (row: T) => DataTableTag | null;
}

/**
 * The panel's text-only table. Keeping cells as values rather than templates means a screen must
 * make an explicit product decision before introducing a second visual language for its rows.
 * The global panel stylesheet owns the frame so this component stays useful in every panel host.
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
})
export class DataTable<T> {
  readonly rows = input.required<readonly T[]>();
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly caption = input('');
  readonly empty = input('');
  readonly rowActions = input<TemplateRef<{ $implicit: T }> | undefined>(undefined);

  /** The empty row spans the same number of cells as a populated row, including row actions. */
  protected readonly colspan = computed(() => this.columns().length + (this.rowActions() ? 1 : 0));

  protected cellText(column: DataTableColumn<T>, row: T): string | number | null {
    return column.value ? column.value(row) : '';
  }

  protected cellTag(column: DataTableColumn<T>, row: T): DataTableTag | null {
    return column.tag ? column.tag(row) : null;
  }
}
