-- =====================================================================
--  Fatura.co — a third plan: Starter (1000 Lek / 30 fatura në muaj)
--
--  Until now a business was either free (5 invoices a month) or Pro
--  (unlimited), and that binary was baked into a single boolean. Starter sits
--  between them, which means the plan has to become a *value* rather than a
--  flag.
--
--  The shape chosen here deliberately keeps `is_pro` meaning "has a paid
--  subscription running", because everything already built on it — cancel /
--  resume, pro_until stacking, the paid-account delete guard, the activity
--  trigger — is about *paying*, not about which tier. The new `plan` column
--  answers the separate question of *what was bought*, and only the quota and
--  the price read it.
--
--    profiles.plan   free | starter | pro   (free whenever nothing is paid)
--    payments.plan   starter | pro          (what this payment buys)
--
--  Two invariants worth stating, because both are load-bearing:
--
--    1. `plan` is pinned by protect_profile_plan(). RLS lets a user UPDATE
--       their own profile row, so without this any browser holding the (public)
--       anon key could PATCH itself onto Pro. Same class of hole as is_pro.
--    2. The amount charged is still computed server-side, now from
--       plan_monthly_price(plan). The browser picks a plan and a term; it never
--       sends a price.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists plan text not null default 'free';

do $$
begin
  alter table public.profiles
    add constraint profiles_plan_check check (plan in ('free', 'starter', 'pro'));
exception
  when duplicate_object then null;
end $$;

comment on column public.profiles.plan is
  'Tier bought: free | starter | pro. Meaningful only while is_pro and pro_until say the subscription is live — read it through active_plan().';

-- Everyone paying today bought what is now called Pro. Without this backfill
-- an existing subscriber would silently drop to the Starter quota.
update public.profiles
   set plan = 'pro'
 where is_pro and plan = 'free';

alter table public.payments
  add column if not exists plan text not null default 'pro';

do $$
begin
  alter table public.payments
    add constraint payments_plan_check check (plan in ('starter', 'pro'));
exception
  when duplicate_object then null;
end $$;

comment on column public.payments.plan is
  'Tier this payment buys. Historic rows default to pro, which is what they were.';

