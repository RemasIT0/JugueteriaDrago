-- DragoToY · 0006: aumento de precios por porcentaje, a muchos productos de una vez.
-- No borra datos. Se puede correr más de una vez sin problema.
--
-- La pantalla calcula y muestra la vista previa (precio actual → nuevo, con redondeo);
-- acá se valida y se guarda todo junto: o se aplican todos los precios o ninguno.
-- Solo el dueño (mismo permiso que editar precios en el panel del producto).

/**
 * p_items: [{ id, price, cost? }]  — cost solo se toca si viene en el ítem.
 * p_note:  resumen para Actividad, ej. «+10 % a Peluches (redondeo a $100)».
 */
create or replace function public.products_set_prices(p_items jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  n int := 0;
  v_out jsonb := '[]';
  r products;
begin
  perform req('categorias.editar');
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then perform api_error(400, 'No hay productos para cambiar'); end if;
  if jsonb_array_length(p_items) > 5000 then perform api_error(400, 'Demasiados productos de una vez'); end if;
  for x in select * from jsonb_array_elements(p_items) loop
    if (x ->> 'price') is null or (x ->> 'price')::numeric < 0 then perform api_error(400, 'Hay un precio inválido'); end if;
    if x ? 'cost' and (x ->> 'cost') is not null and (x ->> 'cost')::numeric < 0 then perform api_error(400, 'Hay un costo inválido'); end if;
    update products set
      price = round((x ->> 'price')::numeric, 2),
      cost = case when x ? 'cost' and can('costos.ver') then round(nullif(x ->> 'cost', '')::numeric, 2) else cost end,
      updated_at = now()
    where id = x ->> 'id' returning * into r;
    if r.id is null then perform api_error(404, 'Un producto ya no existe: vuelve a abrir el aumento'); end if;
    v_out := v_out || product_json(r);
    n := n + 1;
    r := null;
  end loop;
  perform log_audit('Cambio de precios masivo', coalesce(nullif(trim(p_note), ''), 'Precios actualizados') || ' · ' || n || ' producto' || case when n = 1 then '' else 's' end);
  perform touch('products');
  return v_out;
end $$;

revoke all on function public.products_set_prices(jsonb, text) from public, anon;
grant execute on function public.products_set_prices(jsonb, text) to authenticated;
