-- CR-001 phase 7 (E24, D30) — the product catalog, as data (it links to quotes, fittings, demos and
-- stock). The machinery ships now; REDUX's own catalog arrives by CSV import from the admin screen.
-- Seed: one generic entry per fitting type REDUX restores ("Basin mixer"), never an invented branded
-- product — the website shows what REDUX works on until the real catalog replaces it.

create table public.product_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name       text not null,
  parent_id  uuid references public.product_categories(id),
  sort_order int not null default 0,
  is_active  boolean not null default true
);
create index product_categories_parent_idx on public.product_categories (parent_id);

create table public.products (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,39}$'),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null,
  category_id     uuid references public.product_categories(id),
  fitting_type_id uuid references public.fitting_types(id),          -- maps onto the rate card
  brand_id        uuid references public.brands(id),
  description     text,
  specs           jsonb not null default '{}'::jsonb,
  applications    text,
  benefits        text[] not null default '{}',
  restore_info    text,
  finish_ids      uuid[] not null default '{}',
  is_published    boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_fitting_type_idx on public.products (fitting_type_id);
create index products_published_idx on public.products (is_published, sort_order);
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();
create trigger trg_audit_products after insert or update or delete on public.products
  for each row execute function public.write_audit();

create table public.product_media (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  kind       text not null default 'image' check (kind in ('image', 'before', 'after', 'document')),
  path       text not null,            -- brand bucket path (catalog/…) or a site asset (demo/…)
  alt        text not null,
  sort_order int not null default 0
);
create index product_media_product_idx on public.product_media (product_id, sort_order);

-- links (all optional): what a quote line, a captured fitting and a stock item are in the catalog
alter table public.quotation_lines add column product_id uuid references public.products(id);
alter table public.fittings        add column product_id uuid references public.products(id);
alter table public.stock_items     add column product_id uuid references public.products(id);
create index quotation_lines_product_idx on public.quotation_lines (product_id) where product_id is not null;
create index fittings_product_idx on public.fittings (product_id) where product_id is not null;
create index stock_items_product_idx on public.stock_items (product_id) where product_id is not null;

-- a quote line takes its fitting's product (the quote functions stay unchanged)
create or replace function public.quote_line_product() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id is null and new.fitting_id is not null then
    select product_id into new.product_id from public.fittings where id = new.fitting_id;
  end if;
  return new;
end $$;
create trigger trg_quote_line_product before insert on public.quotation_lines
  for each row execute function public.quote_line_product();

