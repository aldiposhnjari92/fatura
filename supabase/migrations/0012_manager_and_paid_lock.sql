-- =====================================================================
--  Fatura.co — a manager role, and locking a paid invoice
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The role
--
--    A manager sits between a customer and an admin: they can see what
--    invoicing activity exists across the platform, but none of the
--    destructive or financial controls (no deleting users, no granting Pro,
--    no approving payments, no promoting anyone).
--
--    Kept as a separate boolean rather than folded into is_admin so that
--    every existing is_admin() check keeps its exact meaning. Nothing an
--    admin could do yesterday changes today.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_manager boolean not null default false;

comment on column public.profiles.is_manager is
  'Read-mostly operator. Sees invoice activity; cannot alter users, plans or payments.';

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- An admin is always at least a manager, so callers never have to test both.
  select coalesce(
    (select is_manager or is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Close the self-promotion hole THIS column just opened
--
--    protect_profile_plan() already pins is_pro / pro_until / is_admin so a
--    customer cannot edit their own row into a better plan. is_manager is
--    exactly the same class of field and must be pinned the same way —
--    without this, any user could grant themselves platform-wide read access
--    with a single PATCH, because the anon key ships to every browser.
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role and admins are exempt: those are the paths that legitimately
  -- grant Pro and change roles.
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;

  new.is_pro      := old.is_pro;
  new.pro_until   := old.pro_until;
  new.is_admin    := old.is_admin;
  new.is_manager  := old.is_manager;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. What a manager may read
--
--    Deliberately metadata only: which business issued what, when, for how
--    much, and whether it was paid. NOT the line items, notes, or the client's
--    contact details — those are the customer's commercial secrets and the
--    reason RLS is never relaxed for staff. A manager needs to answer "is the
--    platform being used, and is money moving?", which this covers.
-- ---------------------------------------------------------------------
create or replace function public.manager_invoices(
  p_limit integer default 100,
  p_offset integer default 0,
  p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rows jsonb; v_total bigint;
begin
  if not public.is_manager() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_total
    from public.invoices i
   where p_status is null
      or (p_status = 'overdue' and public.is_overdue(i.status, i.due_date))
      or (p_status <> 'overdue' and i.status = p_status);

  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) into v_rows
    from (
      select i.id,
             i.invoice_number,
             i.issue_date,
             i.due_date,
             i.total,
             i.status,
             i.paid_at,
             public.is_overdue(i.status, i.due_date) as overdue,
             p.business_name,
             p.city
        from public.invoices i
        join public.profiles p on p.id = i.owner_id
       where p_status is null
          or (p_status = 'overdue' and public.is_overdue(i.status, i.due_date))
          or (p_status <> 'overdue' and i.status = p_status)
       order by i.created_at desc
       limit least(greatest(coalesce(p_limit, 100), 1), 200)
      offset greatest(coalesce(p_offset, 0), 0)
    ) x;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

/* Headline numbers a manager is allowed to see: activity, not revenue. */
create or replace function public.manager_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_manager() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'total_invoices', (select count(*) from public.invoices),
    'invoices_30d',   (select count(*) from public.invoices
                        where created_at >= now() - interval '30 days'),
    'paid_count',     (select count(*) from public.invoices where status = 'paid'),
    'unpaid_count',   (select count(*) from public.invoices where status = 'unpaid'),
    'overdue_count',  (select count(*) from public.invoices
                        where public.is_overdue(status, due_date)),
    'businesses',     (select count(*) from public.profiles where business_name is not null)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Only an admin may appoint a manager
-- ---------------------------------------------------------------------
create or replace function public.admin_set_manager(
  p_user uuid, p_manager boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  -- Same guard as admin_set_admin(): you cannot change your own standing, so a
  -- compromised session cannot quietly rewrite its own permissions.
  if p_user = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'check_violation';
  end if;

  update public.profiles set is_manager = p_manager where id = p_user;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  perform public.log_admin_action(
    case when p_manager then 'manager.grant' else 'manager.revoke' end,
    p_user, '{}'::jsonb);

  return jsonb_build_object('is_manager', p_manager);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. A paid invoice is final
--
--    Once money is recorded as received, the status stops being editable.
--    Enforced in the database rather than by hiding a button, for the same
--    reason the free-invoice cap is: the anon key is in every browser, so a
--    UI-only rule is not a rule.
--
--    NOTE: this is absolute — an invoice marked paid by mistake cannot be
--    corrected from the app by anyone, including an admin. That is what was
--    asked for; see the accompanying note about the trade-off.
-- ---------------------------------------------------------------------
create or replace function public.sync_invoice_paid_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'overdue' then
    new.status := 'unpaid';
  end if;

  if tg_op = 'UPDATE' and old.status = 'paid' and new.status <> 'paid' then
    raise exception 'INVOICE_ALREADY_PAID'
      using errcode = 'check_violation',
            hint = 'Nje fature e paguar nuk mund te kthehet ne nje gjendje tjeter.';
  end if;

  if new.status = 'paid' then
    if new.paid_at is null then
      new.paid_at := now();
    end if;
  else
    new.paid_at := null;
  end if;

  return new;
end;
$$;

/* set_invoice_paid() gains a matching pre-check so the caller gets a clear
   error instead of a raw trigger failure. */
create or replace function public.set_invoice_paid(
  p_invoice uuid,
  p_paid boolean,
  p_paid_on date default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare v_row public.invoices%rowtype; v_current text;
begin
  select status into v_current from public.invoices where id = p_invoice;
  if v_current is null then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  if v_current = 'paid' and not p_paid then
    raise exception 'INVOICE_ALREADY_PAID'
      using errcode = 'check_violation',
            hint = 'Nje fature e paguar nuk mund te kthehet ne nje gjendje tjeter.';
  end if;

  update public.invoices
     set status  = case when p_paid then 'paid' else 'unpaid' end,
         paid_at = case
                     when not p_paid then null
                     when p_paid_on is not null then p_paid_on::timestamptz
                     else now()
                   end
   where id = p_invoice
   returning * into v_row;

  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'paid_at', v_row.paid_at);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Surface the role to the app shell
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

notify pgrst, 'reload schema';
