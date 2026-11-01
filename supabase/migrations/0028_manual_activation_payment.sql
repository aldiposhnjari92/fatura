-- =====================================================================
--  Fatura.co — a manual activation is recorded as a paid payment
--
--  Until now, giving a business Starter or Pro from the console changed the
--  profile and nothing else. The dashboard's revenue (admin_stats:
--  revenue_confirmed, revenue_30d) and the customer's own payment history
--  both read `payments`, so a package the admin activated after being paid
--  in cash or by hand never showed up as money received.
--
--  admin_set_pro() now writes a confirmed payment alongside the grant:
--  method 'manual', the plan's price × the months given — priced by
--  plan_monthly_price(), the same source of truth checkout uses, never by a
--  number from the browser.
-- =====================================================================

-- 'manual' joins the payment methods.
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments
  add constraint payments_method_check
  check (method in ('bank_transfer', 'card', 'paypal', 'manual'));

-- The console grants up to 36 months; a payment must be able to say so.
alter table public.payments drop constraint if exists payments_months_check;
alter table public.payments
  add constraint payments_months_check check (months between 1 and 36);

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
declare
  v_from      timestamptz;
  v_until     timestamptz;
  v_plan      text := coalesce(p_plan, 'pro');
  v_months    integer := least(greatest(coalesce(p_months, 1), 1), 36);
  v_amount    integer;
  v_reference text;
  v_payment   uuid;
  v_attempt   integer := 0;
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
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  v_until := v_from + (v_months || ' months')::interval;

  update public.profiles
     set is_pro = true, plan = v_plan, pro_until = v_until, cancelled_at = null
   where id = p_user;

  -- The money side: a confirmed payment at the package's own price.
  v_amount := public.plan_monthly_price(v_plan) * v_months;

  loop
    v_attempt := v_attempt + 1;
    v_reference := 'MAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.payments where reference = v_reference);
    if v_attempt >= 5 then
      raise exception 'REFERENCE_GENERATION_FAILED' using errcode = 'internal_error';
    end if;
  end loop;

  insert into public.payments (
    owner_id, method, status, amount, months, plan, reference, notes, decided_at, decided_by
  )
  values (
    p_user, 'manual', 'confirmed', v_amount, v_months, v_plan, v_reference,
    'Aktivizuar manualisht nga admini', now(), auth.uid()
  )
  returning id into v_payment;

  perform public.log_admin_action('pro.grant', p_user,
    jsonb_build_object('months', v_months, 'until', v_until, 'plan', v_plan,
                       'amount', v_amount, 'payment_id', v_payment, 'reference', v_reference));

  return jsonb_build_object(
    'is_pro', true, 'plan', v_plan, 'pro_until', v_until,
    'amount', v_amount, 'payment_id', v_payment, 'reference', v_reference
  );
end;
$$;

comment on function public.admin_set_pro(uuid, integer, boolean, text) is
  'Admin grants or revokes a paid plan. A grant also records a confirmed manual payment at plan_monthly_price × months, so it counts as revenue.';

notify pgrst, 'reload schema';
