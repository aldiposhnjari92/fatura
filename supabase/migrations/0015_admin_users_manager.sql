-- =====================================================================
--  Fatura.co — expose is_manager to the users table
--
--  The console lists roles, and since staff are now appointed as managers
--  rather than admins the flag has to travel with each row. Only the select
--  list changes; the authorisation check is untouched.
-- =====================================================================

create or replace function public.admin_users(
  p_search text default null,
  p_filter text default 'all',      -- all | pro | free | admin | inactive
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
             when 'pro'      then p.is_pro and (p.pro_until is null or p.pro_until > now())
             when 'free'     then not (p.is_pro and (p.pro_until is null or p.pro_until > now()))
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

notify pgrst, 'reload schema';
