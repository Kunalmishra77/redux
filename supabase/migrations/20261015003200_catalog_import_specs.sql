-- CR-001 phase 7 — the catalog import also carries product details (specs: code, series, page, or any
-- spreadsheet column named "spec:<Name>") and the catalogue order. Body otherwise as in 003100.

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
      insert into public.products (sku, slug, name, category_id, fitting_type_id, description, applications, benefits, restore_info, finish_ids, is_published, specs, sort_order)
      values (v_sku, v_slug, trim(r ->> 'name'), v_cat, v_ft, nullif(trim(r ->> 'description'), ''), nullif(trim(r ->> 'applications'), ''),
              v_ben, nullif(trim(r ->> 'restore_info'), ''), v_fin, coalesce((r ->> 'published')::boolean, false),
              case when jsonb_typeof(r -> 'specs') = 'object' then r -> 'specs' else '{}'::jsonb end, coalesce(nullif(r ->> 'sort', '')::int, 0))
      on conflict (sku) do update set name = excluded.name, category_id = excluded.category_id, fitting_type_id = excluded.fitting_type_id,
        description = excluded.description, applications = excluded.applications, benefits = excluded.benefits,
        restore_info = excluded.restore_info, finish_ids = excluded.finish_ids, is_published = excluded.is_published,
        specs = excluded.specs, sort_order = excluded.sort_order
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
