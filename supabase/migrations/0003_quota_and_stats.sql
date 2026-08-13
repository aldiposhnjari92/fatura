-- =====================================================================
--  Fatura.co — plan enforcement, aggregate helpers, supporting indexes
--
--  Two problems this closes:
--
--  1. SECURITY. The free-plan cap lived only in the UI, so anyone holding
--     the (publicly shipped) anon key could POST straight to PostgREST and
--     create unlimited invoices. RLS proved ownership but never quantity.
--
--  2. PERFORMANCE. The dashboard selected every invoice the user had ever
--     created just to sum them in JavaScript — unbounded transfer that grows
--     forever. These aggregates run in Postgres and return a single row.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Free-plan quota, enforced in the database
-- ---------------------------------------------------------------------

-- Keep in sync with FREE_INVOICE_LIMIT in src/lib/types.ts.
create or replace function public.free_invoice_limit()
returns integer language sql immutable as $$ select 5 $$;

create or replace function public.enforce_invoice_quota()
returns trigger
language plpgsql
security definer                 -- must read profiles.is_pro past RLS
set search_path = public
as $$
declare
  v_is_pro boolean;
  v_count  integer;
  v_limit  integer := public.free_invoice_limit();
begin
  select is_pro into v_is_pro from public.profiles where id = new.owner_id;

  if coalesce(v_is_pro, false) then
    return new;                  -- Pro is unlimited
  end if;

  select count(*) into v_count
    from public.invoices
   where owner_id = new.owner_id
     and created_at >= date_trunc('month', now());

  if v_count >= v_limit then
    -- The app maps this token to an Albanian message; don't localise here.
    raise exception 'FREE_PLAN_LIMIT_REACHED'
      using errcode = 'check_violation',
            hint = 'Kalo ne planin Pro per fatura te palimituara.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_invoice_quota_trigger on public.invoices;
create trigger enforce_invoice_quota_trigger
  before insert on public.invoices
  for each row execute function public.enforce_invoice_quota();

-- A user must never be able to promote themselves to Pro. RLS lets them
-- UPDATE their own profile row, which would otherwise include is_pro.
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_pro is distinct from old.is_pro then
    -- Only a privileged role (service key / SQL editor) may change the plan.
    if current_setting('request.jwt.claims', true) is not null then
      new.is_pro := old.is_pro;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_plan_trigger on public.profiles;
create trigger protect_profile_plan_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_plan();

-- ---------------------------------------------------------------------
-- 2. One round trip for everything the app shell needs
-- ---------------------------------------------------------------------
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
security invoker                 -- RLS still applies; auth.uid() scopes it
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) from public.profiles p where p.id = auth.uid()
    ),
    'invoices_this_month', (
      select count(*) from public.invoices
       where owner_id = auth.uid()
         and created_at >= date_trunc('month', now())
    ),
    'free_invoice_limit', public.free_invoice_limit()
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Dashboard aggregates, computed server-side
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total_invoices',  coalesce((select count(*) from public.invoices where owner_id = auth.uid()), 0),
    'paid_total',      coalesce((select sum(total) from public.invoices where owner_id = auth.uid() and status = 'paid'), 0),
    'outstanding_total', coalesce((select sum(total) from public.invoices where owner_id = auth.uid() and status in ('unpaid','overdue')), 0),
    'overdue_count',   coalesce((select count(*) from public.invoices where owner_id = auth.uid() and status = 'overdue'), 0),
    'draft_count',     coalesce((select count(*) from public.invoices where owner_id = auth.uid() and status = 'draft'), 0),
    'client_count',    coalesce((select count(*) from public.clients  where owner_id = auth.uid()), 0),
    'month_total',     coalesce((select sum(total) from public.invoices
                                  where owner_id = auth.uid()
                                    and issue_date >= date_trunc('month', now())::date), 0),
    'prev_month_total', coalesce((select sum(total) from public.invoices
                                  where owner_id = auth.uid()
                                    and issue_date >= (date_trunc('month', now()) - interval '1 month')::date
                                    and issue_date <  date_trunc('month', now())::date), 0)
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Indexes for the access patterns above
-- ---------------------------------------------------------------------

-- The quota trigger and app_bootstrap both filter owner + created_at.
create index if not exists invoices_owner_created_at_idx
  on public.invoices (owner_id, created_at);

-- Dashboard sums group by status; the list page orders by issue_date.
create index if not exists invoices_owner_issue_date_idx
  on public.invoices (owner_id, issue_date desc);

-- Invoice-number search (`ilike '%…%'`) cannot use a btree; trigram can.
create extension if not exists pg_trgm with schema extensions;
create index if not exists invoices_number_trgm_idx
  on public.invoices using gin (invoice_number extensions.gin_trgm_ops);

notify pgrst, 'reload schema';
