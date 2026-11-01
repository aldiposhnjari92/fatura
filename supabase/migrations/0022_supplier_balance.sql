-- =====================================================================
--  Fatura.co — a supplier is an account balance, not a contact card
--
--  The business using Furnitorët tracks each supplier as: who it is, what
--  for, how much the goods are worth, how much has been paid, and what is
--  left. The contact columns from 0021 go — the table is days old and the
--  form never asks for them.
--
--  Teprica (balance) is generated, not stored by the app: it is always
--  vlera − pagesa, so the three numbers can never disagree.
-- =====================================================================

alter table public.suppliers
  drop column if exists nipt,
  drop column if exists phone,
  drop column if exists email,
  drop column if exists address;

alter table public.suppliers
  add column if not exists description text,
  -- Whole Lek (ALL), like every money column.
  add column if not exists value   integer not null default 0,
  add column if not exists payment integer not null default 0;

alter table public.suppliers
  add column if not exists balance integer generated always as (value - payment) stored;

do $$
begin
  alter table public.suppliers
    add constraint suppliers_value_non_negative check (value >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.suppliers
    add constraint suppliers_payment_non_negative check (payment >= 0);
exception
  when duplicate_object then null;
end $$;

comment on column public.suppliers.value is 'Vlera — whole Lek (ALL).';
comment on column public.suppliers.payment is 'Pagesa — what has been paid so far, whole Lek (ALL).';
comment on column public.suppliers.balance is 'Teprica — vlera − pagesa, generated.';