-- ---------------------------------------------------------------------
-- 2. Prices and quotas — one source of truth each
-- ---------------------------------------------------------------------
create or replace function public.plan_monthly_price(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
           when 'starter' then 1000
           when 'pro'     then 2000
           else 0
         end;
$$;

comment on function public.plan_monthly_price(text) is
  'Plan price in whole Lek per month. The single source of truth; mirrored for display only in src/lib/plans.ts.';

-- Kept so callers that predate Starter keep working unchanged.
create or replace function public.pro_monthly_price()
returns integer
language sql
immutable
as $$ select public.plan_monthly_price('pro'); $$;

-- Keep in sync with PLANS in src/lib/plans.ts.
create or replace function public.plan_invoice_limit(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
           when 'pro'     then null      -- unlimited
           when 'starter' then 30
           else public.free_invoice_limit()
         end;
$$;

comment on function public.plan_invoice_limit(text) is
  'Invoices allowed per calendar month. NULL means unlimited (Pro).';

-- What the user is actually entitled to right now: the tier they bought, but
-- only while the subscription has not lapsed. One place, so no caller has to
-- remember to check pro_until alongside plan.
create or replace function public.active_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case
              when p.is_pro and (p.pro_until is null or p.pro_until > now())
                then coalesce(nullif(p.plan, 'free'), 'pro')
              else 'free'
            end
       from public.profiles p where p.id = p_user),
    'free'
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Self-promotion guard — `plan` joins the pinned columns
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role and admins are exempt: those are the paths that legitimately
  -- grant a plan and change roles.
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;

  new.is_pro      := old.is_pro;
  new.pro_until   := old.pro_until;
  new.plan        := old.plan;
  new.is_admin    := old.is_admin;
  new.is_manager  := old.is_manager;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. The quota, per tier
-- ---------------------------------------------------------------------
create or replace function public.enforce_invoice_quota()
returns trigger
language plpgsql
security definer                 -- must read profiles past RLS
set search_path = public
as $$
declare
  v_plan  text    := public.active_plan(new.owner_id);
  v_limit integer := public.plan_invoice_limit(v_plan);
  v_count integer;
begin
  if v_limit is null then
    return new;                  -- Pro is unlimited
  end if;

  select count(*) into v_count
    from public.invoices
   where owner_id = new.owner_id
     and created_at >= date_trunc('month', now());

  if v_count >= v_limit then
    -- The app maps these tokens to localised messages; don't translate here.
    if v_plan = 'starter' then
      raise exception 'STARTER_PLAN_LIMIT_REACHED'
        using errcode = 'check_violation',
              hint = 'Kalo ne planin Pro per fatura te palimituara.';
    else
      raise exception 'FREE_PLAN_LIMIT_REACHED'
        using errcode = 'check_violation',
              hint = 'Kalo ne nje plan me te larte per me shume fatura.';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Opening a payment for a chosen plan
--
--    Adding a parameter with a default does NOT replace the old function, it
--    overloads it — and a two-argument call would then be ambiguous. The old
--    signature is dropped first, on purpose.
-- ---------------------------------------------------------------------
drop function if exists public.create_payment(text, integer);

create or replace function public.create_payment(
  p_method text,
  p_months integer default 1,
  p_plan   text default 'pro'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_months    integer := least(greatest(coalesce(p_months, 1), 1), 24);
  v_plan      text := coalesce(p_plan, 'pro');
  v_price     integer;
  v_reference text;
  v_id        uuid;
  v_row       public.payments%rowtype;
  v_attempt   integer := 0;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  if p_method not in ('bank_transfer', 'card', 'paypal') then
    raise exception 'INVALID_METHOD' using errcode = 'check_violation';
  end if;

  if v_plan not in ('starter', 'pro') then
    raise exception 'INVALID_PLAN' using errcode = 'check_violation';
  end if;

  v_price := public.plan_monthly_price(v_plan);

  -- Reuse an open bank-transfer request rather than issuing a second reference
  -- for the same person; two live references invite a mis-matched payment. The
  -- reused row is returned as-is — including its own plan and term — so the UI
  -- can say which request is still waiting instead of quietly repricing it.
  if p_method = 'bank_transfer' then
    select * into v_row
      from public.payments
     where owner_id = v_user and method = 'bank_transfer' and status = 'pending'
     order by created_at desc
     limit 1;

    if found then
      return jsonb_build_object(
        'id', v_row.id, 'reference', v_row.reference,
        'amount', v_row.amount, 'months', v_row.months,
        'plan', v_row.plan, 'reused', true
      );
    end if;
  end if;

  -- 8 hex chars from a v4 uuid. Retry on the (vanishingly unlikely) collision
  -- rather than letting the unique constraint surface as a 500.
  loop
    v_attempt := v_attempt + 1;
    v_reference := 'FAT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.payments where reference = v_reference);
    if v_attempt >= 5 then
      raise exception 'REFERENCE_GENERATION_FAILED' using errcode = 'internal_error';
    end if;
  end loop;

  insert into public.payments (owner_id, method, amount, months, reference, plan)
  values (v_user, p_method, v_price * v_months, v_months, v_reference, v_plan)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'reference', v_reference,
    'amount', v_price * v_months, 'months', v_months,
    'plan', v_plan, 'reused', false
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Confirming a payment activates the tier that was bought
--
--    Time still stacks from the later of now and the current expiry, so paying
--    early never throws days away. The plan, however, is taken from the
--    payment: buying Starter while Pro runs is a deliberate downgrade and the
--    checkout says so before the reference is issued.
-- ---------------------------------------------------------------------
create or replace function public.admin_decide_payment(
  p_payment_id uuid, p_approve boolean, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_admin uuid := auth.uid(); v_pay public.payments%rowtype; v_from timestamptz;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_pay.status <> 'pending' then
    raise exception 'PAYMENT_ALREADY_DECIDED' using errcode = 'check_violation';
  end if;

  update public.payments
     set status = case when p_approve then 'confirmed' else 'rejected' end,
         decided_at = now(), decided_by = v_admin, notes = coalesce(p_note, notes)
   where id = p_payment_id;

  if p_approve then
    select greatest(now(), coalesce(pro_until, now())) into v_from
      from public.profiles where id = v_pay.owner_id;
    update public.profiles
       set is_pro       = true,
           plan         = v_pay.plan,
           pro_until    = v_from + (v_pay.months || ' months')::interval,
           cancelled_at = null
     where id = v_pay.owner_id;
  end if;

  perform public.log_admin_action(
    case when p_approve then 'payment.approve' else 'payment.reject' end,
    v_pay.owner_id,
    jsonb_build_object('payment_id', p_payment_id, 'reference', v_pay.reference,
                       'amount', v_pay.amount, 'months', v_pay.months,
                       'plan', v_pay.plan));

  return jsonb_build_object('id', p_payment_id, 'approved', p_approve);
end;
$$;

create or replace function public.confirm_paid_payment(
  p_payment_id uuid, p_provider_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_pay public.payments%rowtype; v_from timestamptz;
begin
  if not (public.is_service_role() or public.is_admin()) then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;
  if v_pay.status = 'confirmed' then
    return jsonb_build_object('id', p_payment_id, 'already', true);
  end if;
  if v_pay.status <> 'pending' then
    raise exception 'PAYMENT_ALREADY_DECIDED' using errcode = 'check_violation';
  end if;

  update public.payments
     set status = 'confirmed', provider_ref = coalesce(p_provider_ref, provider_ref),
         decided_at = now()
   where id = p_payment_id;

  select greatest(now(), coalesce(pro_until, now())) into v_from
    from public.profiles where id = v_pay.owner_id;

  update public.profiles
     set is_pro = true,
         plan = v_pay.plan,
         pro_until = v_from + (v_pay.months || ' months')::interval,
         cancelled_at = null
   where id = v_pay.owner_id;

  return jsonb_build_object('id', p_payment_id, 'already', false);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Admin grant / revoke, per tier
-- ---------------------------------------------------------------------
drop function if exists public.admin_set_pro(uuid, integer, boolean);

create or replace function public.admin_set_pro(
  p_user uuid,
  p_months integer default 1,
  p_revoke boolean default false,
  p_plan   text default 'pro'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_from timestamptz; v_until timestamptz; v_plan text := coalesce(p_plan, 'pro');
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  if p_revoke then
    update public.profiles
       set is_pro = false, plan = 'free', pro_until = null, cancelled_at = null
     where id = p_user;
    perform public.log_admin_action('pro.revoke', p_user, '{}'::jsonb);
    return jsonb_build_object('is_pro', false, 'plan', 'free');
  end if;

  if v_plan not in ('starter', 'pro') then
    raise exception 'INVALID_PLAN' using errcode = 'check_violation';
  end if;

  select greatest(now(), coalesce(pro_until, now())) into v_from
    from public.profiles where id = p_user;

  v_until := v_from + (least(greatest(coalesce(p_months, 1), 1), 36) || ' months')::interval;

  update public.profiles
     set is_pro = true, plan = v_plan, pro_until = v_until, cancelled_at = null
   where id = p_user;
  perform public.log_admin_action('pro.grant', p_user,
    jsonb_build_object('months', p_months, 'until', v_until, 'plan', v_plan));

  return jsonb_build_object('is_pro', true, 'plan', v_plan, 'pro_until', v_until);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. What the app shell needs to render a quota it can trust
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
    )
  );
$$;

-- ---------------------------------------------------------------------
-- 9. Console: the tier travels with every row it lists
-- ---------------------------------------------------------------------
create or replace function public.admin_pending_payments()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc), '[]'::jsonb)
    into v_result
  from (
    select pay.id, pay.reference, pay.method, pay.amount, pay.months, pay.plan,
           pay.status, pay.created_at, pay.provider_ref,
           p.business_name, p.city
      from public.payments pay
      join public.profiles p on p.id = pay.owner_id
     where pay.status = 'pending'
     order by pay.created_at desc
     limit 100
  ) x;

  return v_result;
end;
$$;

create or replace function public.admin_payments(
  p_status text default 'all', p_limit integer default 50, p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rows jsonb; v_total integer;
        v_lim integer := least(greatest(coalesce(p_limit,50),1),200);
        v_off integer := greatest(coalesce(p_offset,0),0);
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  with base as (
    select pay.id, pay.reference, pay.method, pay.amount, pay.months, pay.plan,
           pay.status, pay.created_at, pay.decided_at, pay.provider_ref, pay.notes,
           p.business_name, p.city, p.id as owner_id
      from public.payments pay
      join public.profiles p on p.id = pay.owner_id
     where coalesce(p_status,'all') = 'all' or pay.status = p_status
  )
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb),
         (select count(*) from base)
    into v_rows, v_total
  from (select * from base order by created_at desc limit v_lim offset v_off) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

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

-- The overview's recent-signups table shows a plan chip, so the tier has to
-- travel with the row. Still business name and city only — no NIPT, no phone.
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
      public.active_plan(p.id) as plan,
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
-- 10. Stats: MRR is now a sum of two prices, not a count times one
-- ---------------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'total_users',      (select count(*) from public.profiles),
    -- Every paying subscriber, whichever tier. Kept under the old name so the
    -- console's existing tiles do not change meaning.
    'pro_users',        (select count(*) from public.profiles
                          where is_pro and (pro_until is null or pro_until > now())),
    'starter_users',    (select count(*) from public.profiles
                          where is_pro and (pro_until is null or pro_until > now())
                            and plan = 'starter'),
    'pro_plan_users',   (select count(*) from public.profiles
                          where is_pro and (pro_until is null or pro_until > now())
                            and plan <> 'starter'),
    'cancelling_users', (select count(*) from public.profiles
                          where cancelled_at is not null
                            and is_pro and (pro_until is null or pro_until > now())),
    'onboarded_users',  (select count(*) from public.profiles where business_name is not null),
    'users_with_logo',  (select count(*) from public.profiles where logo_url is not null),
    'new_users_30d',    (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'new_users_7d',     (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'active_users_30d', (select count(distinct owner_id) from public.invoices
                          where created_at >= now() - interval '30 days'),
    'active_users_7d',  (select count(distinct owner_id) from public.invoices
                          where created_at >= now() - interval '7 days'),
    'total_invoices',   (select count(*) from public.invoices),
    'invoices_30d',     (select count(*) from public.invoices where created_at >= now() - interval '30 days'),
    'invoiced_total',   (select coalesce(sum(total), 0) from public.invoices),
    'invoiced_paid',    (select coalesce(sum(total), 0) from public.invoices where status = 'paid'),
    'total_clients',    (select count(*) from public.clients),
    'waitlist_total',   (select count(*) from public.waitlist_fatura),
    'waitlist_7d',      (select count(*) from public.waitlist_fatura
                          where created_at >= now() - interval '7 days'),
    'monthly_price',        public.pro_monthly_price(),
    'starter_monthly_price', public.plan_monthly_price('starter'),
    'mrr_all',          (select coalesce(sum(public.plan_monthly_price(
                            case when plan = 'starter' then 'starter' else 'pro' end)), 0)
                           from public.profiles
                          where is_pro and (pro_until is null or pro_until > now())
                            and cancelled_at is null),
    'revenue_confirmed',(select coalesce(sum(amount), 0) from public.payments where status = 'confirmed'),
    'revenue_30d',      (select coalesce(sum(amount), 0) from public.payments
                          where status = 'confirmed' and decided_at >= now() - interval '30 days'),
    'payments_pending', (select count(*) from public.payments where status = 'pending')
  ) into v_result;

  return v_result;
end;
$$;

notify pgrst, 'reload schema';
