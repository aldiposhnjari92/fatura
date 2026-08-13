-- =====================================================================
--  Fatura.co — admin console
--
--  The panel at /app/admin only ever read aggregates. A real console needs
--  per-business rows and write actions (grant Pro, grant admin, decide
--  payments), so this migration adds them — deliberately, and with limits:
--
--    • RLS is STILL not relaxed. Everything goes through SECURITY DEFINER
--      functions that re-check is_admin(), so there is one place to audit.
--    • Invoice *contents* and client lists stay out of reach. An admin sees
--      that a business issued 14 invoices worth X, never who they billed or
--      for what. That is their customers' commercial data, not ours.
--    • Every write action is recorded in admin_audit.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit trail
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text        not null,
  target_id   uuid,
  detail      jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;

drop policy if exists "admin_audit_select_admin" on public.admin_audit;
create policy "admin_audit_select_admin" on public.admin_audit
  for select to authenticated using (public.is_admin());
-- No insert policy: only the SECURITY DEFINER helpers below write to it.

create or replace function public.log_admin_action(
  p_action text, p_target uuid, p_detail jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_audit (actor_id, action, target_id, detail)
  values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- 2. Businesses — searchable, paginated
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 3. One business in depth (still no invoice contents)
-- ---------------------------------------------------------------------
create or replace function public.admin_user_detail(p_user uuid)
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
    'profile', (
      select to_jsonb(x) from (
        select p.id, p.business_name, p.city, p.nipt, p.address, p.phone,
               p.logo_url, p.is_pro, p.is_admin, p.pro_until, p.created_at,
               u.email, u.last_sign_in_at, u.email_confirmed_at
          from public.profiles p join auth.users u on u.id = p.id
         where p.id = p_user
      ) x
    ),
    'stats', (
      select to_jsonb(y) from (
        select (select count(*) from public.invoices where owner_id = p_user) as invoices,
               (select count(*) from public.clients  where owner_id = p_user) as clients,
               (select coalesce(sum(total),0) from public.invoices where owner_id = p_user) as invoiced_total,
               (select count(*) from public.invoices
                 where owner_id = p_user and created_at >= date_trunc('month', now())) as invoices_this_month,
               (select max(created_at) from public.invoices where owner_id = p_user) as last_invoice_at
      ) y
    ),
    -- Status counts only. Never the rows themselves.
    'invoice_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
        from (select status, count(*) n from public.invoices
               where owner_id = p_user group by status) s
    ),
    'payments', (
      select coalesce(jsonb_agg(row_to_json(z) order by z.created_at desc), '[]'::jsonb)
        from (select id, reference, method, amount, months, status, created_at, decided_at
                from public.payments where owner_id = p_user
               order by created_at desc limit 20) z
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Write actions
-- ---------------------------------------------------------------------
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
    update public.profiles set is_pro = false, pro_until = null where id = p_user;
    perform public.log_admin_action('pro.revoke', p_user, '{}'::jsonb);
    return jsonb_build_object('is_pro', false);
  end if;

  select greatest(now(), coalesce(pro_until, now())) into v_from
    from public.profiles where id = p_user;

  v_until := v_from + (least(greatest(coalesce(p_months, 1), 1), 36) || ' months')::interval;

  update public.profiles set is_pro = true, pro_until = v_until where id = p_user;
  perform public.log_admin_action('pro.grant', p_user,
    jsonb_build_object('months', p_months, 'until', v_until));

  return jsonb_build_object('is_pro', true, 'pro_until', v_until);
end;
$$;

create or replace function public.admin_set_admin(p_user uuid, p_is_admin boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_remaining integer;
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  -- Locking yourself out is the one irreversible mistake here.
  if p_user = auth.uid() and not p_is_admin then
    raise exception 'CANNOT_DEMOTE_SELF' using errcode = 'check_violation';
  end if;

  if not p_is_admin then
    select count(*) into v_remaining
      from public.profiles where is_admin and id <> p_user;
    if v_remaining = 0 then
      raise exception 'LAST_ADMIN' using errcode = 'check_violation';
    end if;
  end if;

  update public.profiles set is_admin = p_is_admin where id = p_user;
  perform public.log_admin_action(
    case when p_is_admin then 'admin.grant' else 'admin.revoke' end, p_user, '{}'::jsonb);

  return jsonb_build_object('is_admin', p_is_admin);
end;
$$;

-- Log the payment decisions too, now that an audit table exists.
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
       set is_pro = true, pro_until = v_from + (v_pay.months || ' months')::interval
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

-- ---------------------------------------------------------------------
-- 5. Payments, waitlist, audit feed
-- ---------------------------------------------------------------------
create or replace function public.admin_payments(
  p_status text default 'all', p_limit integer default 50, p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rows jsonb; v_total integer;
        v_lim integer := least(greatest(coalesce(p_limit,50),1),200);
        v_off integer := greatest(coalesce(p_offset,0),0);
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  with base as (
    select pay.id, pay.reference, pay.method, pay.amount, pay.months, pay.status,
           pay.created_at, pay.decided_at, pay.provider_ref, pay.notes,
           p.business_name, p.city, p.id as owner_id
      from public.payments pay
      join public.profiles p on p.id = pay.owner_id
     where coalesce(p_status,'all') = 'all' or pay.status = p_status
  )
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at desc), '[]'::jsonb),
         (select count(*) from base)
    into v_rows, v_total
  from (select * from base order by created_at desc limit v_lim offset v_off) t;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

create or replace function public.admin_waitlist(p_limit integer default 100)
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

  select coalesce(jsonb_agg(row_to_json(w) order by w.created_at desc), '[]'::jsonb)
    into v_result
  from (select id, business_name, whatsapp, city, created_at
          from public.waitlist_fatura
         order by created_at desc
         limit least(greatest(coalesce(p_limit,100),1),500)) w;

  return v_result;
end;
$$;

create or replace function public.admin_audit_feed(p_limit integer default 50)
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

  select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb)
    into v_result
  from (select ad.id, ad.action, ad.detail, ad.created_at,
               actor.business_name as actor_name,
               target.business_name as target_name
          from public.admin_audit ad
          left join public.profiles actor  on actor.id  = ad.actor_id
          left join public.profiles target on target.id = ad.target_id
         order by ad.created_at desc
         limit least(greatest(coalesce(p_limit,50),1),200)) a;

  return v_result;
end;
$$;

notify pgrst, 'reload schema';
