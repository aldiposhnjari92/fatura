-- =====================================================================
--  Fatura.co — one language
--
--  Invoices used to carry the language of the printed document, chosen per
--  invoice: `language text not null default 'en' check (language in ('en','sq'))`.
--  Fatura.co now issues Albanian documents only, and the app no longer sends
--  the column at all.
--
--  The column is deliberately NOT dropped. It is `not null`, so an insert that
--  omits it takes the default — and that default was 'en', which would keep
--  stamping a language on every new invoice that nothing reads. Changing the
--  default to 'sq' makes the stored value agree with the paper, and keeps the
--  historical rows readable for anyone auditing what was issued before this
--  change. Dropping a column is irreversible; this is not.
-- =====================================================================

alter table public.invoices
  alter column language set default 'sq';

comment on column public.invoices.language is
  'Legacy: the printed document''s language, back when invoices could be issued in English. Every invoice is Albanian now and nothing reads this. Kept for historical rows.';
