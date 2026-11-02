import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Profile } from '@/models/account';
import type { Client } from '@/models/client';

export type InvoiceStatus = 'draft' | 'paid' | 'unpaid' | 'overdue';

export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id: string;
  owner_id: string;
  client_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  subtotal: number;
  vat_percent: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  /** Set only while status is 'paid'; maintained by a database trigger. */
  paid_at?: string | null;
  notes: string | null;
  created_at: string;
}

/** An invoice joined with its client row, as the list and detail pages read it. */
export interface InvoiceWithClient extends Invoice {
  clients: Pick<Client, 'id' | 'name' | 'email' | 'nipt' | 'address'> | null;
}

export interface Totals {
  subtotal: number;
  discount: number;
  vatAmount: number;
  total: number;
}

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

export type InvoiceFileAction = 'download' | 'print' | 'excel' | 'share';

/**
 * A product this business has invoiced before.
 *
 * There is no products table: a line item is whatever was typed into an
 * invoice, and the invoices already are the record of what this business
 * sells. Deriving the catalogue from them means it is never empty on the
 * first run and never drifts out of date — the cost is that a product is
 * forgotten only by editing the invoices it appears on.
 */
export interface ProductSuggestion {
  /** As last typed — the casing and accents of the most recent use. */
  description: string;
  /** The price on the most recent line, offered as the default. */
  price: number;
  /** How many invoice lines it has appeared on; the most-used come first. */
  uses: number;
}

export interface DeleteInvoiceButtonProps {
  invoiceId: string;
  invoiceNumber: string;
}

export type InvoiceStatusEvent = CustomEvent<{ invoiceId: string; status: InvoiceStatus }>;

export interface PaidToggleProps {
  invoiceId: string;
  status: InvoiceStatus;
  paidAt?: string | null;
  /** Needed to derive the overdue badge; lateness is never stored. */
  dueDate?: string | null;
  /** `row` is the compact control used in the invoice list. */
  variant?: 'row' | 'panel';
  /**
   * Render the status badge too.
   *
   * The list used to draw the badge in Astro and the button in this island, so
   * after a click the row showed "Unpaid" next to "Mark as unpaid" until the
   * page was reloaded — two components describing the same fact from two
   * different sources. Owning both here keeps them in step.
   */
  showBadge?: boolean;
  /**
   * Told when the payment state actually changes on the server.
   *
   * Without this the component was a state island: it flipped its own copy of
   * `status` and the form around it never heard, so the status dropdown stayed
   * on "unpaid" after a successful payment — and saving would then try to write
   * that stale value back, which the database refuses.
   */
  onStatusChange?: (status: InvoiceStatus, paidAt: string | null) => void;
}

export interface InvoiceEditorProps {
  profile: Profile | null;
  clients: Client[];
  invoice?: Invoice | null;
  suggestedNumber: string;
  limitReached?: boolean;
  /** Products this business has invoiced before, most-used first. */
  products?: ProductSuggestion[];
}

export interface InvoiceFileActionsProps {
  invoiceId: string;
  invoiceNumber: string;
}

export interface InvoiceRowActionsProps {
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
}

export interface InvoiceDetailProps {
  invoice: Invoice;
  client: Pick<Client, 'name' | 'nipt' | 'address' | 'email'> | null;
}

export type InvoiceTimelineStep = {
  label: string;
  date: string | null;
  icon: string;
  final?: boolean;
};

export interface StatusBadgeProps {
  status: InvoiceStatus;
  class?: string;
}

// ---- The invoice editor's parts ------------------------------------------------------

export interface EditorSectionProps {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: React.ReactNode;
}

/** The line-item composer: one row of inputs, and the lines already on the invoice. */
export interface InvoiceItemsState {
  items: InvoiceItem[];
  draft: InvoiceItem;
  setDraft: React.Dispatch<React.SetStateAction<InvoiceItem>>;
  /** The line pulled back into the composer, or null while adding. */
  editingIndex: number | null;
  /** The line the last Shto landed on, highlighted for a moment. */
  flashIndex: number | null;
  descriptionRef: React.RefObject<HTMLInputElement>;
  /** The lines plus a typed-but-not-added one: what a save right now would store. */
  effectiveItems: InvoiceItem[];
  commitDraft: () => void;
  editItem: (index: number) => void;
  cancelEdit: () => void;
  removeItem: (index: number) => void;
}

export type InvoicePdfAction = 'download' | 'print' | 'share' | 'preview';

export interface InvoicePdfActionsOptions {
  pdfInput: InvoicePdfInput;
  clientName: string | null | undefined;
  invoiceNumber: string;
  /** The form's own check; a PDF of an invalid invoice is refused the same way a save is. */
  validate: () => string | null;
  onError: (title: string, detail: string) => void;
  /** The PDF engine chunk could not be fetched — the page is stale, not broken. */
  onEngineStale: () => void;
}

export interface InvoicePdfActions {
  busy: InvoicePdfAction | null;
  download: () => Promise<void>;
  preview: () => Promise<void>;
  print: () => Promise<void>;
  share: () => Promise<void>;
}

export interface NewClientFormProps {
  onCreated: (client: Client) => void;
  onCancel: () => void;
  onError: (title: string, detail: string) => void;
}

export interface InvoiceDetailsSectionProps {
  invoiceNumber: string;
  onInvoiceNumber: (value: string) => void;
  status: InvoiceStatus;
  onStatus: (value: InvoiceStatus) => void;
  /** A paid invoice is final in the database, so its status cannot be changed here. */
  statusLocked: boolean;
  issueDate: string;
  onIssueDate: (value: string) => void;
  dueDate: string;
  onDueDate: (value: string) => void;
  vatPercent: number;
  onVatPercent: (value: number) => void;
}

export interface InvoiceItemsSectionProps {
  state: InvoiceItemsState;
  products: ProductSuggestion[];
}

export interface InvoiceSummaryProps {
  totals: Totals;
  vatPercent: number;
  discount: number;
  onDiscount: (value: number) => void;
  /** Set for a saved invoice: the paid toggle needs a row to act on. */
  invoiceId: string | null;
  isEdit: boolean;
  status: InvoiceStatus;
  paidAt: string | null;
  onPaidChange: (status: InvoiceStatus, paidAt: string | null) => void;
  saving: boolean;
  onConfirm: () => void;
  onSave: () => void;
  pdf: InvoicePdfActions;
}
