import type * as React from 'react';
import type {
  Block,
  BlockType,
  CollectionField,
  Container,
  CustomCollection,
  CustomPage,
  CustomRecord,
  FieldBlock,
  FieldType,
  LeafBlock,
  RecordValue,
  SubmitBlock,
  WidgetIcon,
} from '@/models/page-builder';

export type WidgetPatch = Partial<LeafBlock>;

export interface WidgetInspectorProps {
  block: LeafBlock;
  set: (patch: WidgetPatch) => void;
  collections: CustomCollection[];
  onManageCollections: () => void;
}

// ---- Widget inspector controls ------------------------------------------------------

export interface CheckProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export interface IconPickerProps {
  value: WidgetIcon;
  onChange: (icon: WidgetIcon) => void;
}

export interface StarsInputProps {
  value: number;
  onChange: (value: number) => void;
  allowZero?: boolean;
}

export interface LinkFieldsProps {
  label: string;
  href: string;
  onChange: (label: string, href: string) => void;
}

export interface FieldSelectProps {
  label: string;
  collection: CustomCollection | undefined;
  value: string | null;
  onChange: (id: string | null) => void;
  numericOnly?: boolean;
  allowNone?: boolean;
}

export interface ItemListProps<T extends { id: string }> {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  create: () => T;
  render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}

export interface MiniButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}

export interface ImageUploadProps {
  src: string;
  onChange: (src: string) => void;
}

export interface PageBlocksProps {
  blocks: Block[];
  collections: CustomCollection[];
  records?: CustomRecord[];
  /** The admin's Parapamje: real rows, but every write switched off. */
  readOnly?: boolean;
}

export interface BlockContext {
  preview: boolean;
  /** The whole page — what a table of contents reads its headings from. */
  blocks: Block[];
  collection: (id: string | null) => CustomCollection | undefined;
  rows: (collectionId: string | null) => CustomRecord[];
  onSaved: (row: CustomRecord) => void;
  onDeleted: (id: string) => void;
  /** An element-built form's current values — shared by its field blocks. */
  formValues: (key: string) => FormValues;
  setFormValue: (key: string, fieldId: string, value: RecordValue) => void;
  resetForm: (key: string) => void;
}

export type FormValues = Record<string, RecordValue>;

export interface FormFieldInspectorProps {
  block: FieldBlock | SubmitBlock;
  set: (patch: Partial<Omit<FieldBlock, 'type'>> & Partial<Omit<SubmitBlock, 'type'>>) => void;
  collections: CustomCollection[];
  pageBlocks: Block[];
  onManageCollections: () => void;
  onAddField: (collectionId: string, field: CollectionField) => Promise<boolean>;
}

export type InspectorTab = 'content' | 'style' | 'advanced';

export interface BlockInspectorProps {
  block: Block;
  tab: InspectorTab;
  collections: CustomCollection[];
  onChange: (block: Block) => void;
  onManageCollections: () => void;
  /** The whole page — a form element needs to see its siblings. */
  pageBlocks: Block[];
  onAddField: (collectionId: string, field: CollectionField) => Promise<boolean>;
}

export interface CollectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  collections: CustomCollection[];
  onChange: (collections: CustomCollection[]) => void;
}

export interface CollectionDraft {
  id: string | null;
  name: string;
  fields: CollectionField[];
}

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

export interface PageBusiness {
  id: string;
  email: string;
  business_name: string | null;
  city: string | null;
}

export interface PageBuilderProps {
  owner: { id: string; name: string };
  pages: CustomPage[];
  collections: CustomCollection[];
}

export type BuilderPanel = 'widgets' | 'edit' | 'page' | 'navigator';

export type DragPayload =
  { kind: 'new'; type: BlockType; fieldKind?: FieldType } | { kind: 'move'; id: string };

export type DropTarget = { container: Container; index: number };

// ---- The editor's own parts --------------------------------------------------------

export interface ToolButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}

export interface FooterButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

export interface NavigatorProps {
  blocks: Block[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export interface PageSettingsProps {
  page: CustomPage;
  navGroups: string[];
  onChange: (patch: Partial<CustomPage>) => void;
  onDelete: () => void;
  slugTaken: (slug: string) => boolean;
}

export interface WidgetPaletteProps {
  search: string;
  onSearch: (value: string) => void;
  /** A "+ Shto" spot on the canvas is waiting for the next element. */
  hasInsertTarget: boolean;
  onAdd: (type: BlockType, fieldKind?: FieldType) => void;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onDragEnd: () => void;
}

export interface PagesBarProps {
  /** In sidebar order. */
  pages: CustomPage[];
  selectedPageId: string | null;
  /** The open page's unsaved title, shown on its tab while it is edited. */
  draftTitle: string | null;
  dirty: boolean;
  creating: boolean;
  collectionCount: number;
  onOpen: (id: string) => void;
  onMove: (id: string, by: -1 | 1) => void;
  onNew: () => void;
  onCollections: () => void;
  onPreview: () => void;
  onSaveTemplate: () => void;
  onCopy: () => void;
}

export interface PanelFooterProps {
  panel: BuilderPanel;
  onPanel: (panel: BuilderPanel) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  device: PreviewDevice;
  onDevice: (device: PreviewDevice) => void;
  saving: boolean;
  dirty: boolean;
  published: boolean;
  onSave: () => void;
}

export interface BuilderCanvasProps {
  title: string;
  blocks: Block[];
  device: PreviewDevice;
  context: BlockContext;
  selectedId: string | null;
  insertTarget: DropTarget | null;
  dropTarget: DropTarget | null;
  onSelect: (id: string | null) => void;
  /** A "+ Shto" button was clicked: the palette opens to fill that spot. */
  onPickInsert: (target: DropTarget) => void;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onDragEnd: () => void;
  onDragOverBlock: (event: React.DragEvent, container: Container, index: number) => void;
  onDragOverEmpty: (event: React.DragEvent, container: Container, index: number) => void;
  onDragOverCanvas: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onNudge: (id: string, by: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export interface DeletePageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  busy: boolean;
  onConfirm: () => void;
}

// ---- The rendered page's inputs ----------------------------------------------------

export interface FieldInputProps {
  field: CollectionField;
  value: RecordValue;
  onChange: (value: RecordValue) => void;
  idPrefix: string;
  placeholder?: string;
}

export interface FieldGridProps {
  fields: CollectionField[];
  /** Every field of the collection — formulas may use ones the form hides. */
  allFields: CollectionField[];
  values: FormValues;
  setValues: (next: FormValues) => void;
  idPrefix: string;
}
