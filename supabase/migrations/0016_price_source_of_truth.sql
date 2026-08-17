-- =====================================================================
--  Fatura.co — the Pro price, in one place
--
--  It was written out three times: in create_payment() (the amount actually
--  charged), in admin_stats()'s MRR, and as a TypeScript constant for display.
--  Three copies of a number that must agree is a bug waiting for the next
--  price change — the charge and the advertised price could silently diverge.
--
--  The database now owns it. TypeScript still holds a constant for rendering
--  prices without a round trip, but the amount a customer is charged is read
--  from here and never from the browser.
-- =====================================================================

create or replace function public.pro_monthly_price()
returns integer
language sql
immutable
as $$ select 2000; $$;

comment on function public.pro_monthly_price() is
  'Pro plan price in whole Lek per month. The single source of truth.';
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
  v_price     integer := public.pro_monthly_price();
  v_reference text;
  v_id        uuid;
  v_attempt   integer := 0;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'insufficient_privilege';
  end if;

  if p_method not in ('bank_transfer', 'card', 'paypal') then
    raise exception 'INVALID_METHOD' using errcode = 'check_violation';
  end if;

  -- Reuse an open bank-transfer request rather than issuing a second reference
  -- for the same person; two live references invite a mis-matched payment.
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

  insert into public.payments (owner_id, method, amount, months, reference)
  values (v_user, p_method, v_price * v_months, v_months, v_reference)
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'reference', v_reference,
    'amount', v_price * v_months, 'months', v_months, 'reused', false
  );
end;
$$;
-- MRR follows the same function, so it can never quote a stale price.
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
    'monthly_price',    public.pro_monthly_price(),
    'mrr_all',          (select count(*) * public.pro_monthly_price() from public.profiles
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
