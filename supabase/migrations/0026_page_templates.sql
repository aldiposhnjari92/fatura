-- =====================================================================
--  Fatura.co — page builder, phase 3: saved templates
--
--  A template is a page's layout plus the shape of the collections it uses —
--  never their rows. Creating a page from one (or copying a page to another
--  customer) recreates those collections, empty, for the new owner and points
--  the blocks at them; that happens in the editor (src/lib/page-templates.ts).
--
--  Templates belong to the console, not to a customer: admin only, read and
--  write. The built-in starters live in code and are not stored here.
-- =====================================================================

create table if not exists public.page_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  icon        text        not null default 'file',
  blocks      jsonb       not null default '[]'::jsonb,
  -- [{ "id": text, "name": text, "fields": [...] }] — definitions only, no rows.
  collections jsonb       not null default '[]'::jsonb,
  created_by  uuid        references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint page_templates_name_not_blank check (length(trim(name)) > 0),
  constraint page_templates_blocks_is_array check (jsonb_typeof(blocks) = 'array'),
  constraint page_templates_collections_is_array check (jsonb_typeof(collections) = 'array')
);

drop trigger if exists page_templates_touch on public.page_templates;
create trigger page_templates_touch before update on public.page_templates
  for each row execute function public.touch_updated_at();

alter table public.page_templates enable row level security;

drop policy if exists "page_templates_admin" on public.page_templates;
create policy "page_templates_admin" on public.page_templates
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';
