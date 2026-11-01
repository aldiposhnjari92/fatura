-- =====================================================================
--  Fatura.co — page builder (phase 1)
--
--  The admin builds pages for one customer out of a fixed set of blocks —
--  headings, text, forms, tables, stat cards, buttons — and those pages show
--  up in that customer's sidebar. Forms and tables need somewhere to keep what
--  is typed into them, so alongside the pages sit collections (a named list
--  of fields, like a spreadsheet's columns) and records (one row each).
--
--  Who may do what is enforced here, not in the UI:
--    • pages and collections: the customer reads their own; only the admin
--      writes. (A later paid tier may let customers edit — that is a policy
--      change, not a schema one.)
--    • records: the customer reads and writes their own, and only into one of
--      their own collections; the admin may read and delete, for support.
--
--  A page's `blocks` is JSON the renderer interprets against a whitelist of
--  block types (src/lib/page-builder.ts). Nothing in it is ever executed or
--  rendered as HTML, so a layout cannot carry script into a customer's page.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Collections — where a form's entries go, and what a table lists
-- ---------------------------------------------------------------------
create table if not exists public.custom_collections (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null,
  -- [{ "id": text, "label": text, "type": "text"|"textarea"|"number"|"date"|"select"|"checkbox",
  --    "required": bool, "options": [text] }, ...]
  fields     jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint custom_collections_fields_is_array check (jsonb_typeof(fields) = 'array'),
  constraint custom_collections_name_not_blank check (length(trim(name)) > 0)
);

create index if not exists custom_collections_owner_idx on public.custom_collections (owner_id);

-- ---------------------------------------------------------------------
-- 2. Pages — one sidebar entry each
-- ---------------------------------------------------------------------
create table if not exists public.custom_pages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid        not null references public.profiles (id) on delete cascade,
  slug       text        not null,
  title      text        not null,
  icon       text        not null default 'file',
  position   integer     not null default 0,
  -- A draft is invisible to the customer: not in the sidebar, and its URL 404s.
  published  boolean     not null default false,
  blocks     jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint custom_pages_owner_slug_unique unique (owner_id, slug),
  constraint custom_pages_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint custom_pages_title_not_blank check (length(trim(title)) > 0),
  constraint custom_pages_blocks_is_array check (jsonb_typeof(blocks) = 'array')
);

create index if not exists custom_pages_owner_position_idx on public.custom_pages (owner_id, position);

-- ---------------------------------------------------------------------
-- 3. Records — one row a customer typed into a form
-- ---------------------------------------------------------------------
create table if not exists public.custom_records (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid        not null references public.profiles (id) on delete cascade,
  collection_id uuid        not null references public.custom_collections (id) on delete cascade,
  -- { "<field id>": value, ... }
  data          jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint custom_records_data_is_object check (jsonb_typeof(data) = 'object')
);

create index if not exists custom_records_collection_created_idx
  on public.custom_records (collection_id, created_at desc);
create index if not exists custom_records_owner_idx on public.custom_records (owner_id);

-- ---------------------------------------------------------------------
-- 4. updated_at, kept by the database
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists custom_collections_touch on public.custom_collections;
create trigger custom_collections_touch before update on public.custom_collections
  for each row execute function public.touch_updated_at();

drop trigger if exists custom_pages_touch on public.custom_pages;
create trigger custom_pages_touch before update on public.custom_pages
  for each row execute function public.touch_updated_at();

drop trigger if exists custom_records_touch on public.custom_records;
create trigger custom_records_touch before update on public.custom_records
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. Row-level security
-- ---------------------------------------------------------------------
alter table public.custom_collections enable row level security;
alter table public.custom_pages       enable row level security;
alter table public.custom_records     enable row level security;

-- Collections: owner reads, admin does everything.
drop policy if exists "custom_collections_select" on public.custom_collections;
create policy "custom_collections_select" on public.custom_collections
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "custom_collections_admin_write" on public.custom_collections;
create policy "custom_collections_admin_write" on public.custom_collections
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Pages: owner reads their published pages, admin does everything.
drop policy if exists "custom_pages_select" on public.custom_pages;
create policy "custom_pages_select" on public.custom_pages
  for select to authenticated
  using ((owner_id = auth.uid() and published) or public.is_admin());

drop policy if exists "custom_pages_admin_write" on public.custom_pages;
create policy "custom_pages_admin_write" on public.custom_pages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Records: owner reads and writes their own, into their own collections only.
drop policy if exists "custom_records_owner" on public.custom_records;
create policy "custom_records_owner" on public.custom_records
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.custom_collections c
       where c.id = collection_id and c.owner_id = auth.uid()
    )
  );

-- Admin: read and delete, for support. Not insert/update — the admin does
-- not type into a customer's books.
drop policy if exists "custom_records_admin_select" on public.custom_records;
create policy "custom_records_admin_select" on public.custom_records
  for select to authenticated
  using (public.is_admin());

drop policy if exists "custom_records_admin_delete" on public.custom_records;
create policy "custom_records_admin_delete" on public.custom_records
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. The app shell learns the customer's pages in the same single RPC
--    (0017's app_bootstrap, plus `custom_pages`)
-- ---------------------------------------------------------------------
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'invoices_this_month', (
      select count(*) from public.invoices
       where owner_id = auth.uid()
         and created_at >= date_trunc('month', now())
    ),
    'free_invoice_limit', public.free_invoice_limit(),
    'plan', public.active_plan(auth.uid()),
    -- NULL means unlimited. Read this rather than re-deriving the cap client-side.
    'invoice_limit', public.plan_invoice_limit(public.active_plan(auth.uid())),
    'pro_active', public.has_active_pro(auth.uid()),
    'pending_payment', (
      select to_jsonb(x) from (
        select id, reference, method, amount, months, plan, created_at
          from public.payments
         where owner_id = auth.uid() and status = 'pending'
         order by created_at desc limit 1
      ) x
    ),
    -- Sidebar entries only: no blocks, so this stays small on every request.
    'custom_pages', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.position, x.title), '[]'::jsonb)
        from (
          select id, slug, title, icon, position
            from public.custom_pages
           where owner_id = auth.uid() and published
        ) x
    )
  );
$$;
