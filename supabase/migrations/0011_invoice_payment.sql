-- =====================================================================
--  Fatura.co — "has this invoice been paid?"
--
--  Two problems this fixes.
--
--  1. `paid` recorded no date. A business reconciling against a bank
--     statement needs to know *when* it was settled, and "was it paid late?"
--     was unanswerable. `paid_at` is now kept in step with the status by a
--     trigger, so it cannot drift no matter which code path does the write —
--     the same reasoning as the invoice-quota trigger.
--
--  2. `overdue` was a status somebody had to pick by hand from a dropdown.
--     Nothing ever set it, so an invoice three months past its due date still
--     read "unpaid" forever and dashboard_stats()'s overdue_count was
--     permanently zero — the dashboard was quietly reporting a comforting
--     falsehood. Being late is not a decision a user makes; it is a fact about
--     the due date. It is now derived at read time and never stored.
-- =====================================================================

alter table public.invoices
  add column if not exists paid_at timestamptz;

comment on column public.invoices.paid_at is
  'When the invoice was marked paid. Maintained by sync_invoice_paid_at().';

-- ---------------------------------------------------------------------
-- 1. Backfill, then retire the stored 'overdue' state
-- ---------------------------------------------------------------------
-- Existing paid invoices get their creation date as a best-effort stamp. It is
-- the only date we hold; better an approximate one than a null that reads as
-- "never paid".
update public.invoices
   set paid_at = coalesce(paid_at, created_at)
 where status = 'paid' and paid_at is null;

-- Anything stored as 'overdue' becomes plain 'unpaid'; lateness is derived
-- from due_date now, so a stored value could only ever contradict it.
update public.invoices set status = 'unpaid' where status = 'overdue';

-- ---------------------------------------------------------------------
-- 2. Keep paid_at honest
-- ---------------------------------------------------------------------
create or replace function public.sync_invoice_paid_at()
returns trigger
language plpgsql
as $$
begin
  -- 'overdue' is no longer a state anyone may store.
  if new.status = 'overdue' then
    new.status := 'unpaid';
  end if;

  if new.status = 'paid' then
    -- Preserve a date the client supplied (back-dating a payment is normal);
    -- otherwise stamp now.
    if new.paid_at is null then
      new.paid_at := now();
    end if;
  else
    new.paid_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_invoice_paid_at on public.invoices;
create trigger sync_invoice_paid_at
  before insert or update on public.invoices
  for each row execute function public.sync_invoice_paid_at();

-- ---------------------------------------------------------------------
-- 3. Lateness, derived
--    An invoice is late when it is issued, still unpaid, and its due date has
--    passed. Drafts are never late (they have not been sent) and a paid
--    invoice is never late no matter when it was settled.
-- ---------------------------------------------------------------------
create or replace function public.is_overdue(
  p_status text, p_due_date date
)
returns boolean
language sql
immutable
as $$
  select p_status = 'unpaid' and p_due_date is not null and p_due_date < current_date;
$$;

create index if not exists invoices_owner_due_idx
  on public.invoices (owner_id, due_date)
  where status = 'unpaid';

-- ---------------------------------------------------------------------
-- 4. Dashboard: report the derived figure
-- ---------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total_invoices',  coalesce((select count(*) from public.invoices where owner_id = auth.uid()), 0),
    'paid_total',      coalesce((select sum(total) from public.invoices
                                  where owner_id = auth.uid() and status = 'paid'), 0),
    'outstanding_total', coalesce((select sum(total) from public.invoices
                                  where owner_id = auth.uid() and status = 'unpaid'), 0),
    'overdue_count',   coalesce((select count(*) from public.invoices
                                  where owner_id = auth.uid()
                                    and public.is_overdue(status, due_date)), 0),
    'overdue_total',   coalesce((select sum(total) from public.invoices
                                  where owner_id = auth.uid()
                                    and public.is_overdue(status, due_date)), 0),
    'draft_count',     coalesce((select count(*) from public.invoices
                                  where owner_id = auth.uid() and status = 'draft'), 0),
    'client_count',    coalesce((select count(*) from public.clients where owner_id = auth.uid()), 0),
    'month_total',     coalesce((select sum(total) from public.invoices
                                  where owner_id = auth.uid()
                                    and created_at >= date_trunc('month', now())), 0),
    'paid_this_month', coalesce((select sum(total) from public.invoices
                                  where owner_id = auth.uid() and status = 'paid'
                                    and paid_at >= date_trunc('month', now())), 0)
  );
$$;

-- ---------------------------------------------------------------------
-- 5. Marking an invoice paid, in one call
--    RLS already lets an owner update their own rows, so this exists for
--    convenience and consistency rather than privilege: it is SECURITY INVOKER,
--    so the caller's own policies still decide whether the write lands.
-- ---------------------------------------------------------------------
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
declare v_row public.invoices%rowtype;
begin
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
    -- Either it does not exist or RLS hid it. Same answer either way: the
    -- caller has no invoice by that id.
    raise exception 'INVOICE_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'paid_at', v_row.paid_at
  );
end;
$$;

notify pgrst, 'reload schema';
