-- =====================================================================
--  Fatura.co — cancelling a subscription (Netflix-style)
--
--  Cancelling never takes away what was paid for. `has_active_pro()` already
--  gates on `pro_until > now()`, so cancelling only has to record the intent
--  not to renew: Pro keeps working to the end of the paid period and then
--  lapses to free on its own. Nothing revokes access early.
--
--  `cancelled_at` is deliberately NOT read by has_active_pro(). It drives the
--  UI and future renewal reminders only — which is why it is safe for the
--  user to own, and why a bug here can never hand out free Pro.
-- =====================================================================

alter table public.profiles
  add column if not exists cancelled_at timestamptz;

comment on column public.profiles.cancelled_at is
  'When the customer asked not to renew. Access still runs until pro_until.';

-- ---------------------------------------------------------------------
-- 1. Cancel
-- ---------------------------------------------------------------------
create or replace function public.cancel_subscription()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_pro   boolean;
  v_until timestamptz;
  v_done  timestamptz;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  select is_pro, pro_until, cancelled_at
    into v_pro, v_until, v_done
    from public.profiles where id = v_user;

  if not coalesce(v_pro, false) then
    raise exception 'NO_ACTIVE_SUBSCRIPTION' using errcode = 'check_violation';
  end if;

  -- Should not happen: every path that grants Pro sets an end date. Refusing
  -- beats guessing, because "cancel" on an open-ended grant would either take
  -- access away immediately or do nothing at all.
  if v_until is null then
    raise exception 'NO_END_DATE'
      using errcode = 'check_violation',
            hint = 'Abonimi nuk ka date mbarimi. Na shkruaj ne pershendetje@fatura.co.';
  end if;

  if v_done is not null then
    return jsonb_build_object('cancelled_at', v_done, 'pro_until', v_until,
                              'already', true);
  end if;

  update public.profiles set cancelled_at = now() where id = v_user;

  return jsonb_build_object('cancelled_at', now(), 'pro_until', v_until,
                            'already', false);
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Undo, while the period is still running
-- ---------------------------------------------------------------------
create or replace function public.resume_subscription()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_until timestamptz;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  select pro_until into v_until from public.profiles where id = v_user;

  if not public.has_active_pro(v_user) then
    -- Once it has lapsed there is nothing to resume; they buy again.
    raise exception 'SUBSCRIPTION_ALREADY_ENDED' using errcode = 'check_violation';
  end if;

  update public.profiles set cancelled_at = null where id = v_user;

  return jsonb_build_object('cancelled_at', null, 'pro_until', v_until);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Buying again clears the cancellation
--    Otherwise a renewed customer would still be told "Pro ends on ...".
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
           pro_until    = v_from + (v_pay.months || ' months')::interval,
           cancelled_at = null
     where id = v_pay.owner_id;
  end if;

  perform public.log_admin_action(
    case when p_approve then 'payment.approve' else 'payment.reject' end,
    v_pay.owner_id,
    jsonb_build_object('payment_id', p_payment_id, 'reference', v_pay.reference,
                       'amount', v_pay.amount, 'months', v_pay.months));

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
         pro_until = v_from + (v_pay.months || ' months')::interval,
         cancelled_at = null
   where id = v_pay.owner_id;

  return jsonb_build_object('id', p_payment_id, 'already', false);
end;
$$;

-- Admin grant/revoke should keep the flag honest too.
create or replace function public.admin_set_pro(
  p_user uuid, p_months integer default 1, p_revoke boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_from timestamptz; v_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  if p_revoke then
    update public.profiles
       set is_pro = false, pro_until = null, cancelled_at = null
     where id = p_user;
    perform public.log_admin_action('pro.revoke', p_user, '{}'::jsonb);
    return jsonb_build_object('is_pro', false);
  end if;

  select greatest(now(), coalesce(pro_until, now())) into v_from
    from public.profiles where id = p_user;

  v_until := v_from + (least(greatest(coalesce(p_months, 1), 1), 36) || ' months')::interval;

  update public.profiles
     set is_pro = true, pro_until = v_until, cancelled_at = null
   where id = p_user;
  perform public.log_admin_action('pro.grant', p_user,
    jsonb_build_object('months', p_months, 'until', v_until));

  return jsonb_build_object('is_pro', true, 'pro_until', v_until);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Expose the state to the app shell and the console
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
    -- Paid, still running, but told us they are leaving. The churn signal.
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
    'mrr_all',          (select count(*) * 990 from public.profiles
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
