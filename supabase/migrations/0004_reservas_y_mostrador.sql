-- DragoToY · 0004: reservas de la tienda, venta en mostrador y permisos nuevos.
-- No borra datos. Las ventas que ya existen siguen como están (completadas o anuladas).
-- Se puede correr más de una vez sin problema.
--
-- Antes: una compra de la tienda quedaba como venta cobrada al instante.
-- Ahora: queda «reservada» (separa el stock, no numera comprobante ni suma a reportes)
-- hasta que el cliente retira y paga; si no viene, se cancela y el stock vuelve.

-- ── Tabla de ventas ────────────────────────────────────────────────────────────
alter table public.sales alter column number drop not null; -- la reserva recibe número de comprobante recién al cobrarse
alter table public.sales add column if not exists reservation_code int;
alter table public.sales add column if not exists reserved_at timestamptz;
alter table public.sales add column if not exists expires_at timestamptz;
alter table public.sales drop constraint if exists sales_status_check;
alter table public.sales add constraint sales_status_check check (status in ('reservada', 'completada', 'anulada', 'cancelada'));
create unique index if not exists sales_reservation_code_idx on public.sales (reservation_code) where reservation_code is not null;
create index if not exists sales_status_idx on public.sales (status) where status = 'reservada';

-- ── Permisos ───────────────────────────────────────────────────────────────────
create or replace function public.perm_roles(p text) returns text[]
language sql immutable as $$
  select case p
    when 'inventario.ver' then '{dueno,vendedor}'
    when 'productos.crear' then '{dueno,vendedor}'
    when 'productos.reponer' then '{dueno,vendedor}'
    when 'productos.fotos' then '{dueno,vendedor}'
    when 'stock.ajustar' then '{dueno}'
    when 'productos.eliminar' then '{dueno}'
    when 'productos.importar' then '{dueno}'
    when 'proveedores.ver' then '{dueno,vendedor}'
    when 'categorias.ver' then '{dueno,vendedor}'
    when 'categorias.crear' then '{dueno,vendedor}'
    when 'categorias.editar' then '{dueno}'
    when 'proveedores.gestionar' then '{dueno}'
    when 'temporadas.ver' then '{dueno,vendedor}'
    when 'temporadas.gestionar' then '{dueno}'
    when 'descuentos.gestionar' then '{dueno}'
    when 'costos.ver' then '{dueno}'
    when 'ventas.ver' then '{dueno}'
    when 'ventas.crear' then '{dueno,vendedor}'
    when 'ventas.anular' then '{dueno}'
    when 'pedidos.gestionar' then '{dueno,vendedor}'
    when 'facturacion.ver' then '{dueno}'
    when 'ajustes.gestionar' then '{dueno}'
    when 'reportes.ver' then '{dueno}'
    when 'usuarios.gestionar' then '{dueno}'
    when 'actividad.ver' then '{dueno}'
    when 'respaldo.gestionar' then '{dueno}'
    else '{}'
  end::text[]
$$;

-- ── JSON de una venta ──────────────────────────────────────────────────────────
create or replace function public.sale_json(s public.sales) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', s.id, 'number', coalesce(s.number, 0), 'invoiceType', s.invoice_type, 'at', s.at, 'channel', s.channel,
    'customer', s.customer, 'items', s.items, 'subtotal', s.subtotal, 'couponCode', s.coupon_code, 'couponPercent', s.coupon_percent,
    'discountTotal', s.discount_total, 'total', s.total, 'iva', s.iva, 'paymentMethod', s.payment_method, 'status', s.status,
    'voidedAt', s.voided_at, 'voidReason', s.void_reason, 'test', s.test, 'userId', s.user_id,
    'reservationCode', s.reservation_code, 'reservedAt', s.reserved_at, 'expiresAt', s.expires_at)
$$;

/** Igual que sale_json, pero sin el costo de cada producto si quien pide no puede verlo (clientes y vendedores). */
create or replace function public.sale_json_safe(s public.sales) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when public.can('costos.ver') then sale_json(s)
    else jsonb_set(sale_json(s), '{items}', coalesce((select jsonb_agg(i - 'unitCost') from jsonb_array_elements(s.items) i), '[]')) end
