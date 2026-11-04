-- DragoToY · 0005: cambios y devoluciones (notas de crédito) y cierre de caja.
-- Requiere 0004. No borra datos. Se puede correr más de una vez sin problema.
--
-- Devolución = nota de crédito: un comprobante con importes NEGATIVOS que apunta a la venta
-- original. Así Reportes, ganancias y unidades vendidas restan solos, sin tocar la venta original.
-- Cambio = nota de crédito por lo que devuelve + venta nueva por lo que se lleva, en un solo paso.

-- ── Tabla de ventas ────────────────────────────────────────────────────────────
alter table public.sales add column if not exists credit_for text references public.sales (id);
-- Las notas de crédito llevan su propia numeración por tipo (Nota de crédito B 0001-00000001).
alter table public.sales drop constraint if exists sales_invoice_type_number_key;
drop index if exists public.sales_number_idx;
create unique index if not exists sales_doc_number_idx on public.sales (invoice_type, (credit_for is not null), number) where number is not null;
create index if not exists sales_credit_for_idx on public.sales (credit_for) where credit_for is not null;

create table if not exists public.cash_closings (
  id text primary key,
  opened_at timestamptz not null,
  closed_at timestamptz not null default now(),
  user_id text,
  user_name text not null,
  opening_cash numeric(12, 2) not null default 0,
  by_method jsonb not null,
  sales_count int not null,
  refunds_count int not null,
  expected_cash numeric(12, 2) not null,
  counted_cash numeric(12, 2) not null,
  difference numeric(12, 2) not null,
  kept_cash numeric(12, 2) not null default 0,
  note text not null default ''
);
alter table public.cash_closings enable row level security;
revoke all on public.cash_closings from anon, authenticated;

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
    when 'ventas.devolver' then '{dueno,vendedor}'
    when 'ventas.anular' then '{dueno}'
    when 'pedidos.gestionar' then '{dueno,vendedor}'
    when 'caja.cerrar' then '{dueno,vendedor}'
    when 'caja.historial' then '{dueno}'
    when 'facturacion.ver' then '{dueno}'
    when 'ajustes.gestionar' then '{dueno}'
    when 'reportes.ver' then '{dueno}'
    when 'usuarios.gestionar' then '{dueno}'
    when 'actividad.ver' then '{dueno}'
    when 'respaldo.gestionar' then '{dueno}'
    else '{}'
  end::text[]
$$;

-- ── Nombre y JSON de un comprobante ────────────────────────────────────────────
create or replace function public.sale_label(s public.sales) returns text
language sql immutable as $$
  select case
    when s.number is null and s.reservation_code is not null then 'Reserva R-' || lpad(s.reservation_code::text, 4, '0')
    when s.credit_for is not null then 'Nota de crédito ' || s.invoice_type || ' 0001-' || lpad(s.number::text, 8, '0')
    else invoice_label(s.invoice_type, s.number) end
$$;

create or replace function public.sale_json(s public.sales) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', s.id, 'number', coalesce(s.number, 0), 'invoiceType', s.invoice_type, 'at', s.at, 'channel', s.channel,
    'customer', s.customer, 'items', s.items, 'subtotal', s.subtotal, 'couponCode', s.coupon_code, 'couponPercent', s.coupon_percent,
    'discountTotal', s.discount_total, 'total', s.total, 'iva', s.iva, 'paymentMethod', s.payment_method, 'status', s.status,
    'voidedAt', s.voided_at, 'voidReason', s.void_reason, 'test', s.test, 'userId', s.user_id,
    'reservationCode', s.reservation_code, 'reservedAt', s.reserved_at, 'expiresAt', s.expires_at,
    'creditFor', s.credit_for, 'creditForLabel', (select sale_label(o) from sales o where o.id = s.credit_for))
$$;

/** Cuántas unidades de cada producto ya se devolvieron de una venta: {productId: qty}. */
create or replace function public.returned_qty(p_sale_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(pid, q), '{}') from (
    select i ->> 'productId' pid, sum(-(i ->> 'qty')::int) q
    from sales n, jsonb_array_elements(n.items) i where n.credit_for = p_sale_id group by 1) t
$$;

