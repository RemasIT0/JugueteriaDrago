-- ═══════════════════════════════════════════════════════════════════════════════
-- DragoToY · 0002: lo que la tienda y la app piden sin pasar por una pantalla del panel.
-- Cómo aplicarlo: Supabase → SQL Editor → pegar este archivo → Run (después de 0001).
-- ═══════════════════════════════════════════════════════════════════════════════

/** Datos del emisor para imprimir el comprobante desde la tienda (sin gastos fijos ni márgenes). */
create or replace function public.public_settings() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('fixedCosts', '[]'::jsonb, 'defaultMargin', 0, 'ivaRate', s.iva_rate, 'business', s.business)
  from settings s where id = 1
$$;

/**
 * Valida un cupón escrito por el cliente. Devuelve solo ese cupón si está vigente:
 * la tienda nunca recibe la lista de códigos.
 */
create or replace function public.check_coupon(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', d.code, 'percent', d.percent)
  from discounts d
  where d.kind = 'cupon' and upper(d.code) = upper(trim(p_code)) and discount_live(d)
  limit 1
$$;

/** Registra en Actividad acciones que ocurren en el navegador (lista cerrada: no se puede inventar cualquier cosa). */
create or replace function public.log_client_event(p_action text, p_detail text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or my_role() is null then perform api_error(401, 'Tu sesión terminó. Vuelve a ingresar.'); end if;
  if p_action not in ('Copia de seguridad descargada', 'Contraseña cambiada') then perform api_error(400, 'Acción no registrable'); end if;
  perform log_audit(p_action, left(coalesce(p_detail, ''), 200));
end $$;

revoke execute on function public.public_settings(), public.check_coupon(text), public.log_client_event(text, text) from public, anon, authenticated;
grant execute on function public.public_settings(), public.check_coupon(text) to anon, authenticated;
grant execute on function public.log_client_event(text, text) to authenticated;
