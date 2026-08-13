-- =====================================================================
--  Fatura.co — gateway-driven confirmation
--
--  A card/PayPal capture has to mark a payment paid without a human. The
--  obvious version of this function is a hole: if any authenticated user can
--  call it with their own payment id, they confirm a subscription they never
--  paid for.
--
--  So it is restricted to the service role (used only by the server-side API
--  route, whose key is never shipped to the browser) or an admin. The user's
--  own session can never reach it, even though the capture happens during
--  their request.
-- =====================================================================

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_user
  ) in ('service_role', 'postgres', 'supabase_admin');
$$;

create or replace function public.confirm_paid_payment(
  p_payment_id uuid,
  p_provider_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay  public.payments%rowtype;
  v_from timestamptz;
begin
  if not (public.is_service_role() or public.is_admin()) then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  -- Idempotent: a duplicate webhook/capture must not extend the term twice.
  if v_pay.status = 'confirmed' then
    return jsonb_build_object('id', p_payment_id, 'already', true);
  end if;
  if v_pay.status <> 'pending' then
    raise exception 'PAYMENT_ALREADY_DECIDED' using errcode = 'check_violation';
  end if;

  update public.payments
     set status       = 'confirmed',
         provider_ref = coalesce(p_provider_ref, provider_ref),
         decided_at   = now()
   where id = p_payment_id;

  select greatest(now(), coalesce(pro_until, now())) into v_from
    from public.profiles where id = v_pay.owner_id;

  update public.profiles
     set is_pro    = true,
         pro_until = v_from + (v_pay.months || ' months')::interval
   where id = v_pay.owner_id;

  return jsonb_build_object('id', p_payment_id, 'already', false);
end;
$$;

-- The profile guard must let the service role through too, otherwise a gateway
-- capture would confirm the payment but silently fail to activate Pro.
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
     and not public.is_service_role()
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

notify pgrst, 'reload schema';
