-- =====================================================================
--  Fatura.co — page builder, phase 2
--
--  Pages can now sit under their own heading in the customer's sidebar
--  ("Porositë", "Magazina") instead of all under "Faqet". Everything else in
--  phase 2 — columns, styles, calculated fields — lives inside the existing
--  `blocks` and `fields` JSON, so the only schema change is the group.
-- =====================================================================

alter table public.custom_pages
  add column if not exists nav_group text;

comment on column public.custom_pages.nav_group is
  'Sidebar heading this page sits under; null means the default "Faqet".';

create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'invoices_this_month', (
      select count(*) from public.invoices
       where owner_id = auth.uid()
         and created_at >= date_trunc('month', now())
    ),
    'free_invoice_limit', public.free_invoice_limit(),
    'plan', public.active_plan(auth.uid()),
    -- NULL means unlimited. Read this rather than re-deriving the cap client-side.
    'invoice_limit', public.plan_invoice_limit(public.active_plan(auth.uid())),
    'pro_active', public.has_active_pro(auth.uid()),
    'pending_payment', (
      select to_jsonb(x) from (
        select id, reference, method, amount, months, plan, created_at
          from public.payments
         where owner_id = auth.uid() and status = 'pending'
         order by created_at desc limit 1
      ) x
    ),
    -- Sidebar entries only: no blocks, so this stays small on every request.
    'custom_pages', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.position, x.title), '[]'::jsonb)
        from (
          select id, slug, title, icon, position, nav_group
            from public.custom_pages
           where owner_id = auth.uid() and published
        ) x
    )
  );
$$;

notify pgrst, 'reload schema';
