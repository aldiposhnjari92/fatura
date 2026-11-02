import { supabase } from './supabase';
import { cloneBlock, flattenBlocks, knownBlocks, newId, slugify } from './page-builder';
import type { Block, CustomCollection, CustomPage, LeafBlock, PageIcon, PageTemplate, Snapshot } from '@/models/page-builder';

/*
  Page builder, phase 3: templates, and copying a page to another customer.

  Both are the same operation. A snapshot is a page's blocks plus the
  definitions of the collections those blocks read from — names and fields,
  never rows. instantiate() recreates each collection, empty, for the target
  owner, gives every block a fresh id and points it at the new collection, and
  inserts the page as a draft. A customer's data never leaves their account.
*/

/** The page as it stands — unsaved edits included — and the shape of its collections. */
export function snapshotOf(blocks: Block[], collections: CustomCollection[]): Snapshot {
  const used = new Set(
    flattenBlocks(blocks)
      .map((b) => ('source' in b ? b.source.collectionId : null))
      .filter((id): id is string => !!id)
  );
  return {
    blocks: structuredClone(blocks),
    collections: collections
      .filter((c) => used.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, fields: structuredClone(c.fields) })),
  };
}

/** Fresh block ids, and every source re-pointed through `map` (unknown → none). */
function remap(blocks: Block[], map: Map<string, string>): Block[] {
  const fix = <T extends Block>(b: T): T =>
    'source' in b
      ? { ...b, source: { ...b.source, collectionId: map.get(b.source.collectionId ?? '') ?? null } }
      : b;
  return blocks.map((block) => {
    const copy = cloneBlock(block);
    return copy.type === 'columns'
      ? { ...copy, columns: copy.columns.map((col) => col.map((c) => fix(c) as LeafBlock)) }
      : fix(copy);
  });
}

