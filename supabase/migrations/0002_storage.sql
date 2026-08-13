-- =====================================================================
--  Fatura.co — storage: the public `logos` bucket and its policies
--
--  Everything here is best-effort ON PURPOSE. `storage.objects` is owned by
--  supabase_storage_admin, and depending on how the project was created the
--  connecting role may not be allowed to create policies on it. If that
--  happens we emit a NOTICE and carry on, because this file must never roll
--  back — an earlier version bundled these statements with the table DDL and
--  a permission error there wiped out the entire schema.
--
--  Anything skipped is reported by `npm run db:push`, along with the manual
--  Dashboard steps to finish it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The bucket itself
-- ---------------------------------------------------------------------
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('logos', 'logos', true)
  on conflict (id) do update set public = true;

  raise notice '[fatura] bucket "logos" is present and public.';
exception
  when insufficient_privilege then
    raise notice '[fatura] SKIPPED bucket creation (insufficient privilege). Create it manually: Storage -> New bucket -> name "logos", Public = ON.';
  when others then
    raise notice '[fatura] SKIPPED bucket creation: %', sqlerrm;
end
$$;

-- ---------------------------------------------------------------------
-- 2. Policies
--
--    Objects are stored at logos/<user-id>/<file>, so the first path
--    segment identifies the owner. Read is public (the PDF fetches the
--    logo by URL); writes are restricted to the user's own folder.
-- ---------------------------------------------------------------------
do $$
declare
  v_owner text := 'logos';
begin
  -- Prefer the role that actually owns storage.objects, when we may assume it.
  begin
    execute 'set local role supabase_storage_admin';
  exception
    when others then
      null; -- not grantable here; try as the current role instead
  end;

  execute 'drop policy if exists "logos_public_read" on storage.objects';
  execute $p$
    create policy "logos_public_read" on storage.objects
      for select using (bucket_id = 'logos')
  $p$;

  execute 'drop policy if exists "logos_insert_own_folder" on storage.objects';
  execute $p$
    create policy "logos_insert_own_folder" on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute 'drop policy if exists "logos_update_own_folder" on storage.objects';
  execute $p$
    create policy "logos_update_own_folder" on storage.objects
      for update to authenticated
      using (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute 'drop policy if exists "logos_delete_own_folder" on storage.objects';
  execute $p$
    create policy "logos_delete_own_folder" on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'logos'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  raise notice '[fatura] storage policies for "%" installed.', v_owner;
exception
  when insufficient_privilege then
    raise notice '[fatura] SKIPPED storage policies (insufficient privilege on storage.objects).';
    raise notice '[fatura] Finish manually: Dashboard -> Storage -> logos -> Policies. Allow public SELECT, and INSERT/UPDATE/DELETE for authenticated where (storage.foldername(name))[1] = auth.uid()::text';
  when others then
    raise notice '[fatura] SKIPPED storage policies: %', sqlerrm;
end
$$;

reset role;

notify pgrst, 'reload schema';