-- ── Buscar la venta original ───────────────────────────────────────────────────
/** Ventas cobradas de los últimos 180 días por número de comprobante, nombre o documento (máx. 10). */
create or replace function public.sales_for_return(p_q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := lower(trim(coalesce(p_q, '')));
  v_digits text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  perform req('ventas.devolver');
  -- Un número de ticket puede ser de un solo dígito; un nombre necesita al menos 2 letras.
  if v_digits = '' and length(v_q) < 2 then return '[]'; end if;
  return coalesce((select jsonb_agg(sale_json_safe(s) || jsonb_build_object('returned', returned_qty(s.id)) order by s.at desc) from (
    select * from sales s
    where s.status = 'completada' and s.credit_for is null and s.at > now() - interval '180 days'
      and ((v_digits <> '' and (s.number = nullif(ltrim(right(v_digits, 8), '0'), '')::int or s.customer ->> 'doc' = v_digits
              or s.reservation_code = nullif(ltrim(v_digits, '0'), '')::int))
        or lower(s.customer ->> 'name') like '%' || v_q || '%')
    order by s.at desc limit 10) s), '[]');
end $$;

-- ── Cambio o devolución ────────────────────────────────────────────────────────
/**
 * p = { saleId, returns: [{productId, qty, restock}], items: [{productId, qty}], paymentMethod, reason }
 * - returns: lo que el cliente trae (crea una nota de crédito). restock=false si vino dañado:
 *   no vuelve al stock y su costo queda como pérdida.
 * - items: lo que se lleva a cambio (crea una venta de mostrador).
 * Todo con el mismo medio de pago: el neto es lo que el cliente paga (o recibe). Todo o nada.
 */
create or replace function public.exchange(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o sales;
  n sales;
  line jsonb;
  item jsonb;
  v_items jsonb := '[]';
  v_sub numeric := 0;
  v_after numeric := 0;
  v_tot numeric;
  v_qty int;
  v_left int;
  v_returned jsonb;
  v_number int;
  v_rate numeric;
  v_new jsonb;
  v_pay text := coalesce(p ->> 'paymentMethod', 'efectivo');
  v_has_returns boolean := jsonb_array_length(coalesce(p -> 'returns', '[]')) > 0;
  v_has_items boolean := jsonb_array_length(coalesce(p -> 'items', '[]')) > 0;
begin
  perform req('ventas.devolver');
  if v_pay not in ('efectivo', 'debito', 'credito', 'transferencia', 'mercadopago') then perform api_error(400, 'Medio de pago inválido'); end if;
  if not v_has_returns then perform api_error(400, 'Elige qué devuelve el cliente'); end if;
  select * into o from sales where id = p ->> 'saleId' for update;
  if o.id is null then perform api_error(404, 'La venta original ya no existe'); end if;
  if o.status <> 'completada' or o.credit_for is not null then perform api_error(409, 'Solo se puede devolver de una venta cobrada'); end if;
  v_returned := returned_qty(o.id);

  for line in select * from jsonb_array_elements(p -> 'returns') loop
    if (line ->> 'qty')::numeric <= 0 or (line ->> 'qty')::numeric <> trunc((line ->> 'qty')::numeric) then perform api_error(400, 'Cantidad inválida'); end if;
    v_qty := (line ->> 'qty')::int;
    item := null;
    select i into item from jsonb_array_elements(o.items) i where i ->> 'productId' = line ->> 'productId';
    if item is null then perform api_error(400, 'Ese producto no está en la venta original'); end if;
    v_left := (item ->> 'qty')::int - coalesce((v_returned ->> (line ->> 'productId'))::int, 0);
    if v_qty > v_left then perform api_error(409, 'De «' || (item ->> 'name') || '» se pueden devolver ' || v_left); end if;
    v_items := v_items || (item || jsonb_build_object('qty', -v_qty, 'restock', coalesce((line ->> 'restock')::boolean, true),
      -- Dañado: el costo no se recupera (queda como pérdida en el margen).
      'unitCost', case when coalesce((line ->> 'restock')::boolean, true) then item -> 'unitCost' else '0'::jsonb end));
    v_sub := v_sub + (item ->> 'unitPrice')::numeric * v_qty;
    v_after := v_after + (item ->> 'unitFinal')::numeric * v_qty;
  end loop;

  v_tot := round(round(v_after, 2) * (1 - o.coupon_percent / 100), 2);
  select iva_rate into v_rate from settings where id = 1;
  perform pg_advisory_xact_lock(hashtext('dragotoy_credit_' || o.invoice_type));
  select coalesce(max(number), 0) + 1 into v_number from sales where invoice_type = o.invoice_type and credit_for is not null;
  insert into sales (id, number, invoice_type, channel, customer, items, subtotal, coupon_code, coupon_percent, discount_total, total, iva, payment_method,
    status, test, user_id, credit_for, void_reason)
  values (new_id('nc'), v_number, o.invoice_type, 'mostrador', o.customer, v_items, -round(v_sub, 2), o.coupon_code, o.coupon_percent,
    -round(v_sub - v_tot, 2), -v_tot, -round(v_tot - v_tot / (1 + v_rate / 100), 2), v_pay, 'completada', o.test, auth.uid()::text, o.id,
    nullif(trim(coalesce(p ->> 'reason', '')), ''))
  returning * into n;

  for line in select * from jsonb_array_elements(v_items) loop
    if (line ->> 'restock')::boolean then
      update products set stock = stock - (line ->> 'qty')::int, updated_at = n.at where id = line ->> 'productId';
      if found then
        insert into movements (product_id, date, delta, reason, user_id, note)
        values (line ->> 'productId', n.at, -(line ->> 'qty')::int, 'venta', n.user_id, 'Devolución ' || sale_label(n));
      end if;
    end if;
  end loop;

  if v_has_items then
    v_new := checkout(jsonb_build_object('channel', 'mostrador', 'items', p -> 'items', 'customer', o.customer, 'invoiceType', o.invoice_type,
      'paymentMethod', v_pay, 'test', o.test));
  end if;

  perform log_audit(case when v_has_items then 'Cambio' else 'Devolución' end,
    sale_label(n) || ' sobre ' || sale_label(o) || ' · ' || fmt_price(-n.total)
    || case when v_has_items then ' · se lleva ' || invoice_label(o.invoice_type, (v_new ->> 'number')::int) || ' por ' || fmt_price((v_new ->> 'total')::numeric) else '' end
    || coalesce(' · Motivo: ' || n.void_reason, ''));
  perform touch('products');
  perform touch('sales');
  return jsonb_build_object('credit', sale_json_safe(n), 'sale', v_new);
end $$;

/** Anular entera una venta que ya tuvo devoluciones devolvería dos veces: se bloquea. */
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
  if s.credit_for is not null then perform api_error(409, 'Una nota de crédito no se anula'); end if;
  if exists (select 1 from sales where credit_for = s.id) then perform api_error(409, 'Esta venta ya tuvo devoluciones: devuelve el resto desde Vender → Cambio o devolución'); end if;
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

-- ── Cierre de caja ─────────────────────────────────────────────────────────────
/**
 * Lo que entró y salió desde el último cierre (o desde el comienzo del día si nunca se cerró),
 * por medio de pago. Incluye ventas, notas de crédito y anulaciones de ventas de turnos anteriores.
 * Las compras de prueba no cuentan: no es plata real.
 */
create or replace function public.cash_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_last cash_closings;
  v_from timestamptz;
  v_to timestamptz := now();
  v_methods jsonb;
  v_cash numeric;
begin
  perform req('caja.cerrar');
  select * into v_last from cash_closings order by closed_at desc limit 1;
  v_from := coalesce(v_last.closed_at, date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires') at time zone 'America/Argentina/Buenos_Aires');
  with moves as (
    select payment_method m, total amt, credit_for is null and total >= 0 is_sale, credit_for is not null is_refund, false is_void
    from sales where status = 'completada' and not test and at >= v_from and at < v_to
    union all
    -- Anulada ahora, cobrada en un turno anterior: esa plata sale de esta caja.
    select payment_method, -total, false, false, true from sales
    where status = 'anulada' and not test and voided_at >= v_from and voided_at < v_to and at < v_from
  )
  select coalesce(jsonb_agg(jsonb_build_object('method', m, 'amount', amt, 'sales', ns, 'refunds', nr, 'voids', nv) order by m), '[]')
  into v_methods
  from (select m, round(sum(amt), 2) amt, count(*) filter (where is_sale) ns, count(*) filter (where is_refund) nr, count(*) filter (where is_void) nv
        from moves group by m) t;
  select coalesce(sum((x ->> 'amount')::numeric), 0) into v_cash from jsonb_array_elements(v_methods) x where x ->> 'method' = 'efectivo';
  return jsonb_build_object('from', v_from, 'to', v_to, 'openingCash', coalesce(v_last.kept_cash, 0), 'byMethod', v_methods,
    'cashNet', v_cash, 'lastClosedBy', v_last.user_name);
end $$;

create or replace function public.closing_json(c public.cash_closings) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', c.id, 'openedAt', c.opened_at, 'closedAt', c.closed_at, 'userId', c.user_id, 'userName', c.user_name,
    'openingCash', c.opening_cash, 'byMethod', c.by_method, 'salesCount', c.sales_count, 'refundsCount', c.refunds_count,
    'expectedCash', c.expected_cash, 'countedCash', c.counted_cash, 'difference', c.difference, 'keptCash', c.kept_cash, 'note', c.note)
$$;

/** Cierra el turno: guarda lo esperado, lo contado y la diferencia. Lo que queda en caja es el fondo del próximo turno. */
create or replace function public.cash_close(p_opening numeric, p_counted numeric, p_kept numeric, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st jsonb;
  c cash_closings;
  v_expected numeric;
begin
  perform req('caja.cerrar');
  if p_opening is null or p_opening < 0 then perform api_error(400, 'El fondo inicial no puede ser negativo'); end if;
  if p_counted is null or p_counted < 0 then perform api_error(400, 'Escribe cuánto efectivo contaste'); end if;
  if p_kept is null or p_kept < 0 or p_kept > p_counted then perform api_error(400, 'Lo que queda en caja tiene que estar entre 0 y lo contado'); end if;
  perform pg_advisory_xact_lock(hashtext('dragotoy_cash'));
  st := cash_status();
  v_expected := round(p_opening + (st ->> 'cashNet')::numeric, 2);
  insert into cash_closings (id, opened_at, closed_at, user_id, user_name, opening_cash, by_method, sales_count, refunds_count,
    expected_cash, counted_cash, difference, kept_cash, note)
  values (new_id('caja'), (st ->> 'from')::timestamptz, (st ->> 'to')::timestamptz, auth.uid()::text,
    coalesce((select name from profiles where id = auth.uid()), 'Usuario'), round(p_opening, 2), st -> 'byMethod',
    (select coalesce(sum((x ->> 'sales')::int), 0) from jsonb_array_elements(st -> 'byMethod') x),
    (select coalesce(sum((x ->> 'refunds')::int), 0) from jsonb_array_elements(st -> 'byMethod') x),
    v_expected, round(p_counted, 2), round(p_counted - v_expected, 2), round(p_kept, 2), trim(coalesce(p_note, '')))
  returning * into c;
  perform log_audit('Cierre de caja', 'Esperado ' || fmt_price(c.expected_cash) || ' · contado ' || fmt_price(c.counted_cash)
    || ' · ' || case when c.difference = 0 then 'sin diferencia' when c.difference > 0 then 'sobran ' || fmt_price(c.difference) else 'faltan ' || fmt_price(-c.difference) end);
  perform touch('sales');
  return closing_json(c);
end $$;

create or replace function public.list_cash_closings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('caja.historial');
  return coalesce((select jsonb_agg(closing_json(c) order by c.closed_at desc) from (select * from cash_closings order by closed_at desc limit 200) c), '[]');
end $$;

-- ── Accesos ────────────────────────────────────────────────────────────────────
revoke all on function public.sale_label(public.sales), public.returned_qty(text), public.closing_json(public.cash_closings) from public, anon;
revoke all on function public.sales_for_return(text), public.exchange(jsonb), public.cash_status(), public.cash_close(numeric, numeric, numeric, text), public.list_cash_closings() from public, anon;
grant execute on function public.sales_for_return(text), public.exchange(jsonb), public.cash_status(), public.cash_close(numeric, numeric, numeric, text), public.list_cash_closings() to authenticated;