async function uniqueSlug(ownerId: string, base: string): Promise<string> {
  const { data } = await supabase.from('custom_pages').select('slug').eq('owner_id', ownerId);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  let slug = base;
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

/**
 * Creates the page (as a draft) and its collections for `ownerId`. If any
 * step fails, the collections it already made are removed again, so a failed
 * copy leaves nothing half-made behind.
 */
export async function instantiate(
  snapshot: Snapshot,
  ownerId: string,
  page: { title: string; icon: PageIcon; nav_group?: string | null }
): Promise<{ page: CustomPage; collections: CustomCollection[] }> {
  const created: CustomCollection[] = [];
  try {
    const map = new Map<string, string>();
    for (const def of snapshot.collections) {
      const { data, error } = await supabase
        .from('custom_collections')
        .insert({ owner_id: ownerId, name: def.name, fields: def.fields })
        .select()
        .single();
      if (error) throw error;
      created.push(data as CustomCollection);
      map.set(def.id, (data as CustomCollection).id);
    }

    const [{ data: last }, slug] = await Promise.all([
      supabase
        .from('custom_pages')
        .select('position')
        .eq('owner_id', ownerId)
        .order('position', { ascending: false })
        .limit(1)
        .maybeSingle(),
      uniqueSlug(ownerId, slugify(page.title)),
    ]);

    const { data, error } = await supabase
      .from('custom_pages')
      .insert({
        owner_id: ownerId,
        title: page.title,
        slug,
        icon: page.icon,
        nav_group: page.nav_group ?? null,
        position: ((last as { position?: number } | null)?.position ?? -1) + 1,
        published: false,
        blocks: remap(knownBlocks(snapshot.blocks), map),
      })
      .select()
      .single();
    if (error) throw error;
    const row = data as CustomPage;
    return { page: { ...row, blocks: knownBlocks(row.blocks) }, collections: created };
  } catch (err) {
    if (created.length) {
      await supabase
        .from('custom_collections')
        .delete()
        .in(
          'id',
          created.map((c) => c.id)
        );
    }
    throw err;
  }
}

// ---- Saved templates --------------------------------------------------------

export async function listTemplates(): Promise<PageTemplate[]> {
  const { data, error } = await supabase
    .from('page_templates')
    .select('id, name, description, icon, blocks, collections')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PageTemplate[];
}

export async function saveTemplate(
  snapshot: Snapshot,
  meta: { name: string; description: string; icon: PageIcon }
): Promise<PageTemplate> {
  const { data, error } = await supabase
    .from('page_templates')
    .insert({
      name: meta.name,
      description: meta.description || null,
      icon: meta.icon,
      blocks: snapshot.blocks,
      collections: snapshot.collections,
    })
    .select('id, name, description, icon, blocks, collections')
    .single();
  if (error) throw error;
  return data as PageTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('page_templates').delete().eq('id', id);
  if (error) throw error;
}

// ---- Built-in starters -------------------------------------------------------

/*
  Collection ids here are placeholders ('c-orders'); instantiate() replaces
  them. Field ids are fixed words, which is fine — they only have to be unique
  within their own collection, and formulas refer to them.
*/
const id = () => newId();

export const BUILTIN_TEMPLATES: PageTemplate[] = [
  {
    id: 'builtin-orders',
    builtin: true,
    name: 'Porositë',
    description: 'Formular porosie, totali i llogaritur dhe lista e porosive.',
    icon: 'shopping-cart',
    collections: [
      {
        id: 'c-orders',
        name: 'Porositë',
        fields: [
          { id: 'klienti', label: 'Klienti', type: 'text', required: true },
          { id: 'produkti', label: 'Produkti', type: 'text', required: true },
          { id: 'sasia', label: 'Sasia', type: 'number', required: true },
          { id: 'cmimi', label: 'Çmimi', type: 'number', required: true },
          { id: 'totali', label: 'Totali', type: 'formula', formula: '{sasia} * {cmimi}' },
          { id: 'data', label: 'Data', type: 'date' },
          {
            id: 'statusi',
            label: 'Statusi',
            type: 'select',
            options: ['E re', 'Në proces', 'E dorëzuar'],
          },
        ],
      },
    ],
    blocks: [
      {
        id: id(),
        type: 'columns',
        layout: '1-1',
        columns: [
          [{ id: id(), type: 'stat', label: 'Porosi gjithsej', source: { kind: 'collection', collectionId: 'c-orders' }, op: 'count', fieldId: null }],
          [{ id: id(), type: 'stat', label: 'Vlera e porosive', source: { kind: 'collection', collectionId: 'c-orders' }, op: 'sum', fieldId: 'totali' }],
        ],
      },
      { id: id(), type: 'form', title: 'Porosi e re', source: { kind: 'collection', collectionId: 'c-orders' }, fieldIds: [], submitLabel: 'Shto porosinë' },
      { id: id(), type: 'table', title: 'Të gjitha porositë', source: { kind: 'collection', collectionId: 'c-orders' }, columnIds: [], allowEdit: true, emptyText: 'Nuk ka ende porosi.' },
    ],
  },
  {
    id: 'builtin-inventory',
    builtin: true,
    name: 'Inventari',
    description: 'Produktet në magazinë, sasia dhe vlera e stokut.',
    icon: 'package',
    collections: [
      {
        id: 'c-stock',
        name: 'Inventari',
        fields: [
          { id: 'produkti', label: 'Produkti', type: 'text', required: true },
          { id: 'kodi', label: 'Kodi', type: 'text' },
          { id: 'sasia', label: 'Sasia', type: 'number', required: true },
          { id: 'kosto', label: 'Kosto për copë', type: 'number' },
          { id: 'vlera', label: 'Vlera e stokut', type: 'formula', formula: '{sasia} * {kosto}' },
          { id: 'furnitori', label: 'Furnitori', type: 'text' },
        ],
      },
    ],
    blocks: [
      {
        id: id(),
        type: 'columns',
        layout: '1-1-1',
        columns: [
          [{ id: id(), type: 'stat', label: 'Produkte', source: { kind: 'collection', collectionId: 'c-stock' }, op: 'count', fieldId: null }],
          [{ id: id(), type: 'stat', label: 'Copë gjithsej', source: { kind: 'collection', collectionId: 'c-stock' }, op: 'sum', fieldId: 'sasia' }],
          [{ id: id(), type: 'stat', label: 'Vlera e stokut', source: { kind: 'collection', collectionId: 'c-stock' }, op: 'sum', fieldId: 'vlera' }],
        ],
      },
      {
        id: id(),
        type: 'columns',
        layout: '1-2',
        columns: [
          [{ id: id(), type: 'form', title: 'Shto produkt', source: { kind: 'collection', collectionId: 'c-stock' }, fieldIds: [], submitLabel: 'Shto' }],
          [{ id: id(), type: 'table', title: 'Stoku', source: { kind: 'collection', collectionId: 'c-stock' }, columnIds: [], allowEdit: true, emptyText: 'Magazina është bosh.' }],
        ],
      },
    ],
  },
  {
    id: 'builtin-expenses',
    builtin: true,
    name: 'Shpenzimet',
    description: 'Regjistër i shpenzimeve sipas kategorisë, me totalin.',
    icon: 'wallet',
    collections: [
      {
        id: 'c-expenses',
        name: 'Shpenzimet',
        fields: [
          { id: 'pershkrimi', label: 'Përshkrimi', type: 'text', required: true },
          {
            id: 'kategoria',
            label: 'Kategoria',
            type: 'select',
            options: ['Qira', 'Rroga', 'Furnizime', 'Transport', 'Të tjera'],
          },
          { id: 'shuma', label: 'Shuma', type: 'number', required: true },
          { id: 'data', label: 'Data', type: 'date', required: true },
          { id: 'paguar', label: 'Paguar', type: 'checkbox' },
        ],
      },
    ],
    blocks: [
      { id: id(), type: 'stat', label: 'Shpenzime gjithsej', source: { kind: 'collection', collectionId: 'c-expenses' }, op: 'sum', fieldId: 'shuma' },
      { id: id(), type: 'form', title: 'Shpenzim i ri', source: { kind: 'collection', collectionId: 'c-expenses' }, fieldIds: [], submitLabel: 'Ruaj shpenzimin' },
      { id: id(), type: 'table', title: 'Shpenzimet', source: { kind: 'collection', collectionId: 'c-expenses' }, columnIds: [], allowEdit: true, emptyText: 'Nuk ka ende shpenzime.' },
    ],
  },
];
