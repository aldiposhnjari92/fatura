-- =====================================================================
--  Fatura.co — a paid invoice can be deleted
--
--  0019 made a paid invoice final: no edits and no delete. Edits stay
--  refused — the lines and amounts of a paid invoice are what was paid —
--  but the owner can now remove the whole invoice. RLS
--  (invoices_delete_own) still limits that to their own rows.
-- =====================================================================

create or replace function public.guard_paid_invoice()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if old.status <> 'paid' then
    return new;
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

-- Deletes no longer need the guard at all.
drop trigger if exists guard_paid_invoice on public.invoices;
create trigger guard_paid_invoice
  before update on public.invoices
  for each row execute function public.guard_paid_invoice();

comment on function public.guard_paid_invoice() is
  'A paid invoice cannot be edited. Lets through the client being deleted (client_id set null). Deleting is allowed (0020).';
