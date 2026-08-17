/**
 * 100% client-side PDF generation. Nothing here ever runs on a server — no
 * Edge Function, no API route, no cost per invoice. The user's browser does
 * all the work, which is exactly why Fatura.co can run at $0 marginal cost.
 */
import { computeTotals, type Client, type Invoice, type Profile } from './types';
import { groupThousands } from './utils';
import { invoiceStrings } from './i18n';

/*
  Layout is tuned so the items table gets as much of the page as possible: the
  header, party blocks, notes and footer are all kept deliberately tight. Row
  padding matters most — every millimetre trimmed there is paid back on every
  single line item, which is what decides how many products fit on page one.
*/
const MARGIN = 14;
/** 40x40 points, expressed in mm — jsPDF is set up in mm here. */
const LOGO_BOX = 40 * 0.3528;
/** 1px in mm at 96dpi — for gaps that are easier to reason about in pixels. */
const PX = 0.2646;
const PAGE_W = 210; // A4 mm

/*
  Paper palette. #00ADB5 measures 2.75:1 on white, so it is used only as a
  fill behind dark text or as a rule — never as small text on the page, and
  never behind white text. Headings and the totals use the deepened teal
  (#00767D, 5.40:1 on white), which stays on-brand and prints legibly.
*/
const BRAND: [number, number, number] = [0, 173, 181]; // #00ADB5 — fills, rules
const BRAND_DEEP: [number, number, number] = [0, 118, 125]; // #00767D — text
const INK: [number, number, number] = [34, 40, 49]; // #222831
const SLATE: [number, number, number] = [57, 62, 70]; // #393E46
const MUTED: [number, number, number] = [110, 118, 129];
const HAIRLINE: [number, number, number] = [222, 226, 230];
const PAID: [number, number, number] = [4, 120, 87];
const OVERDUE: [number, number, number] = [180, 35, 40];

export interface InvoicePdfInput {
  invoice: Pick<
    Invoice,
    | 'invoice_number'
    | 'issue_date'
    | 'due_date'
    | 'items'
    | 'vat_percent'
    | 'discount'
    | 'status'
    | 'notes'
  >;
  profile: Partial<Profile> | null;
  client: Partial<Client> | null;
}

/**
 * Money on the PDF: grouped thousands, no decimals. Shares groupThousands()
 * with the on-screen editor so paper and screen can never disagree — and it
 * avoids Intl, which resolves to en-US ("45,000") on browsers that ship no
 * Albanian locale data. The NBSP separator is 0xA0 in WinAnsi, so it renders.
 */
function money(n: number): string {
  return groupThousands(n);
}

function prettyDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/**
 * Pull the logo into a data URL. Runs in the browser against the public
 * `logos` bucket. A failure here must never block the PDF — we just skip it.
 */
async function loadLogo(
  url: string | null | undefined
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!url) return null;
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size > 3_000_000) return null;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('logo decode failed'));
      img.src = dataUrl;
    });

    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

/**
 * jspdf's ESM build exports `jsPDF` as a *named* export with no default, while
 * jspdf-autotable ships CJS — and depending on who does the interop (Vite,
 * esbuild, Node) its function lands one or two `default` hops down. Walk the
 * chain instead of guessing, or the PDF silently fails to build.
 */
function unwrapDefault<T>(mod: unknown): T | undefined {
  let value: any = mod;
  for (let hop = 0; hop < 3; hop += 1) {
    if (typeof value === 'function') return value as T;
    if (!value || typeof value.default === 'undefined') break;
    value = value.default;
  }
  return value as T | undefined;
}

/**
 * Raised when the jsPDF chunk itself cannot be fetched — distinct from the PDF
 * failing to render.
 *
 * The engine is code-split and only pulled in on first use, which can be many
 * minutes into a session. By then the chunk URL may be gone: in production a
 * deploy rotates the hashed filenames, and in dev Vite re-optimises whenever a
 * new dependency is installed and invalidates the old `?v=` hash. Either way
 * the browser reports "Failed to fetch dynamically imported module", which is
 * meaningless to the user — the page just needs reloading.
 */
export class PdfEngineLoadError extends Error {
  constructor(cause?: unknown) {
    super('Motori i PDF-së nuk u ngarkua.');
    this.name = 'PdfEngineLoadError';
    this.cause = cause;
  }
}

export function isPdfEngineLoadError(error: unknown): boolean {
  if (error instanceof PdfEngineLoadError) return true;
  const message = (error as Error)?.message ?? '';
  return /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
    message
  );
}

async function loadPdfEngine() {
  try {
    return await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  } catch (error) {
    throw new PdfEngineLoadError(error);
  }
}

