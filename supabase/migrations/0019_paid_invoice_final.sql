-- =====================================================================
--  Fatura.co — a paid invoice is final
--
--  0012 stopped a paid invoice from going back to unpaid. Everything else on
--  it — the lines, the amounts, the client, the dates — could still be
--  rewritten, and the row deleted, by anyone holding the anon key and a
--  session. The app no longer offers either (a paid invoice opens read-only,
--  with no delete), and this makes the database agree, for the same reason
--  0012 gave: a rule that lives only in the UI is not a rule.
--
--  Two writes the user never asks for directly still have to go through:
--
--    • Deleting a client sets `client_id` to null on its invoices
--      (on delete set null). Refusing that would make every client with a
--      paid invoice undeletable, so that one change — client_id to null and
--      nothing else — is let through.
--
--    • Deleting an account cascades from profiles to invoices. By the time
--      the cascade reaches an invoice its profile row is already gone, which
--      is how the delete guard tells it apart from deleting one invoice.
--
--  Marking an invoice paid is unaffected: the guard looks at the row as it
--  was, and before that update it was not paid yet.
-- =====================================================================

create or replace function public.guard_paid_invoice()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'paid' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    -- The owner's profile is gone: this is an account deletion cascading.
    if not exists (select 1 from public.profiles where id = old.owner_id) then
      return old;
    end if;
    raise exception 'INVOICE_PAID_FINAL'
      using errcode = 'check_violation',
            hint = 'Nje fature e paguar nuk mund te fshihet.';
  end if;

  -- The client was deleted (on delete set null) and nothing else changed.
  if new.client_id is null
     and (to_jsonb(new) - 'client_id') = (to_jsonb(old) - 'client_id') then
    return new;
  end if;

  -- An update that changes nothing is harmless; anything else is refused.
  if to_jsonb(new) is distinct from to_jsonb(old) then
    raise exception 'INVOICE_PAID_FINAL'
      using errcode = 'check_violation',
            hint = 'Nje fature e paguar nuk mund te ndryshohet.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_paid_invoice on public.invoices;
create trigger guard_paid_invoice
  before update or delete on public.invoices
  for each row execute function public.guard_paid_invoice();

comment on function public.guard_paid_invoice() is
  'A paid invoice cannot be edited or deleted. Lets through the client being deleted (client_id set null) and account deletion (cascade from profiles).';
