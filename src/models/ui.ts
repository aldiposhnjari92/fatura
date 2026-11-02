export type ToastStatus = 'success' | 'error' | 'warning' | 'info';

export interface StatCellProps {
  label: string;
  /** No rule to the left of the first cell in the row. */
  first?: boolean;
  /** The dashboard runs the label at `text-sm`, the list a step down. */
  labelClass?: string;
  class?: string;
}
