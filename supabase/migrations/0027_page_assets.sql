-- =====================================================================
--  Fatura.co — page builder: the public `page-assets` bucket
--
--  Images placed on builder pages (the Imazh block) are uploaded here by the
--  admin and read by URL from the customer's page.
--  The app's CSP only lets images load from Supabase, so this bucket is the
--  one place a page's pictures can come from — never an arbitrary URL.
--
--  Read is public, like `logos`. Writes are admin-only: the admin builds the
--  pages. Same best-effort shape as 0002 — storage policies can be refused
--  depending on the connecting role, and that must not roll anything back.
-- =====================================================================

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('page-assets', 'page-assets', true, 3145728,
          array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  raise notice '[fatura] bucket "page-assets" is present and public.';
exception
  when insufficient_privilege then
    raise notice '[fatura] SKIPPED bucket creation (insufficient privilege). Create it manually: Storage -> New bucket -> name "page-assets", Public = ON.';
  when others then
    raise notice '[fatura] SKIPPED bucket creation: %', sqlerrm;
end
$$;

do $$
begin
  begin
    execute 'set local role supabase_storage_admin';
  exception
    when others then
      null;
  end;

  execute 'drop policy if exists "page_assets_public_read" on storage.objects';
  execute $p$
    create policy "page_assets_public_read" on storage.objects
      for select using (bucket_id = 'page-assets')
  $p$;

  execute 'drop policy if exists "page_assets_admin_insert" on storage.objects';
  execute $p$
    create policy "page_assets_admin_insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'page-assets' and public.is_admin())
  $p$;

  execute 'drop policy if exists "page_assets_admin_update" on storage.objects';
  execute $p$
    create policy "page_assets_admin_update" on storage.objects
      for update to authenticated
      using (bucket_id = 'page-assets' and public.is_admin())
      with check (bucket_id = 'page-assets' and public.is_admin())
  $p$;

  execute 'drop policy if exists "page_assets_admin_delete" on storage.objects';
  execute $p$
    create policy "page_assets_admin_delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'page-assets' and public.is_admin())
  $p$;

  raise notice '[fatura] storage policies for "page-assets" installed.';
exception
  when insufficient_privilege then
    raise notice '[fatura] SKIPPED storage policies (insufficient privilege on storage.objects).';
    raise notice '[fatura] Finish manually: Dashboard -> Storage -> page-assets -> Policies. Allow public SELECT, and INSERT/UPDATE/DELETE for authenticated where public.is_admin().';
  when others then
    raise notice '[fatura] SKIPPED storage policies: %', sqlerrm;
end
$$;
