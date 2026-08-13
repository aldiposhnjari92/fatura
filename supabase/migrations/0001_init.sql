-- =====================================================================
--  Fatura.co — initial schema
--  Run in Supabase SQL editor, or: supabase db push
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  nipt          text,
  address       text,
  city          text        default 'Fier',
  phone         text,
  logo_url      text,
  is_pro        boolean     not null default false,
  created_at    timestamptz not null default now()
);

comment on table public.profiles is 'One row per authenticated user: their business identity, printed on every invoice.';
comment on column public.profiles.nipt is 'Albanian tax ID (Numri i Identifikimit per Personin e Tatueshem).';

-- ---------------------------------------------------------------------
-- 2. clients
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null,
  email      text,
  nipt       text,
  address    text,
  created_at timestamptz not null default now()
);

create index if not exists clients_owner_id_idx on public.clients (owner_id);
create index if not exists clients_owner_name_idx on public.clients (owner_id, name);

-- ---------------------------------------------------------------------
-- 3. invoices
-- ---------------------------------------------------------------------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid        not null references public.profiles (id) on delete cascade,
  client_id      uuid        references public.clients (id) on delete set null,
  invoice_number text        not null,
  issue_date     date        not null default now(),
  due_date       date,
  -- [{ "description": text, "quantity": int, "price": int }, ...]
  items          jsonb       not null default '[]'::jsonb,
  subtotal       integer     not null default 0,
  vat_percent    integer     not null default 0,
  discount       integer     not null default 0,
  total          integer     not null default 0,
  status         text        not null default 'draft'
                 check (status in ('draft', 'paid', 'unpaid', 'overdue')),
  notes          text,
  language       text        not null default 'en' check (language in ('en', 'sq')),
  created_at     timestamptz not null default now(),

  -- an invoice number is unique per business, not globally
  constraint invoices_owner_number_unique unique (owner_id, invoice_number),
  constraint invoices_items_is_array check (jsonb_typeof(items) = 'array'),
  constraint invoices_vat_range check (vat_percent between 0 and 100),
  constraint invoices_discount_non_negative check (discount >= 0)
);

create index if not exists invoices_owner_id_idx on public.invoices (owner_id);
create index if not exists invoices_owner_created_idx on public.invoices (owner_id, created_at desc);
create index if not exists invoices_client_id_idx on public.invoices (client_id);
create index if not exists invoices_owner_status_idx on public.invoices (owner_id, status);

comment on column public.invoices.subtotal is 'All money columns are whole Lek (ALL). No decimals anywhere.';

-- ---------------------------------------------------------------------
-- 4. waitlist_fatura  (public landing-page capture)
-- ---------------------------------------------------------------------
create table if not exists public.waitlist_fatura (
  id            uuid primary key default gen_random_uuid(),
  business_name text,
  whatsapp      text,
  city          text,
  created_at    timestamptz not null default now()
);

create index if not exists waitlist_fatura_created_idx on public.waitlist_fatura (created_at desc);

-- =====================================================================
--  Row Level Security
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.clients         enable row level security;
alter table public.invoices        enable row level security;
alter table public.waitlist_fatura enable row level security;

-- profiles: a user sees and edits only their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- clients
drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own" on public.clients
  for select using (auth.uid() = owner_id);

drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own" on public.clients
  for insert with check (auth.uid() = owner_id);

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own" on public.clients
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own" on public.clients
  for delete using (auth.uid() = owner_id);

-- invoices
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = owner_id);

drop policy if exists "invoices_insert_own" on public.invoices;
create policy "invoices_insert_own" on public.invoices
  for insert with check (auth.uid() = owner_id);

drop policy if exists "invoices_update_own" on public.invoices;
create policy "invoices_update_own" on public.invoices
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "invoices_delete_own" on public.invoices;
create policy "invoices_delete_own" on public.invoices
  for delete using (auth.uid() = owner_id);

-- waitlist: anyone (incl. anon) may insert; nobody may read back over the API.
drop policy if exists "waitlist_insert_anyone" on public.waitlist_fatura;
create policy "waitlist_insert_anyone" on public.waitlist_fatura
  for insert to anon, authenticated with check (true);

-- =====================================================================
--  Auto-create a profile whenever a user signs up
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, business_name, city)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'business_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'city', ''), 'Fier')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  Next invoice number helper: FAT-2025-001, per business, per year
-- =====================================================================
create or replace function public.next_invoice_number(p_year int default null)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_year int := coalesce(p_year, extract(year from now())::int);
  v_max  int;
begin
  select coalesce(
           max((regexp_match(invoice_number, '^FAT-' || v_year || '-(\d+)$'))[1]::int),
           0)
    into v_max
    from public.invoices
   where owner_id = auth.uid()
     and invoice_number ~ ('^FAT-' || v_year || '-\d+$');

  return 'FAT-' || v_year || '-' || lpad((v_max + 1)::text, 3, '0');
end;
$$;

-- =====================================================================
--  Storage lives in 0002_storage.sql — deliberately.
--
--  Each migration file runs inside ONE transaction. Policies on
--  storage.objects can fail with insufficient_privilege depending on the
--  role, and if that happened here it would roll back every table above
--  it, leaving a database that looks untouched. Keep them separate.
-- =====================================================================

-- Tell PostgREST to re-introspect, otherwise the API answers PGRST205
-- ("Could not find the table 'public.profiles' in the schema cache")
-- until its cache happens to expire. Fires on commit.
notify pgrst, 'reload schema';