-- ---------------------------------------------------------------------------
-- Import (admin): one row per product, upsert by SKU. p: [{sku, name, category (slug), fitting_type
-- (code), description, applications, benefits (array or "a|b"), restore_info, finishes (codes),
-- published, image}] → {created, updated, errors[]}
-- ---------------------------------------------------------------------------
create or replace function public.import_products(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; i int := 0; v_new int := 0; v_upd int := 0; v_err jsonb := '[]'; v_id uuid; v_inserted boolean;
        v_cat uuid; v_ft uuid; v_sku text; v_slug text; v_ben text[]; v_fin uuid[];
begin
  if not (select public.current_role_is('super_admin')) then
    raise exception 'Only the Super Admin imports the catalog' using errcode = '42501';
  end if;
  if jsonb_typeof(p) <> 'array' then raise exception 'Send a list of products' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(p) loop
    i := i + 1;
    begin
      v_sku := upper(trim(coalesce(r ->> 'sku', '')));
      if v_sku !~ '^[A-Z0-9][A-Z0-9-]{1,39}$' then raise exception 'SKU "%" — letters, digits and dashes only', v_sku; end if;
      if length(trim(coalesce(r ->> 'name', ''))) < 2 then raise exception 'Name is missing'; end if;
      v_cat := null; v_ft := null;
      if nullif(trim(r ->> 'category'), '') is not null then
        select id into v_cat from public.product_categories where slug = lower(trim(r ->> 'category'));
        if v_cat is null then raise exception 'Unknown category "%"', r ->> 'category'; end if;
      end if;
      if nullif(trim(r ->> 'fitting_type'), '') is not null then
        select id into v_ft from public.fitting_types where code = lower(trim(r ->> 'fitting_type'));
        if v_ft is null then raise exception 'Unknown fitting type "%"', r ->> 'fitting_type'; end if;
      end if;
      v_ben := case jsonb_typeof(r -> 'benefits') when 'array' then array(select jsonb_array_elements_text(r -> 'benefits'))
                    else array_remove(string_to_array(coalesce(r ->> 'benefits', ''), '|'), '') end;
      v_fin := array(select f.id from public.finishes f
                     where f.code = any (case jsonb_typeof(r -> 'finishes') when 'array' then array(select jsonb_array_elements_text(r -> 'finishes'))
                                              else string_to_array(lower(coalesce(r ->> 'finishes', '')), '|') end));
      v_slug := trim(both '-' from regexp_replace(lower(trim(r ->> 'name')) || '-' || lower(v_sku), '[^a-z0-9]+', '-', 'g'));
      insert into public.products (sku, slug, name, category_id, fitting_type_id, description, applications, benefits, restore_info, finish_ids, is_published)
      values (v_sku, v_slug, trim(r ->> 'name'), v_cat, v_ft, nullif(trim(r ->> 'description'), ''), nullif(trim(r ->> 'applications'), ''),
              v_ben, nullif(trim(r ->> 'restore_info'), ''), v_fin, coalesce((r ->> 'published')::boolean, false))
      on conflict (sku) do update set name = excluded.name, category_id = excluded.category_id, fitting_type_id = excluded.fitting_type_id,
        description = excluded.description, applications = excluded.applications, benefits = excluded.benefits,
        restore_info = excluded.restore_info, finish_ids = excluded.finish_ids, is_published = excluded.is_published
      returning id, (xmax = 0) into v_id, v_inserted;
      if v_inserted then v_new := v_new + 1; else v_upd := v_upd + 1; end if;
      if nullif(trim(r ->> 'image'), '') is not null and not exists (select 1 from public.product_media where product_id = v_id and path = trim(r ->> 'image')) then
        insert into public.product_media (product_id, path, alt, sort_order) values (v_id, trim(r ->> 'image'), trim(r ->> 'name'), 0);
      end if;
    exception when others then
      v_err := v_err || jsonb_build_object('row', i, 'sku', r ->> 'sku', 'error', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('created', v_new, 'updated', v_upd, 'errors', v_err);
end $$;
revoke execute on function public.import_products(jsonb) from public, anon;
grant execute on function public.import_products(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: categories, and one generic entry per fitting type (published), with the site's illustrations
-- ---------------------------------------------------------------------------
insert into public.product_categories (slug, name, sort_order) values
  ('mixers', 'Mixers', 10), ('showers', 'Showers', 20), ('diverters', 'Diverters', 30),
  ('spouts-faucets', 'Spouts & faucets', 40), ('valves-accessories', 'Valves & accessories', 50)
on conflict (slug) do nothing;

insert into public.products (sku, slug, name, category_id, fitting_type_id, description, restore_info, benefits, finish_ids, is_published, sort_order)
select 'GEN-' || upper(replace(ft.code, '_', '-')),
       replace(ft.code, '_', '-'),
       ft.name,
       (select id from public.product_categories where slug = case
          when ft.code in ('basin_mixer', 'shower_mixer') then 'mixers'
          when ft.code = 'shower_head' then 'showers'
          when ft.code = 'diverter' then 'diverters'
          when ft.code in ('spout', 'health_faucet') then 'spouts-faucets'
          else 'valves-accessories' end),
       ft.id,
       'REDUX restores the ' || lower(ft.name) || ' already on your wall — finish, function, or a Eurobrass replacement where restoring is not worth it.',
       'Every ' || lower(ft.name) || ' is photographed from four angles and assessed for one of three outcomes: restore the finish, repair the mechanism, or replace it with Eurobrass. All three prices are on the proposal.',
       array['Costs a fraction of buying new', 'No retiling or plumbing changes', 'Covered by the REDUX warranty'],
       (select array_agg(f.id order by f.name) from public.finishes f where f.is_active),
       true, ft.sort_order
from public.fitting_types ft
where ft.is_active and ft.code !~ '_test|test_'
on conflict (sku) do nothing;

insert into public.product_media (product_id, kind, path, alt, sort_order)
select p.id, m.kind, 'demo/fittings/' || ft.code || '-chrome-' || m.kind || '.svg', p.name || ' — ' || m.kind, m.n
from public.products p join public.fitting_types ft on ft.id = p.fitting_type_id
cross join (values ('before', 1), ('after', 2)) m(kind, n)
where p.sku like 'GEN-%' and ft.code in ('basin_mixer', 'shower_mixer', 'diverter', 'health_faucet', 'spout', 'shower_head')
  and not exists (select 1 from public.product_media x where x.product_id = p.id);

-- ---------------------------------------------------------------------------
-- Policies (ADR-004). The public website reads published rows server-side (lib/data/catalog.ts);
-- signed-in customers read published rows (the self-assessment form shows pictures); staff read all;
-- the Super Admin writes.
-- ---------------------------------------------------------------------------
alter table public.product_categories enable row level security;
alter table public.products           enable row level security;
alter table public.product_media      enable row level security;

create policy product_categories_read on public.product_categories for select to authenticated
  using ((select public.is_staff()) or is_active);
create policy product_categories_write on public.product_categories for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy products_read on public.products for select to authenticated
  using ((select public.is_staff()) or is_published);
create policy products_write on public.products for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
create policy product_media_read on public.product_media for select to authenticated
  using (exists (select 1 from public.products p where p.id = product_media.product_id));
create policy product_media_write on public.product_media for all to authenticated
  using ((select public.current_role_is('super_admin'))) with check ((select public.current_role_is('super_admin')));
