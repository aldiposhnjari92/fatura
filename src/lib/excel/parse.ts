import { translate } from '@/lib/i18n';
import { cellToIso, toNumber, toStatus, toText } from './cells';
import { missingFields } from './mapping';
import type { ColumnMapping, ExcelColumnKey, ParsedInvoice, ParseResult, RowProblem, WorkbookSheet } from '@/models/excel';

/*
  Rows into invoices. Rows are grouped by invoice number; a row with no number
  continues the invoice above it.
*/

/** Turn the sheet into invoices using the given mapping, plus everything that could not be read. */
export function parseInvoiceRows(
  sheet: WorkbookSheet,
  headerIndex: number,
  mapping: ColumnMapping
): ParseResult {
  const rows = sheet.rows;
  const missing = missingFields(mapping);
  if (missing.length > 0) {
    const names = missing.map((f) => f.label).join(', ');
    return {
      invoices: [],
      problems: [{ row: headerIndex + 1, message: translate('xls.errMissingColumns', { columns: names }) }],
    };
  }

  const get = (row: unknown[], key: ExcelColumnKey) => {
    const index = mapping[key];
    return index === undefined ? null : row[index];
  };

  const byNumber = new Map<string, ParsedInvoice>();
  const broken = new Set<string>();
  const problems: RowProblem[] = [];
  let current: ParsedInvoice | null = null;

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    if (!row.some((cell) => toText(cell) !== '')) continue;

    const number = toText(get(row, 'number'));
    const report = (message: string) => problems.push({ row: rowNumber, message });

    let invoice: ParsedInvoice | null;
    if (!number) {
      // A line with no number belongs to the invoice above it.
      if (!current) {
        report(translate('xls.errNoNumber'));
        continue;
      }
      invoice = current;
    } else if (byNumber.has(number)) {
      invoice = byNumber.get(number)!;
    } else if (broken.has(number)) {
      continue;
    } else {
      const clientName = toText(get(row, 'client'));
      const issueDate = cellToIso(get(row, 'issueDate'));
      const rawDue = get(row, 'dueDate');
      const dueDate = cellToIso(rawDue);
      const status = toStatus(get(row, 'status'));
      const vat = toNumber(get(row, 'vat')) ?? 0;
      const discount = toNumber(get(row, 'discount')) ?? 0;

      const error = !clientName
        ? translate('xls.errNoClient')
        : !issueDate
          ? translate('xls.errBadIssueDate')
          : toText(rawDue) && !dueDate
            ? translate('xls.errBadDueDate')
            : !status
              ? translate('xls.errBadStatus', { value: toText(get(row, 'status')) })
              : vat < 0 || vat > 100
                ? translate('xls.errBadVat')
                : discount < 0
                  ? translate('xls.errBadDiscount')
                  : null;

      if (error) {
        report(`${number}: ${error}`);
        broken.add(number);
        current = null;
        continue;
      }

      invoice = {
        row: rowNumber,
        invoice_number: number,
        client: {
          name: clientName,
          nipt: toText(get(row, 'clientNipt')) || null,
          email: toText(get(row, 'clientEmail')) || null,
          address: toText(get(row, 'clientAddress')) || null,
        },
        issue_date: issueDate!,
        due_date: dueDate,
        status: status!,
        paid_at: status === 'paid' ? cellToIso(get(row, 'paidAt')) : null,
        vat_percent: Math.round(vat),
        discount: Math.round(discount),
        notes: toText(get(row, 'notes')) || null,
        items: [],
      };
      byNumber.set(number, invoice);
    }
    current = invoice;

    const description = toText(get(row, 'description'));
    const quantity = toNumber(get(row, 'quantity'));
    let price = toNumber(get(row, 'price'));
    // A sheet that only records what each line came to: the unit price is
    // worked back from it, so the recomputed total lands on the same number.
    const amount = toNumber(get(row, 'amount'));
    if (price == null && amount != null) {
      price = quantity ? Math.round((amount / quantity) * 100) / 100 : amount;
    }
    // Neither a description nor a price is an invoice's own row, not a line.
    if (!description && !price) continue;
    if ((quantity ?? 1) < 0 || (price ?? 0) < 0) {
      report(`${invoice.invoice_number}: ${translate('xls.errNegativeLine')}`);
      continue;
    }
    invoice.items.push({
      description: description || translate('xls.defaultItem'),
      quantity: quantity ?? 1,
      price: price ?? 0,
    });
  }

  const invoices: ParsedInvoice[] = [];
  for (const invoice of byNumber.values()) {
    if (invoice.items.length === 0) {
      problems.push({
        row: invoice.row,
        message: `${invoice.invoice_number}: ${translate('xls.errNoItems')}`,
      });
    } else {
      invoices.push(invoice);
    }
  }

  problems.sort((a, b) => a.row - b.row);
  return { invoices, problems };
}
