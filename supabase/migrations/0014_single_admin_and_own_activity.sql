-- =====================================================================
--  Fatura.co — exactly one admin, and a customer-facing activity feed
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. There is only ever one admin
--
--    Enforced here rather than by hiding a menu item: the anon key is in
--    every browser, so anything the UI merely declines to offer can still
--    be attempted directly. Staff who need access get `manager` instead.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_admin(
  p_user uuid, p_is_admin boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_other_admins integer;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  if p_user = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'check_violation';
  end if;

  if p_is_admin then
    select count(*) into v_other_admins
      from public.profiles where is_admin and id <> p_user;

    if v_other_admins > 0 then
      raise exception 'ADMIN_ALREADY_EXISTS'
        using errcode = 'check_violation',
              hint = 'Ka vetem nje admin. Perdor rolin Menaxher per staf tjeter.';
    end if;
  else
    -- Removing the last admin would lock everyone out of the console.
    select count(*) into v_other_admins
      from public.profiles where is_admin and id <> p_user;
    if v_other_admins = 0 then
      raise exception 'CANNOT_REMOVE_LAST_ADMIN' using errcode = 'check_violation';
    end if;
  end if;

  update public.profiles set is_admin = p_is_admin where id = p_user;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  perform public.log_admin_action(
    case when p_is_admin then 'admin.grant' else 'admin.revoke' end, p_user, '{}'::jsonb);

  return jsonb_build_object('is_admin', p_is_admin);
end;
$$;

-- ---------------------------------------------------------------------
-- 2. A customer may read the events that are about them
--
--    Additive: the manager policy still stands. This one is scoped to the
--    caller's own row, so a business sees its own invoices being paid and
--    nothing about anyone else.
-- ---------------------------------------------------------------------
drop policy if exists activity_events_own on public.activity_events;
create policy activity_events_own on public.activity_events
  for select using (subject_id = auth.uid());

create or replace function public.my_activity(
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare v_rows jsonb;
begin
  -- SECURITY INVOKER: the policy above is what scopes this, not the function.
  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) into v_rows
    from (
      select e.id, e.type, e.ref, e.amount, e.created_at,
             null::text as business_name, null::text as city
        from public.activity_events e
       where e.subject_id = auth.uid()
       order by e.created_at desc, e.id desc
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) x;

  return jsonb_build_object('rows', v_rows);
end;
$$;

notify pgrst, 'reload schema';
