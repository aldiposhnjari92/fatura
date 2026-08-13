-- =====================================================================
--  Fix: create_payment() referenced gen_random_bytes(), which lives in
--  pgcrypto. On Supabase that extension is installed into the `extensions`
--  schema, and the function pins `search_path = public`, so the call failed
--  at runtime with:
--
--      function gen_random_bytes(integer) does not exist
--
--  gen_random_uuid() is in core Postgres (13+), needs no extension and no
--  search_path gymnastics, so the reference is derived from that instead.
-- =====================================================================

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

notify pgrst, 'reload schema';
