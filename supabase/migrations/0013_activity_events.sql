-- =====================================================================
--  Fatura.co — activity stream (realtime notifications + history)
--
--  Design is driven by the constraint that this must not slow the product
--  down. Four decisions follow from it:
--
--  1. NARROW ROWS, NO JSON BLOB. Typed columns only. An audit table with a
--     fat jsonb payload on every invoice insert is how these tables end up
--     larger than the data they describe.
--
--  2. THE TRIGGER NEVER QUERIES. It reads NEW/OLD and writes one row. No
--     lookup of the business name — that is resolved by a join at read time,
--     which happens a few times a day, instead of on every single write.
--
--  3. BIGINT IDENTITY, NOT UUID. This table is append-only and read in
--     time order; a monotonic key keeps inserts at the end of the index
--     instead of scattering them, and makes keyset pagination exact.
--
--  4. IT IS PRUNED. Retention is 90 days. An append-only table nobody
--     deletes from is a slow-motion outage.
-- =====================================================================

create table if not exists public.activity_events (
  id          bigint generated always as identity primary key,
  -- e.g. 'invoice.created', 'invoice.paid', 'payment.confirmed', 'user.signup'
  type        text        not null,
  -- Who the event is about (the business). Null for system events.
  subject_id  uuid        references public.profiles (id) on delete cascade,
  -- Who caused it, when that differs from the subject (an admin, say).
  actor_id    uuid        references public.profiles (id) on delete set null,
  -- Free-form short label: an invoice number, a payment reference.
  ref         text,
  -- Whole Lekë, like every other money column here. Null when not monetary.
  amount      integer,
  created_at  timestamptz not null default now()
);

comment on table public.activity_events is
  'Append-only platform activity. Pruned to 90 days by prune_activity_events().';

-- The only access pattern: newest first, optionally filtered by type.
-- (created_at, id) together make the sort total, so keyset pagination cannot
-- skip or repeat a row when two events share a timestamp.
create index if not exists activity_events_recent_idx
  on public.activity_events (created_at desc, id desc);
create index if not exists activity_events_type_idx
  on public.activity_events (type, created_at desc);

alter table public.activity_events enable row level security;

/*
  Read: operators only. Write: nobody — there is deliberately no INSERT policy,
  so the sole path in is the SECURITY DEFINER trigger below. The same reasoning
  as the payments table: if a client could forge rows, the history would be
  worth nothing.
*/
drop policy if exists activity_events_read on public.activity_events;
create policy activity_events_read on public.activity_events
  for select using (public.is_manager());

-- ---------------------------------------------------------------------
--  Recording
-- ---------------------------------------------------------------------
create or replace function public.record_activity(
  p_type text, p_subject uuid, p_ref text default null, p_amount integer default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.activity_events (type, subject_id, actor_id, ref, amount)
  values (p_type, p_subject, auth.uid(), p_ref, p_amount);
$$;

create or replace function public.tg_activity_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_activity(
      case when new.status = 'paid' then 'invoice.paid' else 'invoice.created' end,
      new.owner_id, new.invoice_number, new.total);
  elsif old.status <> 'paid' and new.status = 'paid' then
    perform public.record_activity('invoice.paid', new.owner_id,
      new.invoice_number, new.total);
  end if;
  return null; -- AFTER trigger; return value is ignored
end;
$$;

drop trigger if exists activity_invoice on public.invoices;
create trigger activity_invoice
  after insert or update of status on public.invoices
  for each row execute function public.tg_activity_invoice();

create or replace function public.tg_activity_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_activity('payment.requested', new.owner_id,
      new.reference, new.amount);
  elsif old.status <> new.status then
    perform public.record_activity('payment.' || new.status, new.owner_id,
      new.reference, new.amount);
  end if;
  return null;
end;
$$;

drop trigger if exists activity_payment on public.payments;
create trigger activity_payment
  after insert or update of status on public.payments
  for each row execute function public.tg_activity_payment();

create or replace function public.tg_activity_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.record_activity('user.signup', new.id, null, null);
    return null;
  end if;

  -- Only the transitions worth telling someone about.
  if coalesce(old.is_pro, false) = false and new.is_pro then
    perform public.record_activity('subscription.started', new.id, null, null);
  elsif coalesce(old.is_pro, false) and new.is_pro = false then
    perform public.record_activity('subscription.ended', new.id, null, null);
  end if;

  if old.cancelled_at is null and new.cancelled_at is not null then
    perform public.record_activity('subscription.cancelled', new.id, null, null);
  end if;

  if coalesce(old.business_name, '') = '' and coalesce(new.business_name, '') <> '' then
    perform public.record_activity('user.onboarded', new.id, null, null);
  end if;

  return null;
end;
$$;

drop trigger if exists activity_profile on public.profiles;
create trigger activity_profile
  after insert or update of is_pro, cancelled_at, business_name on public.profiles
  for each row execute function public.tg_activity_profile();

-- ---------------------------------------------------------------------
--  Reading — keyset pagination, never OFFSET
--
--  OFFSET makes the database walk and discard every skipped row, so page 50
--  costs fifty times page 1. Passing the last row's (created_at, id) as a
--  cursor makes every page an index seek: page 500 costs the same as page 1.
-- ---------------------------------------------------------------------
create or replace function public.activity_feed(
  p_limit integer default 50,
  p_before_at timestamptz default null,
  p_before_id bigint default null,
  p_type text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_rows jsonb; v_limit integer;
begin
  if not public.is_manager() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) into v_rows
    from (
      select e.id, e.type, e.ref, e.amount, e.created_at,
             p.business_name, p.city
        from public.activity_events e
        left join public.profiles p on p.id = e.subject_id
       where (p_type is null or e.type = p_type)
         and (
           p_before_at is null
           or (e.created_at, e.id) < (p_before_at, coalesce(p_before_id, 0))
         )
       order by e.created_at desc, e.id desc
       limit v_limit
    ) x;

  return jsonb_build_object('rows', v_rows);
end;
$$;

-- ---------------------------------------------------------------------
--  Retention
-- ---------------------------------------------------------------------
create or replace function public.prune_activity_events(
  p_keep_days integer default 90
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_deleted integer;
begin
  delete from public.activity_events
   where created_at < now() - (greatest(p_keep_days, 7) || ' days')::interval;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

/*
  Schedule it if pg_cron is available. Wrapped because the extension is not
  enabled on every Supabase plan, and a missing scheduler must not fail the
  migration — the function is still callable by hand, and the read path stays
  fast regardless because every query is an index seek with a LIMIT.
*/
do $$
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if found then
    perform cron.unschedule('prune-activity-events');
  end if;
exception when others then
  null;
end $$;

do $$
begin
  perform 1 from pg_extension where extname = 'pg_cron';
  if found then
    perform cron.schedule('prune-activity-events', '30 3 * * *',
      $cron$select public.prune_activity_events(90)$cron$);
  end if;
exception when others then
  raise notice 'pg_cron not available; call prune_activity_events() on a schedule yourself';
end $$;

-- ---------------------------------------------------------------------
--  Realtime
--  Clients subscribe to INSERTs. The read policy above still applies, so a
--  customer subscribing to this channel receives nothing.
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.activity_events;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'supabase_realtime publication missing; realtime not enabled';
end $$;

notify pgrst, 'reload schema';
