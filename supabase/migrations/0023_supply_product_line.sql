-- =====================================================================
--  Fatura.co — a furnizim is one product, priced in Lekë and in Euro
--
--  The business using Furnizimet records each delivery as a single product:
--  what it is, who supplied it, when, how many pieces, what one piece cost
--  and what it sells for — both in Lekë and in Euro, each typed in, with no
--  conversion between them.
--
--  Vlera and Diferenca are generated, never written by the app:
--    value_all      = cost_all × quantity
--    value_eur      = cost_eur × quantity
--    difference_all = (sale_price_all − cost_all) × quantity
--    difference_eur = (sale_price_eur − cost_eur) × quantity
--
--  Written to run from the 0021 shape or from any partial attempt at this
--  one: every step checks before it acts. The line-items columns from 0021
--  go; the table is days old and the form never asks for them.
-- =====================================================================

-- Generated columns first: they depend on the columns being reshaped.
alter table public.supplies
  drop column if exists value,
  drop column if exists difference,
  drop column if exists value_all,
  drop column if exists value_eur,
  drop column if exists difference_all,
  drop column if exists difference_eur;

alter table public.supplies
  drop constraint if exists supplies_currency_check,
  drop constraint if exists supplies_amounts_non_negative,
  drop constraint if exists supplies_items_is_array,
  drop constraint if exists supplies_total_non_negative;

alter table public.supplies
  drop column if exists document_number,
  drop column if exists items,
  drop column if exists total,
  drop column if exists status,
  drop column if exists notes,
  drop column if exists currency;

-- Earlier attempts named these `cost` and `sale_price`; keep what was typed.
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'supplies'
                and column_name = 'cost')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'supplies'
                and column_name = 'cost_all') then
    alter table public.supplies rename column cost to cost_all;
  end if;

  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'supplies'
                and column_name = 'sale_price')
     and not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'supplies'
                and column_name = 'sale_price_all') then
    alter table public.supplies rename column sale_price to sale_price_all;
  end if;
end $$;

alter table public.supplies
  add column if not exists product_name   text           not null default '',
  add column if not exists quantity       integer        not null default 0,
  add column if not exists cost_all       numeric(14, 2) not null default 0,
  add column if not exists cost_eur       numeric(14, 2) not null default 0,
  add column if not exists sale_price_all numeric(14, 2) not null default 0,
  add column if not exists sale_price_eur numeric(14, 2) not null default 0;

alter table public.supplies
  add column value_all numeric(16, 2)
    generated always as (cost_all * quantity) stored,
  add column value_eur numeric(16, 2)
    generated always as (cost_eur * quantity) stored,
  add column difference_all numeric(16, 2)
    generated always as ((sale_price_all - cost_all) * quantity) stored,
  add column difference_eur numeric(16, 2)
    generated always as ((sale_price_eur - cost_eur) * quantity) stored;

alter table public.supplies
  add constraint supplies_amounts_non_negative
    check (quantity >= 0
           and cost_all >= 0 and cost_eur >= 0
           and sale_price_all >= 0 and sale_price_eur >= 0);

comment on column public.supplies.cost_all is 'Kosto per copë, Lekë.';
comment on column public.supplies.cost_eur is 'Kosto per copë, Euro — typed in, not converted.';
comment on column public.supplies.sale_price_all is 'Çmimi i shitjes per copë, Lekë.';
comment on column public.supplies.sale_price_eur is 'Çmimi i shitjes per copë, Euro — typed in, not converted.';
comment on column public.supplies.value_all is 'Vlera, Lekë — cost_all × quantity, generated.';
comment on column public.supplies.value_eur is 'Vlera, Euro — cost_eur × quantity, generated.';
comment on column public.supplies.difference_all is 'Diferenca, Lekë — (sale_price_all − cost_all) × quantity, generated.';
comment on column public.supplies.difference_eur is 'Diferenca, Euro — (sale_price_eur − cost_eur) × quantity, generated.';
