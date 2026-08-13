-- =====================================================================
--  Fatura.co — subscriptions and payments
--
--  Deliberately processor-agnostic. Albania is not a supported Stripe
--  merchant country and PayPal receiving is unreliable there, so the schema
--  records *a payment* with a method and a provider reference rather than
--  modelling any one gateway. Bank transfer works today with no third party;
--  card/PayPal drop in later without a migration.
--
--  Money is stored in whole Lek (integer), same as invoices.
-- =====================================================================

-- Pro is now time-bounded rather than a permanent flag.
alter table public.profiles
  add column if not exists pro_until timestamptz;

-- ---------------------------------------------------------------------
-- 1. Payments
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid        not null references public.profiles (id) on delete cascade,

  method       text        not null check (method in ('bank_transfer', 'card', 'paypal')),
  status       text        not null default 'pending'
               check (status in ('pending', 'confirmed', 'rejected', 'refunded')),

  amount       integer     not null check (amount > 0),
  currency     text        not null default 'ALL',
  months       integer     not null default 1 check (months between 1 and 24),

  -- Human-quotable code the customer puts in the transfer description.
  reference    text        not null unique,
  -- Gateway's own id (PayPal order id, acquirer transaction id, …).
  provider_ref text,

  notes        text,
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles (id) on delete set null
);

create index if not exists payments_owner_created_idx
  on public.payments (owner_id, created_at desc);
create index if not exists payments_status_idx
  on public.payments (status) where status = 'pending';

alter table public.payments enable row level security;

-- A user sees their own payments and may open one. They may NOT set the
-- status: confirmation happens through an admin-only function below.
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select to authenticated
  using (auth.uid() = owner_id or public.is_admin());

-- Deliberately NO insert policy either. create_payment() is SECURITY DEFINER
-- and is the only way a row is created, so `amount` is always server-computed;
-- an insert policy would let a caller open a 1-Lek "subscription" that an admin
-- might wave through. No UPDATE/DELETE policy: payments are immutable over the API.
drop policy if exists "payments_insert_own" on public.payments;

-- Belt and braces — a user cannot flip their own payment to confirmed even if
-- an UPDATE policy is ever added by mistake.
create or replace function public.protect_payment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claims', true) is not null
     and current_setting('request.jwt.claims', true) <> ''
     and not public.is_admin()
  then
    new.status       := old.status;
    new.decided_at   := old.decided_at;
    new.decided_by   := old.decided_by;
    new.amount       := old.amount;
    new.months       := old.months;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_payment_status_trigger on public.payments;
create trigger protect_payment_status_trigger
  before update on public.payments
  for each row execute function public.protect_payment_status();

-- ---------------------------------------------------------------------
-- 2. Is Pro actually active?
-- ---------------------------------------------------------------------
-- Redefined here: 0004's version pinned is_pro for *any* JWT-bearing request,
-- which blocked admin_decide_payment from ever activating Pro. Admins may set
-- these columns; everyone else has them (including pro_until) pinned.
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claims', true) is not null
     and current_setting('request.jwt.claims', true) <> ''
     and not public.is_admin()
  then
    new.is_pro    := old.is_pro;
    new.is_admin  := old.is_admin;
    new.pro_until := old.pro_until;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_plan_trigger on public.profiles;
create trigger protect_profile_plan_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_plan();

create or replace function public.has_active_pro(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_pro and (p.pro_until is null or p.pro_until > now())
       from public.profiles p where p.id = p_user),
    false
  );
$$;

-- The quota must respect expiry, not just the boolean.
create or replace function public.enforce_invoice_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_limit integer := public.free_invoice_limit();
begin
  if public.has_active_pro(new.owner_id) then
    return new;
  end if;

  select count(*) into v_count
    from public.invoices
   where owner_id = new.owner_id
     and created_at >= date_trunc('month', now());

  if v_count >= v_limit then
    raise exception 'FREE_PLAN_LIMIT_REACHED'
      using errcode = 'check_violation',
            hint = 'Kalo ne planin Pro per fatura te palimituara.';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Opening a payment (server-side, so amount cannot be forged)
-- ---------------------------------------------------------------------
create or replace function public.create_payment(
  p_method text,
  p_months integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_months    integer := least(greatest(coalesce(p_months, 1), 1), 24);
  v_price     integer := 990;              -- Lek per month
  v_reference text;
  v_id        uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  if p_method not in ('bank_transfer', 'card', 'paypal') then
    raise exception 'INVALID_METHOD' using errcode = 'check_violation';
  end if;

  -- Reuse an open bank-transfer request rather than issuing a second reference
  -- for the same person; two references invite a mis-matched payment.
  if p_method = 'bank_transfer' then
    select id, reference into v_id, v_reference
      from public.payments
     where owner_id = v_user and method = 'bank_transfer' and status = 'pending'
     order by created_at desc
     limit 1;

    if v_id is not null then
      return jsonb_build_object(
        'id', v_id, 'reference', v_reference,
        'amount', v_price * v_months, 'months', v_months, 'reused', true
      );
    end if;
  end if;

  v_reference := 'FAT-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

  insert into public.payments (owner_id, method, amount, months, reference)
  values (v_user, p_method, v_price * v_months, v_months, v_reference)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'reference', v_reference,
    'amount', v_price * v_months, 'months', v_months, 'reused', false
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Admin: review queue and decisions
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
    select pay.id, pay.reference, pay.method, pay.amount, pay.months,
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

create or replace function public.admin_decide_payment(
  p_payment_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_pay   public.payments%rowtype;
  v_from  timestamptz;
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
     set status     = case when p_approve then 'confirmed' else 'rejected' end,
         decided_at = now(),
         decided_by = v_admin,
         notes      = coalesce(p_note, notes)
   where id = p_payment_id;

  if p_approve then
    -- Extend from the later of now and the existing expiry, so paying early
    -- adds time instead of throwing it away.
    select greatest(now(), coalesce(pro_until, now())) into v_from
      from public.profiles where id = v_pay.owner_id;

    update public.profiles
       set is_pro    = true,
           pro_until = v_from + (v_pay.months || ' months')::interval
     where id = v_pay.owner_id;
  end if;

  return jsonb_build_object('id', p_payment_id, 'approved', p_approve);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Surface subscription state to the app shell
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
    'pro_active', public.has_active_pro(auth.uid()),
    'pending_payment', (
      select to_jsonb(x) from (
        select id, reference, method, amount, months, created_at
          from public.payments
         where owner_id = auth.uid() and status = 'pending'
         order by created_at desc limit 1
      ) x
    )
  );
$$;

-- Admin stats should count *paying* subscribers, not the raw flag.
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
    'pro_users',        (select count(*) from public.profiles
                          where is_pro and (pro_until is null or pro_until > now())),
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
    'mrr_all',          (select count(*) * 990 from public.profiles
                          where is_pro and (pro_until is null or pro_until > now())),
    -- Real money actually collected, by state.
    'revenue_confirmed',(select coalesce(sum(amount), 0) from public.payments where status = 'confirmed'),
    'revenue_30d',      (select coalesce(sum(amount), 0) from public.payments
                          where status = 'confirmed' and decided_at >= now() - interval '30 days'),
    'payments_pending', (select count(*) from public.payments where status = 'pending')
  ) into v_result;

  return v_result;
end;
$$;

notify pgrst, 'reload schema';
