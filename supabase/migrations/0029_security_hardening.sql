-- =====================================================================
--  Fatura.co — security hardening
--
--  1. Internal helpers are no longer callable over the API.
--     Postgres grants EXECUTE on every new function to PUBLIC, and nothing
--     here ever revoked it, so /rest/v1/rpc/<name> reached all of them:
--       • prune_activity_events — anyone, even signed out, could delete the
--         activity history older than 7 days.
--       • record_activity — any user could write "payment confirmed" or
--         "invoice paid" events about any business into the live feed.
--       • log_admin_action — any user could write entries into the admin
--         audit log, which is meant to be the record of what admins did.
--       • confirm_paid_payment — already refused non-admins inside, but it
--         is the service role's door only, so it is shut for everyone else.
--     Their real callers are triggers, SECURITY DEFINER functions and
--     pg_cron, which all run as the function owner and keep their access.
--
--  2. The self-promotion guard covers INSERT, not just UPDATE.
--     The profile form upserts, for the case where the signup trigger never
--     made a row. On that path an insert could carry is_admin = true, and the
--     UPDATE trigger never saw it.
--
--  3. The `logos` bucket accepts only small images, like `page-assets`.
--
--  Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Internal functions
-- ---------------------------------------------------------------------
revoke execute on function public.prune_activity_events(integer) from public, anon, authenticated;
revoke execute on function public.record_activity(text, uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.log_admin_action(text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.confirm_paid_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_paid_payment(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 2. A new profile row starts with no privileges, whoever inserts it
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;

  new.is_pro     := false;
  new.pro_until  := null;
  new.plan       := 'free';
  new.is_admin   := false;
  new.is_manager := false;
  new.features   := '{}';
  return new;
end;
$$;

drop trigger if exists protect_profile_insert_trigger on public.profiles;
create trigger protect_profile_insert_trigger
  before insert on public.profiles
  for each row execute function public.protect_profile_insert();

-- ---------------------------------------------------------------------
-- 3. Logos: images only, 2 MB
-- ---------------------------------------------------------------------
do $$
begin
  update storage.buckets
     set file_size_limit = 2097152,
         allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
   where id = 'logos';
exception
  when others then
    raise notice '[fatura] SKIPPED logos limits: %. Set them in Dashboard -> Storage -> logos -> Edit bucket.', sqlerrm;
end
$$;

notify pgrst, 'reload schema';