export async function buildInvoicePdf({ invoice, profile, client }: InvoicePdfInput) {
  const [jsPdfModule, autoTableModule] = await loadPdfEngine();

  const jsPDF = (jsPdfModule.jsPDF ??
    unwrapDefault<{ jsPDF?: unknown }>(jsPdfModule)?.jsPDF) as
    | typeof import('jspdf').jsPDF
    | undefined;
  const autoTable = unwrapDefault<typeof import('jspdf-autotable').default>(
    autoTableModule
  );

  if (typeof jsPDF !== 'function' || typeof autoTable !== 'function') {
    throw new Error('Bibliotekat e PDF-së nuk u ngarkuan si duhet.');
  }

  const s = invoiceStrings();
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const totals = computeTotals(items, invoice.vat_percent, invoice.discount);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const contentW = PAGE_W - MARGIN * 2;

  // ---- Header band -------------------------------------------------
  const logo = await loadLogo(profile?.logo_url);
  let headerBottom = MARGIN;

  if (logo) {
    /*
      A square 40x40pt box (14.11mm). Previously the logo could run 38mm wide,
      which pushed the whole document down and ate the room the items table
      needs. Contain-fitted, so a wide logo simply gets shorter rather than
      stretched.
    */
    const maxW = LOGO_BOX;
    const maxH = LOGO_BOX;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * ratio;
    const h = logo.height * ratio;
    const format = logo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
    try {
      doc.addImage(logo.dataUrl, format, MARGIN, MARGIN, w, h, undefined, 'FAST');
      headerBottom = MARGIN + h;
    } catch {
      /* an unsupported image format must not sink the whole invoice */
    }
  }

  if (!logo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text(profile?.business_name || 'Fatura.co', MARGIN, MARGIN + 6);
    headerBottom = MARGIN + 8;
  }

  // Title block, right aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(...BRAND_DEEP);
  doc.text(s.invoice, PAGE_W - MARGIN, MARGIN + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(invoice.invoice_number, PAGE_W - MARGIN, MARGIN + 11.5, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `${s.issueDate}: ${prettyDate(invoice.issue_date)}`,
    PAGE_W - MARGIN,
    MARGIN + 16,
    { align: 'right' }
  );
  if (invoice.due_date) {
    doc.text(
      `${s.dueDate}: ${prettyDate(invoice.due_date)}`,
      PAGE_W - MARGIN,
      MARGIN + 20,
      { align: 'right' }
    );
  }

  // A paid/overdue invoice says so at a glance; a draft needs no stamp.
  let stampBottom = MARGIN + 20;
  if (invoice.status === 'paid' || invoice.status === 'overdue') {
    const label = s.statuses[invoice.status];
    const isPaid = invoice.status === 'paid';
    // 4px of breathing room so the badge does not sit on the line above it.
    const stampY =
      (invoice.due_date ? MARGIN + 23.5 : MARGIN + 19.5) - 3.2 + 4 * PX;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    const textW = doc.getTextWidth(label);
    const boxW = textW + 3.4;
    const boxH = 4.6;
    const boxX = PAGE_W - MARGIN - boxW;

    doc.setFillColor(...(isPaid ? PAID : OVERDUE));
    doc.roundedRect(boxX, stampY, boxW, boxH, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(label, boxX + boxW / 2, stampY + 3.15, { align: 'center' });
    stampBottom = stampY + boxH;
  }

  let y = Math.max(headerBottom, stampBottom, MARGIN + 22) + 4;

  // Brand rule: a short teal segment running into a hairline across the page.
  // Purely decorative, so the exact #00ADB5 is fine here.
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1.1);
  doc.line(MARGIN, y, MARGIN + 26, y);
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.4);
  doc.line(MARGIN + 26, y, PAGE_W - MARGIN, y);
  y += 6;

  // ---- Parties -----------------------------------------------------
  const colW = contentW / 2 - 4;
  const rightX = MARGIN + contentW / 2 + 4;

  const partyBlock = (
    x: number,
    heading: string,
    lines: (string | null | undefined)[]
  ): number => {
    let cursor = y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text(heading.toUpperCase(), x, cursor);
    cursor += 4;

    doc.setFontSize(9);
    lines.filter(Boolean).forEach((line, index) => {
      doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
      doc.setTextColor(...(index === 0 ? INK : MUTED));
      const wrapped = doc.splitTextToSize(String(line), colW);
      doc.text(wrapped, x, cursor);
      cursor += wrapped.length * 3.8;
    });
    return cursor;
  };

  const sellerBottom = partyBlock(MARGIN, s.from, [
    profile?.business_name || '—',
    profile?.nipt ? `${s.nipt}: ${profile.nipt}` : null,
    profile?.address,
    profile?.city,
    profile?.phone,
  ]);

  const buyerBottom = partyBlock(rightX, s.billTo, [
    client?.name || '—',
    client?.nipt ? `${s.nipt}: ${client.nipt}` : null,
    client?.address,
    client?.email,
  ]);

  y = Math.max(sellerBottom, buyerBottom) + 4;

  // ---- Items table -------------------------------------------------
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [[s.description, s.qty, s.unitPrice, s.amount]],
    body: items.map((item) => [
      item.description || '—',
      String(Number(item.quantity) || 0),
      money(Number(item.price) || 0),
      money((Number(item.quantity) || 0) * (Number(item.price) || 0)),
    ]),
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: { top: 2.1, bottom: 2.1, left: 2, right: 2 },
      textColor: INK,
      lineColor: HAIRLINE,
      lineWidth: { top: 0, bottom: 0.1, left: 0, right: 0 },
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8,
      textColor: [255, 255, 255],
      fillColor: INK,
      lineWidth: 0,
      cellPadding: { top: 2.4, bottom: 2.4, left: 2, right: 2 },
    },
    columnStyles: {
      0: { cellWidth: contentW - 96 },
      1: { cellWidth: 20, halign: 'right' },
      2: { cellWidth: 36, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    // headStyles outranks columnStyles for the header row, so the numeric
    // headings need their alignment set back explicitly to sit over the values.
    didParseCell: (data) => {
      if (data.section === 'head' && data.column.index > 0) {
        data.cell.styles.halign = 'right';
      }
    },
  });

  // @ts-expect-error — autotable augments the doc instance at runtime
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // ---- Totals ------------------------------------------------------
  const totalsX = PAGE_W - MARGIN - 76;
  const labelX = totalsX;
  const valueX = PAGE_W - MARGIN;

  const totalRow = (label: string, value: string, emphasis = false) => {
    doc.setFont('helvetica', emphasis ? 'bold' : 'normal');
    doc.setFontSize(emphasis ? 12 : 10);
    doc.setTextColor(...(emphasis ? BRAND_DEEP : MUTED));
    doc.text(label, labelX, y);
    doc.setTextColor(...(emphasis ? BRAND_DEEP : INK));
    doc.text(value, valueX, y, { align: 'right' });
    y += emphasis ? 8 : 6;
  };

  totalRow(s.subtotal, `${money(totals.subtotal)} ${s.currency}`);
  if (totals.discount > 0) {
    totalRow(s.discount, `- ${money(totals.discount)} ${s.currency}`);
  }
  if (invoice.vat_percent > 0) {
    totalRow(`${s.vat} ${invoice.vat_percent}%`, `${money(totals.vatAmount)} ${s.currency}`);
  }

  doc.setDrawColor(...HAIRLINE);
  doc.line(labelX, y - 3.5, valueX, y - 3.5);
  y += 2;
  totalRow(s.total, `${money(totals.total)} ${s.currency}`, true);

  // ---- Notes -------------------------------------------------------
  if (invoice.notes?.trim()) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(s.notes.toUpperCase(), MARGIN, y);
    y += 4.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    const wrapped = doc.splitTextToSize(invoice.notes.trim(), contentW);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 4.1;
  }

  // ---- Footer on every page ---------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    const footerY = 289;
    doc.setDrawColor(...HAIRLINE);
    doc.line(MARGIN, footerY - 4, PAGE_W - MARGIN, footerY - 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(s.thanks, MARGIN, footerY);
    doc.text(
      pageCount > 1 ? `${s.generatedWith}  ·  ${page}/${pageCount}` : s.generatedWith,
      PAGE_W - MARGIN,
      footerY,
      { align: 'right' }
    );
  }

  return doc;
}

export function invoiceFileName(invoiceNumber: string, clientName?: string | null): string {
  const safe = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  const parts = [safe(invoiceNumber || 'fature')];
  if (clientName) parts.push(safe(clientName));
  return `${parts.filter(Boolean).join('-')}.pdf`;
}

export async function downloadInvoicePdf(input: InvoicePdfInput, clientName?: string | null) {
  const doc = await buildInvoicePdf(input);
  doc.save(invoiceFileName(input.invoice.invoice_number, clientName));
}

/** Blob URL for the live preview iframe. Caller must revokeObjectURL. */
export async function invoicePdfObjectUrl(input: InvoicePdfInput): Promise<string> {
  const doc = await buildInvoicePdf(input);
  return URL.createObjectURL(doc.output('blob'));
}

/** Share sheet on mobile (WhatsApp/Viber), with a download fallback. */
export async function shareInvoicePdf(input: InvoicePdfInput, clientName?: string | null) {
  const doc = await buildInvoicePdf(input);
  const fileName = invoiceFileName(input.invoice.invoice_number, clientName);
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: input.invoice.invoice_number });
      return 'shared' as const;
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return 'cancelled' as const;
    }
  }

  doc.save(fileName);
  return 'downloaded' as const;
}
