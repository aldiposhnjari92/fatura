-- =====================================================================
--  Fatura.co — admin panel
--
--  Design rule: RLS stays strict. Admins do NOT get a blanket "select any
--  row" policy, because one bug in a page would then leak every business's
--  invoices. Instead the panel reads *aggregates only*, through
--  SECURITY DEFINER functions that check `is_admin()` before returning
--  anything. The blast radius of a mistake is a count, not a customer list.
-- =====================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------------
-- 1. Who is an admin
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer                 -- must read profiles past RLS
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Self-promotion guard. 0003 protected is_pro; is_admin needs the same, or a
-- user could grant themselves the whole panel with one PATCH to /profiles.
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claims', true) is not null
     and current_setting('request.jwt.claims', true) <> '' then
    -- Request arrived through PostgREST: privileged columns are immutable.
    new.is_pro   := old.is_pro;
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_plan_trigger on public.profiles;
create trigger protect_profile_plan_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_plan();

-- ---------------------------------------------------------------------
-- 2. Aggregate metrics
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'total_users',        (select count(*) from public.profiles),
    'pro_users',          (select count(*) from public.profiles where is_pro),
    'onboarded_users',    (select count(*) from public.profiles where business_name is not null),
    'users_with_logo',    (select count(*) from public.profiles where logo_url is not null),
    'new_users_30d',      (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'new_users_7d',       (select count(*) from public.profiles where created_at >= now() - interval '7 days'),

    -- "Active" = actually produced an invoice in the window, not just signed up.
    'active_users_30d',   (select count(distinct owner_id) from public.invoices
                            where created_at >= now() - interval '30 days'),
    'active_users_7d',    (select count(distinct owner_id) from public.invoices
                            where created_at >= now() - interval '7 days'),

    'total_invoices',     (select count(*) from public.invoices),
    'invoices_30d',       (select count(*) from public.invoices where created_at >= now() - interval '30 days'),
    'invoiced_total',     (select coalesce(sum(total), 0) from public.invoices),
    'invoiced_paid',      (select coalesce(sum(total), 0) from public.invoices where status = 'paid'),
    'total_clients',      (select count(*) from public.clients),
    'waitlist_total',     (select count(*) from public.waitlist_fatura),
    'waitlist_7d',        (select count(*) from public.waitlist_fatura
                            where created_at >= now() - interval '7 days'),

    -- MRR in Lek: 990 per Pro subscriber.
    'mrr_all',            (select count(*) * 990 from public.profiles where is_pro)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Signup trend — 30 daily buckets for the chart
-- ---------------------------------------------------------------------
create or replace function public.admin_signup_series()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(d) order by d.day), '[]'::jsonb)
    into v_result
  from (
    select
      g::date                                                        as day,
      (select count(*) from public.profiles p
        where p.created_at::date = g::date)                          as signups,
      (select count(*) from public.invoices i
        where i.created_at::date = g::date)                          as invoices
    from generate_series(
      (now() - interval '29 days')::date, now()::date, interval '1 day'
    ) g
  ) d;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Recent businesses — deliberately narrow
--
--    Business name and city only: enough to recognise a signup, without
--    exposing NIPT, phone, address or any invoice contents.
-- ---------------------------------------------------------------------
create or replace function public.admin_recent_businesses(p_limit integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(b) order by b.created_at desc), '[]'::jsonb)
    into v_result
  from (
    select
      p.business_name,
      p.city,
      p.is_pro,
      p.created_at,
      (select count(*) from public.invoices i where i.owner_id = p.id) as invoice_count
    from public.profiles p
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ) b;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Waitlist, readable by admins only
-- ---------------------------------------------------------------------
drop policy if exists "waitlist_select_admin" on public.waitlist_fatura;
create policy "waitlist_select_admin" on public.waitlist_fatura
  for select to authenticated
  using (public.is_admin());

create index if not exists profiles_created_at_idx on public.profiles (created_at desc);
create index if not exists profiles_is_pro_idx on public.profiles (is_pro) where is_pro;

notify pgrst, 'reload schema';
