-- =====================================================================
--  Fatura.co — per-business feature settings
--
--  0021 gave an account a list of features the admin switched ON, for
--  screens only some businesses need. The admin now manages every optional
--  part of the app per business, and some of those are on for everyone
--  unless switched off. So a feature has a default:
--
--    on unless switched off (profiles.disabled_features):
--      • earnings     — Të ardhurat
--      • excel        — Excel import and export of invoices
--      • custom_pages — the pages the admin built for the account
--    off unless switched on (profiles.features, as before):
--      • suppliers    — Furnitorët
--      • supplies     — Furnizimet; needs suppliers, it picks from that list
--
--  Until now one key, `suppliers`, opened both Furnitorët and Furnizimet.
--  They are separate switches now; every account that had `suppliers` gets
--  `supplies` too, so nobody loses a screen.
--
--  Keys are mirrored in src/lib/features.ts.
--
--  Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The switched-off list, pinned like `features`
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists disabled_features text[] not null default '{}';

comment on column public.profiles.disabled_features is
  'Default-on feature keys the admin switched off for this account. See src/lib/features.ts.';

create or replace function public.protect_profile_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;

  new.is_pro            := old.is_pro;
  new.pro_until         := old.pro_until;
  new.plan              := old.plan;
  new.is_admin          := old.is_admin;
  new.is_manager        := old.is_manager;
  new.features          := old.features;
  new.disabled_features := old.disabled_features;
  return new;
end;
$$;

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

  new.is_pro            := false;
  new.pro_until         := null;
  new.plan              := 'free';
  new.is_admin          := false;
  new.is_manager        := false;
  new.features          := '{}';
  new.disabled_features := '{}';
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. has_feature() knows the defaults
-- ---------------------------------------------------------------------
create or replace function public.has_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case
              when p_feature in ('earnings', 'excel', 'custom_pages')
                then not (p_feature = any(disabled_features))
              else p_feature = any(features)
            end
       from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Furnizimet becomes its own switch
-- ---------------------------------------------------------------------
update public.profiles
   set features = array(select distinct unnest(features || array['supplies']))
 where 'suppliers' = any(features)
   and not ('supplies' = any(features));

drop policy if exists "supplies_own_with_feature" on public.supplies;
create policy "supplies_own_with_feature" on public.supplies
  for all to authenticated
  using (owner_id = auth.uid() and public.has_feature('supplies'))
  with check (owner_id = auth.uid() and public.has_feature('supplies'));

-- ---------------------------------------------------------------------
-- 4. Console: switch any feature, keeping Furnizimet inside Furnitorët
-- ---------------------------------------------------------------------
create or replace function public.admin_set_feature(
  p_user uuid, p_feature text, p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_on text[] := array['earnings', 'excel', 'custom_pages'];
  v_opt_in     text[] := array['suppliers', 'supplies'];
  v_features   text[];
  v_disabled   text[];
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;
  if not (p_feature = any(v_default_on || v_opt_in)) then
    raise exception 'UNKNOWN_FEATURE' using errcode = 'check_violation';
  end if;

  if p_feature = any(v_default_on) then
    update public.profiles
       set disabled_features = case
             when p_enabled then array_remove(disabled_features, p_feature)
             else array(select distinct unnest(disabled_features || p_feature))
           end
     where id = p_user
    returning features, disabled_features into v_features, v_disabled;
  else
    update public.profiles
       set features = case
             -- Furnizimet picks its supplier from Furnitorët, so it brings it along…
             when p_enabled and p_feature = 'supplies'
               then array(select distinct unnest(features || array['supplies', 'suppliers']))
             when p_enabled
               then array(select distinct unnest(features || p_feature))
             -- …and switching Furnitorët off takes Furnizimet with it.
             when p_feature = 'suppliers'
               then array_remove(array_remove(features, 'suppliers'), 'supplies')
             else array_remove(features, p_feature)
           end
     where id = p_user
    returning features, disabled_features into v_features, v_disabled;
  end if;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'no_data_found';
  end if;

  perform public.log_admin_action(
    case when p_enabled then 'feature.enable' else 'feature.disable' end,
    p_user, jsonb_build_object('feature', p_feature));

  return jsonb_build_object('features', v_features, 'disabled_features', v_disabled);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Console: the businesses and their switches, for the settings pages
-- ---------------------------------------------------------------------
create or replace function public.admin_features(
  p_search text default null,
  p_user   uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then
    raise exception 'NOT_AUTHORISED' using errcode = 'insufficient_privilege';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.created_at desc)
      from (
        select p.id, p.business_name, p.city, u.email, p.created_at,
               public.active_plan(p.id) as plan,
               p.features, p.disabled_features
          from public.profiles p
          join auth.users u on u.id = p.id
         where (p_user is null or p.id = p_user)
           and (v_q is null
                or p.business_name ilike '%' || v_q || '%'
                or u.email          ilike '%' || v_q || '%'
                or coalesce(p.nipt, '') ilike '%' || v_q || '%')
         order by p.created_at desc
         limit 100
      ) t
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.admin_features(text, uuid) from public, anon;
grant execute on function public.admin_features(text, uuid) to authenticated;
