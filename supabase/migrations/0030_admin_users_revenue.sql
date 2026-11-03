-- =====================================================================
--  Fatura.co — revenue and earnings per business in the admin console
--
--  admin_users() gains two totals for each business, alongside the counts
--  it already returned:
--    • revenue_total — what the business has invoiced: the total of every
--      invoice it issued. Drafts are left out; they have not been sent.
--    • earned_total  — what it has actually been paid: the total of its
--      invoices marked paid.
--  Both are invoice totals as stored, VAT included, in Lekë.
--
--  The invoice figures now come from one pass over the business's invoices
--  instead of one subquery each. Everything the function returned before is
--  returned unchanged (0021's admin_users), so older pages keep working.
--
--  Safe to re-run. CREATE OR REPLACE keeps the existing grants.
-- =====================================================================

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
           p.features,
           p.pro_until, p.logo_url, p.created_at,
           public.active_plan(p.id) as plan,
           u.email,
           inv.invoice_count,
           (select count(*) from public.clients c where c.owner_id = p.id) as client_count,
           inv.invoiced_total,
           inv.revenue_total,
           inv.earned_total,
           inv.last_invoice_at,
           (select coalesce(sum(pay.amount), 0) from public.payments pay
             where pay.owner_id = p.id and pay.status = 'confirmed')       as paid_total
      from public.profiles p
      join auth.users u on u.id = p.id
      cross join lateral (
        select count(*)                                                    as invoice_count,
               coalesce(sum(i.total), 0)                                   as invoiced_total,
               coalesce(sum(i.total) filter (where i.status <> 'draft'), 0) as revenue_total,
               coalesce(sum(i.total) filter (where i.status = 'paid'), 0)   as earned_total,
               max(i.created_at)                                           as last_invoice_at
          from public.invoices i
         where i.owner_id = p.id
      ) inv
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
