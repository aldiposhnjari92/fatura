-- =====================================================================
--  Fatura.co — per-account features, and the first one: suppliers
--
--  Some businesses ask for screens nobody else needs. Rather than checking
--  for one account id across the code, an account carries a list of feature
--  keys and the app shows what that list turns on. Only the admin can change
--  it — the same guard that pins `plan` pins `features` — and every table a
--  feature owns checks the flag in RLS, so hiding the menu is not the lock.
--
--  Feature keys (mirrored in src/lib/features.ts):
--    • suppliers — Furnitorët (suppliers) and Furnizimet (purchases from them)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The flag list
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists features text[] not null default '{}';

comment on column public.profiles.features is
  'Feature keys switched on for this account by the admin. See src/lib/features.ts.';

-- True when the signed-in account has this feature switched on.
create or replace function public.has_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p_feature = any(features) from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Self-promotion guard — `features` joins the pinned columns
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role and admins are exempt: those are the paths that legitimately
  -- grant a plan, change roles and switch features on.
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;

  new.is_pro      := old.is_pro;
  new.pro_until   := old.pro_until;
  new.plan        := old.plan;
  new.is_admin    := old.is_admin;
  new.is_manager  := old.is_manager;
  new.features    := old.features;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Console: switch a feature on or off for one account
-- ---------------------------------------------------------------------
create or replace function public.admin_set_feature(
  p_user uuid, p_feature text, p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_features text[];
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  if p_feature not in ('suppliers') then
    raise exception 'UNKNOWN_FEATURE' using errcode = 'check_violation';
  end if;

  update public.profiles
     set features = case
           when p_enabled then array(select distinct unnest(features || p_feature))
           else array_remove(features, p_feature)
         end
   where id = p_user
  returning features into v_features;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  perform public.log_admin_action(
    case when p_enabled then 'feature.enable' else 'feature.disable' end,
    p_user, jsonb_build_object('feature', p_feature));

  return jsonb_build_object('features', v_features);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Furnitorët — suppliers
-- ---------------------------------------------------------------------
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid        not null references public.profiles (id) on delete cascade,
  name       text        not null,
  nipt       text,
  phone      text,
  email      text,
  address    text,
  created_at timestamptz not null default now()
);

create index if not exists suppliers_owner_name_idx on public.suppliers (owner_id, name);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_own_with_feature" on public.suppliers;
create policy "suppliers_own_with_feature" on public.suppliers
  for all to authenticated
  using (owner_id = auth.uid() and public.has_feature('suppliers'))
  with check (owner_id = auth.uid() and public.has_feature('suppliers'));

-- ---------------------------------------------------------------------
-- 5. Furnizimet — what was bought, from whom, and whether it is paid
-- ---------------------------------------------------------------------
create table if not exists public.supplies (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid        not null references public.profiles (id) on delete cascade,
  supplier_id     uuid        references public.suppliers (id) on delete set null,
  -- The supplier's own invoice / delivery note number, as printed on it.
  document_number text,
  supply_date     date        not null default now(),
  -- [{ "description": text, "quantity": int, "price": int }, ...] — same shape as invoices
  items           jsonb       not null default '[]'::jsonb,
  total           integer     not null default 0,
  status          text        not null default 'unpaid'
                  check (status in ('paid', 'unpaid')),
  notes           text,
  created_at      timestamptz not null default now(),

  constraint supplies_items_is_array check (jsonb_typeof(items) = 'array'),
  constraint supplies_total_non_negative check (total >= 0)
);

create index if not exists supplies_owner_date_idx on public.supplies (owner_id, supply_date desc);
create index if not exists supplies_supplier_idx on public.supplies (supplier_id);

comment on column public.supplies.total is 'Whole Lek (ALL), the sum of quantity × price over items.';

alter table public.supplies enable row level security;

drop policy if exists "supplies_own_with_feature" on public.supplies;
create policy "supplies_own_with_feature" on public.supplies
  for all to authenticated
  using (owner_id = auth.uid() and public.has_feature('suppliers'))
  with check (owner_id = auth.uid() and public.has_feature('suppliers'));

-- ---------------------------------------------------------------------
-- 6. Console: the feature list travels with every business row
--    (0017's admin_users, plus p.features)
-- ---------------------------------------------------------------------
create or replace function public.admin_users(
  p_search text default null,
  p_filter text default 'all',      -- all | paid | starter | pro | free | admin | inactive
  p_limit  integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rows  jsonb;
  v_total integer;
  v_lim   integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_off   integer := greatest(coalesce(p_offset, 0), 0);
  v_q     text    := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  with base as (
    select p.id, p.business_name, p.city, p.nipt, p.phone, p.is_pro, p.is_admin,
           coalesce(p.is_manager, false) as is_manager,
           p.features,
           p.pro_until, p.logo_url, p.created_at,
           public.active_plan(p.id) as plan,
           u.email,
           (select count(*) from public.invoices i where i.owner_id = p.id)        as invoice_count,
           (select count(*) from public.clients  c where c.owner_id = p.id)        as client_count,
           (select coalesce(sum(i.total), 0) from public.invoices i
             where i.owner_id = p.id)                                              as invoiced_total,
           (select max(i.created_at) from public.invoices i where i.owner_id = p.id) as last_invoice_at,
           (select coalesce(sum(pay.amount), 0) from public.payments pay
             where pay.owner_id = p.id and pay.status = 'confirmed')               as paid_total
      from public.profiles p
      join auth.users u on u.id = p.id
     where (v_q is null
            or p.business_name ilike '%' || v_q || '%'
            or u.email          ilike '%' || v_q || '%'
            or coalesce(p.nipt, '') ilike '%' || v_q || '%')
       and case coalesce(p_filter, 'all')
             -- 'pro' kept meaning "paying" for old bookmarks; 'starter'/'pro'
             -- filter by tier through active_plan().
             when 'paid'     then public.active_plan(p.id) <> 'free'
             when 'pro'      then public.active_plan(p.id) = 'pro'
             when 'starter'  then public.active_plan(p.id) = 'starter'
             when 'free'     then public.active_plan(p.id) = 'free'
             when 'admin'    then p.is_admin
             when 'inactive' then not exists (
                                    select 1 from public.invoices i
                                     where i.owner_id = p.id
                                       and i.created_at >= now() - interval '30 days')
             else true
           end
  )
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb),
         (select count(*) from base)
    into v_rows, v_total
  from (select * from base order by created_at desc limit v_lim offset v_off) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total,
                            'limit', v_lim, 'offset', v_off);
end;
$$;

