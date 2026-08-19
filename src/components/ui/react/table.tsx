import * as React from 'react';
import { cn } from '@/lib/utils';

/*
  Defaults here mirror src/components/ui/table/*.astro one for one, so a table
  looks the same whether the page renders it on the server or an island does.
  Change a padding or a hover state in one and change it in the other.
*/

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  /* Class for the scroll container, e.g. hiding the table below `sm`. */
  containerClass?: string;
};

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClass, ...props }, ref) => (
    <div data-slot="table-container" className={cn('w-full overflow-x-auto', containerClass)}>
      <table
        ref={ref}
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    data-slot="table-header"
    className={cn('bg-muted/40 [&_tr]:border-b', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} data-slot="table-body" className={cn('divide-y', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    data-slot="table-row"
    className={cn('hover:bg-muted/40 transition-colors', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    data-slot="table-head"
    className={cn(
      'text-muted-foreground px-5 py-3 text-left text-xs font-medium',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    data-slot="table-cell"
    className={cn('px-5 py-3.5 align-middle', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
