/*
  Page builder — the shared vocabulary of the admin editor and the customer's
  rendered page (supabase/migrations/0024_page_builder.sql, 0025_page_builder_phase2.sql).

  A page is a list of blocks. A `columns` block holds further blocks in two or
  three columns — one level deep, never columns inside columns. Every block
  type the renderer knows is listed here; anything else in the stored JSON is
  skipped, never guessed at. Text is always rendered as text — there is no
  HTML block — styles are a fixed set of choices mapped to classes rather than
  raw CSS, links are checked by safeHref(), and formulas are parsed here, never
  eval'd. A layout can describe a page but never carry code into one.
*/

/*
  The pieces, by concern. Import from '@/lib/page-builder', not from these files.
*/

export * from './blocks';
export * from './collections';
export * from './create-block';
export * from './formulas';
export * from './helpers';
export * from './style';
export * from './tree';
