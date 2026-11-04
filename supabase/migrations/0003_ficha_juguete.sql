-- DragoToY · 0003: ficha del juguete para la tienda (descripción y características).
-- No borra ni cambia datos: agrega dos columnas con valor vacío por defecto.
-- Se puede correr más de una vez sin problema.

alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists features text[] not null default '{}';

-- El producto en JSON ahora incluye la ficha.
create or replace function public.product_json(p public.products) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'sku', p.sku, 'name', p.name, 'categoryId', p.category_id, 'supplierId', p.supplier_id,
    'price', p.price, 'cost', case when public.can('costos.ver') then p.cost end,
    'seasons', to_jsonb(p.seasons), 'stock', p.stock, 'minStock', p.min_stock, 'ageMin', p.age_min,
    'batteries', p.batteries, 'brand', p.brand, 'photos', to_jsonb(p.photos), 'loteId', p.lote_id,
    'description', p.description, 'features', to_jsonb(p.features),
    'createdAt', p.created_at, 'updatedAt', p.updated_at)
$$;

-- La tienda pública también recibe la ficha (sigue sin costos ni proveedores).
create or replace function public.public_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'sku', p.sku, 'name', p.name, 'categoryId', p.category_id, 'price', p.price,
      'stock', p.stock, 'ageMin', p.age_min, 'batteries', p.batteries, 'brand', p.brand, 'photos', to_jsonb(p.photos), 'seasons', to_jsonb(p.seasons),
      'description', p.description, 'features', to_jsonb(p.features)) order by p.name)
      from products p where p.stock > 0), '[]'),
    'categories', coalesce((select jsonb_agg(category_json(c) - 'marginTarget' order by c.name) from categories c), '[]'),
    'seasons', coalesce((select jsonb_agg(season_json(s) order by s.id) from seasons s), '[]'),
    'discounts', coalesce((select jsonb_agg(discount_json(d) order by d.created_at desc) from discounts d where d.kind <> 'cupon'), '[]'))
$$;

-- Guardar la ficha desde el panel. Mismo permiso que editar productos.
create or replace function public.product_set_details(p_id text, p_description text, p_features jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r products;
  v_desc text := trim(coalesce(p_description, ''));
  v_feats text[];
begin
  perform req('productos.crear');
  if char_length(v_desc) > 1500 then perform api_error(400, 'La descripción puede tener hasta 1500 letras'); end if;
  select coalesce(array_agg(trim(x)), '{}') into v_feats
    from jsonb_array_elements_text(coalesce(p_features, '[]')) x where trim(x) <> '';
  if cardinality(v_feats) > 12 then perform api_error(400, 'Pon hasta 12 características'); end if;
  if exists (select 1 from unnest(v_feats) f where char_length(f) > 120) then perform api_error(400, 'Cada característica puede tener hasta 120 letras'); end if;

  update products set description = v_desc, features = v_feats, updated_at = now() where id = p_id returning * into r;
  if r.id is null then perform api_error(404, 'El producto ya no existe'); end if;
  perform log_audit('Ficha de tienda editada', r.name);
  perform touch('products');
  return product_json(r);
end $$;

revoke all on function public.product_set_details(text, text, jsonb) from public, anon;
grant execute on function public.product_set_details(text, text, jsonb) to authenticated;
