-- =====================================================================
--  Fatura.co — admin user deletion
--
--  Deleting a business is irreversible and cascades to their invoices,
--  clients and payment records. Three things make that safe:
--
--    1. A preview function, so the dialog can state exactly what will go.
--    2. A HARD guard in the database: if the account has active Pro or any
--       confirmed payment, the delete is refused unless the caller passes
--       p_acknowledge_paid => true. A UI-only warning would be bypassable
--       by anyone calling the RPC directly.
--    3. The usual self/last-admin guards, plus an audit row written BEFORE
--       the delete (the target row is about to disappear).
-- =====================================================================

create or replace function public.admin_user_delete_preview(p_user uuid)
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
    'id',            p.id,
    'business_name', p.business_name,
    'email',         u.email,
    'is_admin',      p.is_admin,
    'is_self',       p.id = auth.uid(),
    'pro_active',    public.has_active_pro(p.id),
    'pro_until',     p.pro_until,
    'invoices',      (select count(*) from public.invoices  i where i.owner_id = p.id),
    'clients',       (select count(*) from public.clients   c where c.owner_id = p.id),
    'payments',      (select count(*) from public.payments  pay
                       where pay.owner_id = p.id and pay.status = 'confirmed'),
    'paid_total',    (select coalesce(sum(pay.amount), 0) from public.payments pay
                       where pay.owner_id = p.id and pay.status = 'confirmed'),
    'last_payment_at', (select max(pay.decided_at) from public.payments pay
                         where pay.owner_id = p.id and pay.status = 'confirmed'),
    'other_admins',  (select count(*) from public.profiles x where x.is_admin and x.id <> p.id)
  ) into v_result
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user;

  if v_result is null then
    raise exception 'USER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return v_result;
end;
$$;

create or replace function public.admin_delete_user(
  p_user uuid,
  p_acknowledge_paid boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pro        boolean;
  v_paid_count integer;
  v_paid_total integer;
  v_name       text;
  v_email      text;
  v_is_admin   boolean;
  v_others     integer;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  if p_user = auth.uid() then
    raise exception 'CANNOT_DELETE_SELF' using errcode = 'check_violation';
  end if;

  select p.business_name, u.email, p.is_admin
    into v_name, v_email, v_is_admin
    from public.profiles p join auth.users u on u.id = p.id
   where p.id = p_user;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_is_admin then
    select count(*) into v_others from public.profiles where is_admin and id <> p_user;
    if v_others = 0 then
      raise exception 'LAST_ADMIN' using errcode = 'check_violation';
    end if;
  end if;

  v_pro := public.has_active_pro(p_user);
  select count(*), coalesce(sum(amount), 0)
    into v_paid_count, v_paid_total
    from public.payments where owner_id = p_user and status = 'confirmed';

  -- The paying-customer guard. Enforced here rather than in the dialog so a
  -- direct RPC call cannot skip it.
  if (v_pro or v_paid_count > 0) and not coalesce(p_acknowledge_paid, false) then
    raise exception 'USER_HAS_PAID_SUBSCRIPTION'
      using errcode = 'check_violation',
            detail = jsonb_build_object(
              'pro_active', v_pro,
              'payments', v_paid_count,
              'paid_total', v_paid_total
            )::text,
            hint = 'Ky biznes ka paguar. Konfirmo shprehimisht per te vazhduar.';
  end if;

  -- Written first: once the user is gone the audit FK would null the target.
  perform public.log_admin_action('user.delete', p_user, jsonb_build_object(
    'business_name', v_name,
    'email', v_email,
    'pro_active', v_pro,
    'confirmed_payments', v_paid_count,
    'paid_total', v_paid_total
  ));

  -- Cascades to profiles -> invoices / clients / payments, and to the auth
  -- session tables, all via existing ON DELETE CASCADE foreign keys.
  delete from auth.users where id = p_user;

  return jsonb_build_object(
    'deleted', true,
    'business_name', v_name,
    'paid_total', v_paid_total
  );
end;
$$;

notify pgrst, 'reload schema';