$$;

create or replace function public.reservation_label(p_code int) returns text
language sql immutable as $$ select 'Reserva R-' || lpad(p_code::text, 4, '0') $$;

-- ── Cobro / reserva ────────────────────────────────────────────────────────────
/**
 * Tienda (sin sesión): crea una RESERVA. Separa el stock y congela precios, pero no numera
 * comprobante ni cuenta como venta. Vence a los 3 días.
 * Mostrador (con sesión y permiso ventas.crear): venta cobrada con comprobante.
 * Nunca se confía en los precios de la pantalla: se recalculan acá. Todo o nada.
 */
create or replace function public.checkout(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  line jsonb;
  pr products;
  v_items jsonb := '[]';
  v_subtotal numeric := 0;
  v_after numeric := 0;
  v_pct numeric;
  v_final numeric;
  v_coupon discounts;
  v_coupon_pct numeric := 0;
  v_total numeric;
  v_type text := p ->> 'invoiceType';
  v_reserve boolean := p ->> 'channel' = 'tienda';
  v_number int;
  v_code int;
  v_iva_rate numeric;
  s sales;
  v_doc text := regexp_replace(coalesce(p -> 'customer' ->> 'doc', ''), '\D', '', 'g');
  v_label text;
begin
  if p ->> 'channel' = 'mostrador' then perform req('ventas.crear');
  elsif not v_reserve then perform api_error(400, 'Canal inválido'); end if;
  if v_type not in ('A', 'B', 'X') then perform api_error(400, 'Tipo de comprobante inválido'); end if;
  if coalesce(p ->> 'paymentMethod', 'efectivo') not in ('efectivo', 'debito', 'credito', 'transferencia', 'mercadopago') then perform api_error(400, 'Medio de pago inválido'); end if;
  if jsonb_array_length(coalesce(p -> 'items', '[]')) = 0 then perform api_error(400, 'El carrito está vacío'); end if;
  if coalesce(trim(p -> 'customer' ->> 'name'), '') = '' then perform api_error(400, 'Escribe el nombre de quien compra'); end if;
  if v_type = 'A' and v_doc !~ '^\d{11}$' then perform api_error(400, 'Para factura A hace falta un CUIT de 11 dígitos'); end if;

  for line in select * from jsonb_array_elements(p -> 'items') loop
    select * into pr from products where id = line ->> 'productId' for update;
    if pr.id is null then perform api_error(404, 'Un producto del carrito ya no existe'); end if;
    if (line ->> 'qty')::numeric <= 0 or (line ->> 'qty')::numeric <> trunc((line ->> 'qty')::numeric) then perform api_error(400, 'Cantidad inválida'); end if;
    if (line ->> 'qty')::int > pr.stock then perform api_error(409, 'Solo quedan ' || pr.stock || ' de «' || pr.name || '»'); end if;
    v_pct := best_discount_percent(pr);
    v_final := round(pr.price * (1 - v_pct / 100), 2);
    v_items := v_items || jsonb_build_object('productId', pr.id, 'sku', pr.sku, 'name', pr.name, 'qty', (line ->> 'qty')::int, 'unitPrice', pr.price,
      'discountPercent', v_pct, 'unitFinal', v_final, 'unitCost', pr.cost);
    v_subtotal := v_subtotal + pr.price * (line ->> 'qty')::int;
    v_after := v_after + v_final * (line ->> 'qty')::int;
  end loop;

  if coalesce(trim(p ->> 'couponCode'), '') <> '' then
    select * into v_coupon from discounts d where d.kind = 'cupon' and upper(d.code) = upper(trim(p ->> 'couponCode')) and discount_live(d);
    if v_coupon.id is null then perform api_error(400, 'El cupón no existe o ya venció'); end if;
    v_coupon_pct := v_coupon.percent;
  end if;
  v_subtotal := round(v_subtotal, 2);
  v_total := round(round(v_after, 2) * (1 - v_coupon_pct / 100), 2);
  select iva_rate into v_iva_rate from settings where id = 1;

  if v_reserve then
    perform pg_advisory_xact_lock(hashtext('dragotoy_reservation'));
    select coalesce(max(reservation_code), 0) + 1 into v_code from sales;
  else
    perform pg_advisory_xact_lock(hashtext('dragotoy_invoice_' || v_type));
    select coalesce(max(number), 0) + 1 into v_number from sales where invoice_type = v_type;
  end if;

  insert into sales (id, number, invoice_type, channel, customer, items, subtotal, coupon_code, coupon_percent, discount_total, total, iva, payment_method,
    status, reservation_code, reserved_at, expires_at, test, user_id)
  values (new_id('vta'), v_number, v_type, p ->> 'channel',
    jsonb_build_object('name', trim(p -> 'customer' ->> 'name'), 'email', trim(coalesce(p -> 'customer' ->> 'email', '')),
      'docType', coalesce(p -> 'customer' ->> 'docType', ''), 'doc', coalesce(p -> 'customer' ->> 'doc', '')),
    v_items, v_subtotal, v_coupon.code, v_coupon_pct, round(v_subtotal - v_total, 2), v_total,
    round(v_total - v_total / (1 + v_iva_rate / 100), 2), coalesce(p ->> 'paymentMethod', 'efectivo'),
    case when v_reserve then 'reservada' else 'completada' end, v_code,
    case when v_reserve then now() end, case when v_reserve then now() + interval '3 days' end,
    coalesce((p ->> 'test')::boolean, false), auth.uid()::text)
  returning * into s;

  v_label := case when v_reserve then reservation_label(s.reservation_code) else invoice_label(s.invoice_type, s.number) end;
  for line in select * from jsonb_array_elements(v_items) loop
    update products set stock = stock - (line ->> 'qty')::int, updated_at = s.at where id = line ->> 'productId';
    insert into movements (product_id, date, delta, reason, user_id, note)
    values (line ->> 'productId', s.at, -(line ->> 'qty')::int, 'venta', s.user_id, v_label || case when s.test then ' (prueba)' else '' end);
  end loop;

  perform log_audit(
    case when v_reserve then case when s.test then 'Reserva de prueba' else 'Reserva online' end when s.test then 'Venta de prueba' else 'Venta' end,
    v_label || ' · ' || s.channel || ' · ' || fmt_price(s.total) || case when v_reserve then ' · ' || (s.customer ->> 'name') else '' end);
  perform touch('products');
  perform touch('sales');
  return sale_json_safe(s);
end $$;

-- ── Pedidos (reservas) ─────────────────────────────────────────────────────────
/** Reservas pendientes y las resueltas en los últimos 60 días. Sin costos para el vendedor. */
create or replace function public.list_reservations() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('pedidos.gestionar');
  return coalesce((select jsonb_agg(sale_json_safe(s) order by s.reserved_at desc) from sales s
    where s.reservation_code is not null and (s.status = 'reservada' or s.reserved_at > now() - interval '60 days')), '[]');
end $$;

/** El cliente retiró y pagó: recién ahora es venta, recibe número de comprobante y cuenta en reportes (con fecha de hoy). */
create or replace function public.reservation_complete(p_id text, p_payment text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s sales;
  v_number int;
begin
  perform req('pedidos.gestionar');
  if p_payment not in ('efectivo', 'debito', 'credito', 'transferencia', 'mercadopago') then perform api_error(400, 'Medio de pago inválido'); end if;
  select * into s from sales where id = p_id for update;
  if s.id is null then perform api_error(404, 'La reserva ya no existe'); end if;
  if s.status <> 'reservada' then perform api_error(409, 'Esta reserva ya se resolvió'); end if;
  perform pg_advisory_xact_lock(hashtext('dragotoy_invoice_' || s.invoice_type));
  select coalesce(max(number), 0) + 1 into v_number from sales where invoice_type = s.invoice_type;
  update sales set status = 'completada', number = v_number, at = now(), payment_method = p_payment, user_id = auth.uid()::text
  where id = p_id returning * into s;
  perform log_audit(case when s.test then 'Reserva de prueba retirada' else 'Reserva retirada' end,
    reservation_label(s.reservation_code) || ' → ' || invoice_label(s.invoice_type, s.number) || ' · ' || fmt_price(s.total));
  perform touch('sales');
  return sale_json_safe(s);
end $$;

/** Cancela una reserva (no vino, se arrepintió, venció): el stock vuelve. Queda guardada como cancelada. */
create or replace function public.reservation_cancel(p_id text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s sales;
  line jsonb;
begin
  perform req('pedidos.gestionar');
  if coalesce(trim(p_reason), '') = '' then perform api_error(400, 'Indica por qué se cancela'); end if;
  select * into s from sales where id = p_id for update;
  if s.id is null then perform api_error(404, 'La reserva ya no existe'); end if;
  if s.status <> 'reservada' then perform api_error(409, 'Esta reserva ya se resolvió'); end if;
  update sales set status = 'cancelada', voided_at = now(), void_reason = trim(p_reason) where id = p_id returning * into s;
  for line in select * from jsonb_array_elements(s.items) loop
    update products set stock = stock + (line ->> 'qty')::int, updated_at = s.voided_at where id = line ->> 'productId';
    if found then
      insert into movements (product_id, date, delta, reason, user_id, note)
      values (line ->> 'productId', s.voided_at, (line ->> 'qty')::int, 'venta', auth.uid()::text, reservation_label(s.reservation_code) || ' cancelada');
    end if;
  end loop;
  perform log_audit('Reserva cancelada', reservation_label(s.reservation_code) || ' · ' || (s.customer ->> 'name') || ' · Motivo: ' || s.void_reason);
  perform touch('products');
  perform touch('sales');
  return sale_json_safe(s);
end $$;

/** Cancela de una vez todas las reservas vencidas. Devuelve cuántas liberó. */
create or replace function public.reservation_release_expired() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  n int := 0;
begin
  perform req('pedidos.gestionar');
  for v_id in select id from sales where status = 'reservada' and expires_at < now() loop
    perform reservation_cancel(v_id, 'Venció sin retirar');
    n := n + 1;
  end loop;
  return n;
end $$;

/** Anular solo aplica a ventas cobradas; las reservas se cancelan desde Pedidos. */
create or replace function public.sale_void(p_id text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s sales;
  line jsonb;
begin
  perform req('ventas.anular');
  if coalesce(trim(p_reason), '') = '' then perform api_error(400, 'Indica el motivo de la anulación'); end if;
  select * into s from sales where id = p_id for update;
  if s.id is null then perform api_error(404, 'La venta ya no existe'); end if;
  if s.status = 'anulada' then perform api_error(409, 'La venta ya estaba anulada'); end if;
  if s.status <> 'completada' then perform api_error(409, 'Las reservas se cancelan desde Pedidos'); end if;
  update sales set status = 'anulada', voided_at = now(), void_reason = trim(p_reason) where id = p_id returning * into s;
  for line in select * from jsonb_array_elements(s.items) loop
    update products set stock = stock + (line ->> 'qty')::int, updated_at = s.voided_at where id = line ->> 'productId';
    if found then
      insert into movements (product_id, date, delta, reason, user_id, note)
      values (line ->> 'productId', s.voided_at, (line ->> 'qty')::int, 'venta', auth.uid()::text, 'Anulación ' || invoice_label(s.invoice_type, s.number));
    end if;
  end loop;
  perform log_audit('Venta anulada', invoice_label(s.invoice_type, s.number) || ' · ' || fmt_price(s.total) || ' · Motivo: ' || s.void_reason);
  perform touch('products');
  perform touch('sales');
  return sale_json(s);
end $$;

-- ── Accesos ────────────────────────────────────────────────────────────────────
revoke all on function public.sale_json_safe(public.sales), public.reservation_label(int) from public, anon;
revoke all on function public.list_reservations(), public.reservation_complete(text, text), public.reservation_cancel(text, text), public.reservation_release_expired() from public, anon;
grant execute on function public.list_reservations(), public.reservation_complete(text, text), public.reservation_cancel(text, text), public.reservation_release_expired() to authenticated;
grant execute on function public.checkout(jsonb) to anon, authenticated;
