-- ═══════════════════════════════════════════════════════════════════════════════
-- DragoToY · base de datos en Supabase (PostgreSQL)
--
-- Criterio de seguridad: el navegador NO toca las tablas. Todo pasa por funciones
-- (supabase.rpc) que verifican la sesión y el rol en el servidor. Las tablas tienen
-- RLS activado y sin políticas, así que una consulta directa no devuelve nada.
--
-- Errores: se lanzan con HINT = código HTTP (400, 401, 403, 404, 409) para que la
-- app los muestre igual que antes.
--
-- Cómo aplicarlo: Supabase → SQL Editor → pegar este archivo completo → Run.
-- ═══════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ── Tablas ─────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  name text not null,
  role text not null default 'vendedor' check (role in ('dueno', 'vendedor')),
  active boolean not null default false,
  -- Una cuenta creada por fuera del sistema queda pendiente hasta que el dueño la habilite.
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.categories (
  id text primary key,
  name text not null,
  color text not null,
  defaults jsonb not null default '{}',
  margin_target numeric
);
create unique index if not exists categories_name_key on public.categories (lower(name));

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  contact text not null default '',
  phone text not null default '',
  email text not null default ''
);
create unique index if not exists suppliers_name_key on public.suppliers (lower(name));

create table if not exists public.seasons (
  id text primary key,
  name text not null,
  color text not null,
  rule jsonb not null,
  lead_days int not null default 30
);

create table if not exists public.products (
  id text primary key,
  sku text not null unique,
  name text not null,
  category_id text not null references public.categories (id),
  supplier_id text references public.suppliers (id) on delete set null,
  price numeric(12, 2) not null check (price >= 0),
  cost numeric(12, 2) check (cost >= 0),
  seasons text[] not null default '{}',
  stock int not null default 0 check (stock >= 0),
  min_stock int not null default 0 check (min_stock >= 0),
  age_min int not null default 0,
  batteries boolean not null default false,
  brand text not null default '',
  photos text[] not null default '{}',
  lote_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Historial de stock: sin clave foránea, para que sobreviva aunque se borre el producto.
create table if not exists public.movements (
  id text primary key default 'mov_' || replace(gen_random_uuid()::text, '-', ''),
  product_id text not null,
  date timestamptz not null default now(),
  delta int not null,
  reason text not null check (reason in ('alta', 'ingreso', 'venta', 'ajuste')),
  user_id text,
  note text
);
create index if not exists movements_product_idx on public.movements (product_id, date desc);
create index if not exists movements_date_idx on public.movements (date desc);

create table if not exists public.discounts (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('producto', 'categoria', 'temporada', 'cupon')),
  target_id text,
  target_ids text[],
  code text,
  percent numeric not null check (percent > 0 and percent <= 90),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists discounts_code_key on public.discounts (upper(code)) where kind = 'cupon';

create table if not exists public.sales (
  id text primary key,
  number int not null,
  invoice_type text not null check (invoice_type in ('A', 'B', 'X')),
  at timestamptz not null default now(),
  channel text not null check (channel in ('tienda', 'mostrador')),
  customer jsonb not null,
  items jsonb not null,
  subtotal numeric(12, 2) not null,
  coupon_code text,
  coupon_percent numeric not null default 0,
  discount_total numeric(12, 2) not null,
  total numeric(12, 2) not null,
  iva numeric(12, 2) not null,
  payment_method text not null,
  status text not null default 'completada' check (status in ('completada', 'anulada')),
  voided_at timestamptz,
  void_reason text,
  test boolean not null default false,
  user_id text,
  unique (invoice_type, number)
);
create index if not exists sales_at_idx on public.sales (at desc);

create table if not exists public.audit (
  id text primary key default 'a_' || replace(gen_random_uuid()::text, '-', ''),
  at timestamptz not null default now(),
  user_id text,
  user_name text not null,
  action text not null,
  detail text not null default ''
);
create index if not exists audit_at_idx on public.audit (at desc);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  fixed_costs jsonb not null default '[]',
  default_margin numeric not null default 60,
  iva_rate numeric not null default 21,
  business jsonb not null default '{"name":"DragoToY","cuit":"","address":"","ivaCondition":"Responsable Inscripto"}'
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Aviso liviano para sincronizar pantallas abiertas (Realtime): solo dice «cambió tal tabla».
create table if not exists public.sync_events (
  id bigserial primary key,
  table_name text not null,
  at timestamptz not null default now()
);

-- Nadie entra a las tablas directamente: RLS activado y sin políticas = acceso denegado.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.seasons enable row level security;
alter table public.products enable row level security;
alter table public.movements enable row level security;
alter table public.discounts enable row level security;
alter table public.sales enable row level security;
alter table public.audit enable row level security;
alter table public.settings enable row level security;
alter table public.sync_events enable row level security;
-- Excepción: los avisos de sincronización los puede leer cualquier usuario con sesión (no tienen datos).
drop policy if exists sync_events_read on public.sync_events;
create policy sync_events_read on public.sync_events for select to authenticated using (true);

-- ── Permisos ───────────────────────────────────────────────────────────────────

-- Misma matriz que src/lib/permissions.ts.
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
    when 'ventas.anular' then '{dueno}'
    when 'facturacion.ver' then '{dueno}'
    when 'ajustes.gestionar' then '{dueno}'
    when 'reportes.ver' then '{dueno}'
    when 'usuarios.gestionar' then '{dueno}'
    when 'actividad.ver' then '{dueno}'
    when 'respaldo.gestionar' then '{dueno}'
    else '{}'
  end::text[]
$$;

create or replace function public.api_error(status int, msg text) returns void
language plpgsql as $$
begin
  raise exception '%', msg using hint = status::text;
end $$;

/** Rol del usuario con sesión, solo si está activo y habilitado. */
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active and approved
$$;

create or replace function public.can(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = any (public.perm_roles(p)), false)
$$;

create or replace function public.req(p text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or public.my_role() is null then
    perform public.api_error(401, 'Tu sesión terminó. Vuelve a ingresar.');
  end if;
  if not public.can(p) then
    perform public.api_error(403, 'Tu usuario no tiene permiso para esta acción.');
  end if;
end $$;

create or replace function public.log_audit(p_action text, p_detail text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  select name into v_name from profiles where id = auth.uid();
  insert into audit (user_id, user_name, action, detail) values (auth.uid()::text, coalesce(v_name, 'Sistema'), p_action, coalesce(p_detail, ''));
end $$;

create or replace function public.touch(p_table text) returns void
language sql security definer set search_path = public as $$
  insert into sync_events (table_name) values (p_table);
  delete from sync_events where at < now() - interval '1 day';
$$;

create or replace function public.new_id(prefix text) returns text
language sql volatile as $$ select prefix || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16) $$;

create or replace function public.fmt_price(n numeric) returns text
language sql immutable as $$
  select '$ ' || replace(replace(replace(to_char(n, 'FM999G999G999D00'), ',', '#'), '.', ','), '#', '.')
$$;

-- ── Conversión a JSON (los nombres de campo son los mismos que usa la app) ────────

create or replace function public.product_json(p public.products) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'sku', p.sku, 'name', p.name, 'categoryId', p.category_id, 'supplierId', p.supplier_id,
    'price', p.price, 'cost', case when public.can('costos.ver') then p.cost end,
    'seasons', to_jsonb(p.seasons), 'stock', p.stock, 'minStock', p.min_stock, 'ageMin', p.age_min,
    'batteries', p.batteries, 'brand', p.brand, 'photos', to_jsonb(p.photos), 'loteId', p.lote_id,
    'createdAt', p.created_at, 'updatedAt', p.updated_at)
$$;

create or replace function public.category_json(c public.categories) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color, 'defaults', c.defaults, 'marginTarget', c.margin_target))
$$;

create or replace function public.supplier_json(s public.suppliers) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', s.id, 'name', s.name, 'contact', s.contact, 'phone', s.phone, 'email', s.email)
$$;

create or replace function public.season_json(s public.seasons) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', s.id, 'name', s.name, 'color', s.color, 'rule', s.rule, 'leadDays', s.lead_days)
$$;

create or replace function public.discount_json(d public.discounts) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', d.id, 'name', d.name, 'kind', d.kind, 'targetId', d.target_id, 'targetIds', to_jsonb(d.target_ids),
    'code', d.code, 'percent', d.percent, 'startsAt', d.starts_at, 'endsAt', d.ends_at, 'active', d.active, 'createdAt', d.created_at)
$$;

create or replace function public.sale_json(s public.sales) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', s.id, 'number', s.number, 'invoiceType', s.invoice_type, 'at', s.at, 'channel', s.channel,
    'customer', s.customer, 'items', s.items, 'subtotal', s.subtotal, 'couponCode', s.coupon_code, 'couponPercent', s.coupon_percent,
    'discountTotal', s.discount_total, 'total', s.total, 'iva', s.iva, 'paymentMethod', s.payment_method, 'status', s.status,
    'voidedAt', s.voided_at, 'voidReason', s.void_reason, 'test', s.test, 'userId', s.user_id)
$$;

create or replace function public.movement_json(m public.movements) returns jsonb
language sql stable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', m.id, 'productId', m.product_id, 'date', m.date, 'delta', m.delta, 'reason', m.reason, 'userId', m.user_id, 'note', m.note))
$$;

create or replace function public.settings_json(s public.settings) returns jsonb
language sql stable as $$
  select jsonb_build_object('fixedCosts', s.fixed_costs, 'defaultMargin', s.default_margin, 'ivaRate', s.iva_rate, 'business', s.business)
$$;

create or replace function public.profile_json(u public.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', u.id, 'username', u.username, 'name', u.name, 'role', u.role, 'active', u.active,
    'approved', u.approved, 'createdAt', u.created_at, 'lastLoginAt', u.last_login_at)
$$;

-- ── Usuarios ───────────────────────────────────────────────────────────────────

/**
 * Cada cuenta nueva de Supabase Auth crea su perfil. La primera cuenta es el dueño;
 * las demás quedan pendientes hasta que el dueño las habilita (así nadie se registra solo).
 */
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first boolean;
begin
  perform pg_advisory_xact_lock(hashtext('dragotoy_first_user'));
  select not exists (select 1 from profiles) into v_first;
  insert into profiles (id, username, name, role, active, approved)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'Sin nombre'),
    case when v_first then 'dueno' else 'vendedor' end,
    v_first,
    v_first
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

/** Sin sesión: ¿la tienda ya tiene dueño? (para mostrar «Configurar la tienda» o «Ingresar»). */
create or replace function public.has_users() returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from profiles) $$;

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$ select not exists (select 1 from profiles where username = lower(trim(p_username))) $$;

/**
 * Después de ingresar: valida que la cuenta esté habilitada, registra el ingreso y devuelve el perfil.
 * Un rechazo se devuelve como { rejected, message } en vez de lanzar un error: así el registro
 * del intento en Actividad no se deshace junto con el error.
 */
create or replace function public.register_login() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u profiles;
begin
  select * into u from profiles where id = auth.uid();
  if u.id is null then perform api_error(401, 'Tu sesión terminó. Vuelve a ingresar.'); end if;
  if not u.approved then
    insert into audit (user_id, user_name, action, detail) values (u.id::text, u.name, 'Ingreso rechazado', 'Usuario pendiente de habilitación «' || u.username || '»');
    return jsonb_build_object('rejected', true, 'message', 'Tu usuario todavía no fue habilitado. Pide al dueño que lo active.');
  end if;
  if not u.active then
    insert into audit (user_id, user_name, action, detail) values (u.id::text, u.name, 'Ingreso rechazado', 'Usuario desactivado «' || u.username || '»');
    return jsonb_build_object('rejected', true, 'message', 'Este usuario está desactivado. Pide al dueño que lo reactive.');
  end if;
  update profiles set last_login_at = now() where id = u.id returning * into u;
  perform log_audit('Ingreso', '');
  return profile_json(u);
end $$;

/** Perfil de la sesión actual, sin registrar nada (al recargar la página). */
create or replace function public.my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select profile_json(p) from profiles p where id = auth.uid() and active and approved
$$;

create or replace function public.register_logout() returns void
language sql security definer set search_path = public as $$ select log_audit('Salida', '') $$;

/** Sin sesión: deja constancia de un intento fallido (texto acotado para que no se abuse). */
create or replace function public.log_login_failure(p_username text) returns void
language sql security definer set search_path = public as $$
  insert into audit (user_id, user_name, action, detail) values (null, 'Sistema', 'Ingreso fallido', 'Usuario «' || left(coalesce(p_username, ''), 40) || '»')
$$;

create or replace function public.user_names() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('inventario.ver');
  return coalesce((select jsonb_object_agg(id::text, name) from profiles), '{}');
end $$;

create or replace function public.list_users() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('usuarios.gestionar');
  return coalesce((select jsonb_agg(profile_json(p) order by p.created_at) from profiles p), '[]');
end $$;

create or replace function public.active_owners(except_id uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from profiles where role = 'dueno' and active and approved and id is distinct from except_id
$$;

/** El dueño habilita una cuenta recién creada (o una pendiente) con su rol. */
create or replace function public.admin_approve_user(p_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u profiles;
begin
  perform req('usuarios.gestionar');
  if p_role not in ('dueno', 'vendedor') then perform api_error(400, 'Rol inválido'); end if;
  update profiles set role = p_role, active = true, approved = true where id = p_id returning * into u;
  if u.id is null then perform api_error(404, 'El usuario ya no existe'); end if;
  perform log_audit('Usuario creado', '«' || u.username || '» como ' || case p_role when 'dueno' then 'Dueño' else 'Vendedor' end);
  return profile_json(u);
end $$;

create or replace function public.admin_set_active(p_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u profiles;
begin
  perform req('usuarios.gestionar');
  select * into u from profiles where id = p_id;
  if u.id is null then perform api_error(404, 'El usuario ya no existe'); end if;
  if p_id = auth.uid() then perform api_error(400, 'No puedes desactivar tu propio usuario.'); end if;
  if not p_active and u.role = 'dueno' and active_owners(p_id) < 1 then perform api_error(400, 'Debe quedar al menos un dueño activo.'); end if;
  update profiles set active = p_active, approved = approved or p_active where id = p_id returning * into u;
  perform log_audit(case when p_active then 'Usuario reactivado' else 'Usuario desactivado' end, '«' || u.username || '»');
  return profile_json(u);
end $$;

create or replace function public.admin_set_role(p_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u profiles;
begin
  perform req('usuarios.gestionar');
  if p_role not in ('dueno', 'vendedor') then perform api_error(400, 'Rol inválido'); end if;
  select * into u from profiles where id = p_id;
  if u.id is null then perform api_error(404, 'El usuario ya no existe'); end if;
  if u.role = 'dueno' and p_role <> 'dueno' and active_owners(p_id) < 1 then perform api_error(400, 'Debe quedar al menos un dueño activo.'); end if;
  update profiles set role = p_role where id = p_id returning * into u;
  perform log_audit('Cambio de rol', '«' || u.username || '» → ' || case p_role when 'dueno' then 'Dueño' else 'Vendedor' end);
  return profile_json(u);
end $$;

create or replace function public.password_problem(pw text) returns text
language sql immutable as $$
  select case
    when length(coalesce(pw, '')) < 8 then 'La contraseña necesita al menos 8 caracteres'
    when pw !~ '[0-9]' then 'La contraseña necesita al menos un número'
    when pw !~ '[[:alpha:]]' then 'La contraseña necesita al menos una letra'
  end
$$;

/** El dueño asigna una contraseña nueva a otro usuario (se guarda con bcrypt, como el resto de Supabase Auth). */
create or replace function public.admin_set_password(p_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_problem text := password_problem(p_password);
  v_username text;
begin
  perform req('usuarios.gestionar');
  if v_problem is not null then perform api_error(400, v_problem); end if;
  select username into v_username from profiles where id = p_id;
  if v_username is null then perform api_error(404, 'El usuario ya no existe'); end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  perform log_audit('Contraseña restablecida', '«' || v_username || '»');
end $$;

-- ── Lecturas ───────────────────────────────────────────────────────────────────

create or replace function public.list_products() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('inventario.ver');
  return coalesce((select jsonb_agg(product_json(p) order by p.created_at desc) from products p), '[]');
end $$;

create or replace function public.list_categories() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('categorias.ver');
  return coalesce((select jsonb_agg(category_json(c) order by c.name) from categories c), '[]');
end $$;

create or replace function public.list_suppliers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('proveedores.ver');
  return coalesce((select jsonb_agg(supplier_json(s) order by s.name) from suppliers s), '[]');
end $$;

create or replace function public.list_seasons() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('temporadas.ver');
  return coalesce((select jsonb_agg(season_json(s) order by s.id) from seasons s), '[]');
end $$;

create or replace function public.list_discounts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('inventario.ver');
  return coalesce((select jsonb_agg(discount_json(d) order by d.created_at desc) from discounts d), '[]');
end $$;

create or replace function public.get_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('inventario.ver');
  return (select settings_json(s) from settings s where id = 1);
end $$;

create or replace function public.list_sales() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('ventas.ver');
  return coalesce((select jsonb_agg(sale_json(s) order by s.at desc) from sales s), '[]');
end $$;

create or replace function public.list_movements(p_product_id text default null, p_days int default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('inventario.ver');
  return coalesce((
    select jsonb_agg(movement_json(m) order by m.date desc) from movements m
    where (p_product_id is null or m.product_id = p_product_id)
      and (p_days is null or m.date >= now() - make_interval(days => p_days))
  ), '[]');
end $$;

create or replace function public.list_audit(p_limit int default 5000) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform req('actividad.ver');
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'at', a.at, 'userId', a.user_id, 'userName', a.user_name, 'action', a.action, 'detail', a.detail) order by a.at desc)
    from (select * from audit order by at desc limit p_limit) a), '[]');
end $$;

/** Catálogo público para la tienda (sin sesión): sin costos, sin proveedores y sin cupones. */
create or replace function public.public_catalog() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'sku', p.sku, 'name', p.name, 'categoryId', p.category_id, 'price', p.price,
      'stock', p.stock, 'ageMin', p.age_min, 'batteries', p.batteries, 'brand', p.brand, 'photos', to_jsonb(p.photos), 'seasons', to_jsonb(p.seasons)) order by p.name)
      from products p where p.stock > 0), '[]'),
    'categories', coalesce((select jsonb_agg(category_json(c) - 'marginTarget' order by c.name) from categories c), '[]'),
    'seasons', coalesce((select jsonb_agg(season_json(s) order by s.id) from seasons s), '[]'),
    'discounts', coalesce((select jsonb_agg(discount_json(d) order by d.created_at desc) from discounts d where d.kind <> 'cupon'), '[]'))
$$;

-- ── Productos ──────────────────────────────────────────────────────────────────

create or replace function public.validate_product(p jsonb) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(trim(p ->> 'sku'), '') = '' then perform api_error(400, 'Falta el código del producto'); end if;
  if coalesce(trim(p ->> 'name'), '') = '' then perform api_error(400, 'Falta el nombre del producto'); end if;
  if not exists (select 1 from categories where id = p ->> 'categoryId') then perform api_error(400, 'La categoría no existe'); end if;
  if (p ->> 'price')::numeric < 0 then perform api_error(400, 'El precio no puede ser negativo'); end if;
  if (p ->> 'stock')::numeric < 0 or (p ->> 'stock')::numeric <> trunc((p ->> 'stock')::numeric) then perform api_error(400, 'La cantidad debe ser un número entero no negativo'); end if;
end $$;

create or replace function public.insert_product(p jsonb, p_note text) returns public.products
language plpgsql security definer set search_path = public as $$
declare
  r products;
begin
  perform validate_product(p);
  if exists (select 1 from products where sku = trim(p ->> 'sku')) then perform api_error(409, 'Ya existe un producto con el código ' || trim(p ->> 'sku')); end if;
  insert into products (id, sku, name, category_id, supplier_id, price, cost, seasons, stock, min_stock, age_min, batteries, brand, photos, lote_id, created_by)
  values (
    coalesce(nullif(p ->> 'id', ''), new_id('prd')), trim(p ->> 'sku'), trim(p ->> 'name'), p ->> 'categoryId', nullif(p ->> 'supplierId', ''),
    (p ->> 'price')::numeric, nullif(p ->> 'cost', '')::numeric,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'seasons', '[]')) x), '{}'),
    (p ->> 'stock')::int, coalesce((p ->> 'minStock')::int, 0), coalesce((p ->> 'ageMin')::int, 0), coalesce((p ->> 'batteries')::boolean, false),
    coalesce(p ->> 'brand', ''), coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'photos', '[]')) x), '{}'),
    nullif(p ->> 'loteId', ''), auth.uid()::text)
  returning * into r;
  insert into movements (product_id, delta, reason, user_id, note) values (r.id, r.stock, 'alta', auth.uid()::text, p_note);
  return r;
end $$;

create or replace function public.product_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r products;
begin
  perform req('productos.crear');
  r := insert_product(p, case when p ->> 'loteId' is not null then 'Carga de productos' end);
  perform touch('products');
  return product_json(r);
end $$;

/** Importación: todo o nada (si una fila falla, la función entera se deshace). */
create or replace function public.product_bulk_create(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  v_out jsonb := '[]';
  r products;
begin
  perform req('productos.importar');
  if (select count(*) from jsonb_array_elements(p_items) x group by x ->> 'sku' having count(*) > 1 limit 1) > 1 then
    perform api_error(409, 'Hay códigos repetidos en el archivo');
  end if;
  for item in select * from jsonb_array_elements(p_items) loop
    r := insert_product(item, 'Importación de archivo');
    v_out := v_out || product_json(r);
  end loop;
  perform log_audit('Importación', jsonb_array_length(p_items) || ' productos desde archivo');
  perform touch('products');
  return v_out;
end $$;

create or replace function public.product_restock(p_id text, p_qty int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r products;
begin
  perform req('productos.reponer');
  if p_qty is null or p_qty <= 0 then perform api_error(400, 'La cantidad debe ser un número entero mayor a 0'); end if;
  update products set stock = stock + p_qty, updated_at = now() where id = p_id returning * into r;
  if r.id is null then perform api_error(404, 'El producto ya no existe'); end if;
  insert into movements (product_id, delta, reason, user_id, note) values (r.id, p_qty, 'ingreso', auth.uid()::text, 'Reposición');
  perform touch('products');
  return product_json(r);
end $$;

/** Edición. Un cambio de stock por esta vía es un ajuste: exige motivo y es solo del dueño. */
create or replace function public.product_update(p_id text, p_patch jsonb, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b products;
  r products;
  v_stock int := (p_patch ->> 'stock')::int;
  v_changes boolean;
begin
  select * into b from products where id = p_id for update;
  if b.id is null then perform api_error(404, 'El producto ya no existe'); end if;
  v_changes := p_patch ? 'stock' and v_stock is distinct from b.stock;
  if v_changes then
    perform req('stock.ajustar');
    if coalesce(trim(p_reason), '') = '' then perform api_error(400, 'Indica el motivo del ajuste de stock'); end if;
    if v_stock < 0 then perform api_error(400, 'El stock debe ser un número entero no negativo'); end if;
  else
    perform req('productos.crear');
  end if;
  if p_patch ? 'sku' and exists (select 1 from products where sku = trim(p_patch ->> 'sku') and id <> p_id) then
    perform api_error(409, 'Ya existe un producto con el código ' || trim(p_patch ->> 'sku'));
  end if;
  if p_patch ? 'categoryId' and not exists (select 1 from categories where id = p_patch ->> 'categoryId') then perform api_error(400, 'La categoría no existe'); end if;

  update products set
    sku = case when p_patch ? 'sku' then trim(p_patch ->> 'sku') else sku end,
    name = case when p_patch ? 'name' then trim(p_patch ->> 'name') else name end,
    category_id = coalesce(p_patch ->> 'categoryId', category_id),
    supplier_id = case when p_patch ? 'supplierId' then nullif(p_patch ->> 'supplierId', '') else supplier_id end,
    price = coalesce((p_patch ->> 'price')::numeric, price),
    -- El costo solo lo cambia quien puede verlo: así un vendedor no lo borra sin querer.
    cost = case when p_patch ? 'cost' and can('costos.ver') then nullif(p_patch ->> 'cost', '')::numeric else cost end,
    seasons = case when p_patch ? 'seasons' then coalesce((select array_agg(x) from jsonb_array_elements_text(p_patch -> 'seasons') x), '{}') else seasons end,
    stock = case when v_changes then v_stock else stock end,
    min_stock = coalesce((p_patch ->> 'minStock')::int, min_stock),
    age_min = coalesce((p_patch ->> 'ageMin')::int, age_min),
    batteries = coalesce((p_patch ->> 'batteries')::boolean, batteries),
    brand = coalesce(p_patch ->> 'brand', brand),
    photos = case when p_patch ? 'photos' then coalesce((select array_agg(x) from jsonb_array_elements_text(p_patch -> 'photos') x), '{}') else photos end,
    updated_at = now()
  where id = p_id returning * into r;

  if v_changes then
    insert into movements (product_id, delta, reason, user_id, note) values (p_id, v_stock - b.stock, 'ajuste', auth.uid()::text, trim(p_reason));
    perform log_audit('Ajuste de stock', b.name || ': ' || b.stock || ' → ' || v_stock || ' (' || case when v_stock > b.stock then '+' else '' end || (v_stock - b.stock) || '). Motivo: ' || trim(p_reason));
  end if;
  if r.price <> b.price then perform log_audit('Cambio de precio', b.name || ': ' || fmt_price(b.price) || ' → ' || fmt_price(r.price)); end if;
  perform touch('products');
  return product_json(r);
end $$;

create or replace function public.product_delete(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p products;
begin
  perform req('productos.eliminar');
  delete from products where id = p_id returning * into p;
  if p.id is not null then
    perform log_audit('Producto eliminado', p.name || ' (' || p.sku || ') con ' || p.stock || ' u en stock');
    perform touch('products');
  end if;
end $$;

/** Deshacer una carga recién hecha: la puede deshacer quien la cargó (hasta 30 min) o el dueño. */
create or replace function public.product_undo_create(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p products;
begin
  perform req('productos.crear');
  select * into p from products where id = p_id;
  if p.id is null then return; end if;
  if not (p.created_by = auth.uid()::text and p.created_at > now() - interval '30 minutes') then perform req('productos.eliminar'); end if;
  delete from movements where product_id = p_id;
  delete from products where id = p_id;
  perform log_audit('Carga deshecha', p.name || ' (' || p.sku || ')');
  perform touch('products');
end $$;

create or replace function public.product_undo_restock(p_id text, p_qty int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r products;
begin
  perform req('productos.reponer');
  update products set stock = greatest(0, stock - p_qty), updated_at = now() where id = p_id returning * into r;
  if r.id is null then perform api_error(404, 'El producto ya no existe'); end if;
  insert into movements (product_id, delta, reason, user_id, note) values (p_id, -p_qty, 'ingreso', auth.uid()::text, 'Reposición deshecha');
  perform log_audit('Reposición deshecha', r.name || ': −' || p_qty || ' u');
  perform touch('products');
  return product_json(r);
end $$;

create or replace function public.product_add_photo(p_id text, p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r products;
begin
  perform req('productos.fotos');
  update products set photos = photos || p_url, updated_at = now() where id = p_id returning * into r;
  if r.id is null then perform api_error(404, 'El producto ya no existe'); end if;
  perform touch('products');
  return product_json(r);
end $$;

-- ── Catálogo ───────────────────────────────────────────────────────────────────

create or replace function public.category_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c categories;
  v_name text := trim(p ->> 'name');
begin
  perform req('categorias.crear');
  if length(coalesce(v_name, '')) < 2 then perform api_error(400, 'El nombre de la categoría es muy corto'); end if;
  if exists (select 1 from categories where lower(name) = lower(v_name)) then perform api_error(409, 'Ya existe la categoría «' || v_name || '»'); end if;
  insert into categories (id, name, color, defaults, margin_target)
  values (coalesce(nullif(p ->> 'id', ''), new_id('cat')), v_name, p ->> 'color', coalesce(p -> 'defaults', '{}'), nullif(p ->> 'marginTarget', '')::numeric)
  returning * into c;
  perform log_audit('Categoría creada', v_name);
  perform touch('categories');
  return category_json(c);
end $$;

create or replace function public.category_update(p_id text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c categories;
begin
  perform req('categorias.editar');
  if p ? 'name' and exists (select 1 from categories where lower(name) = lower(trim(p ->> 'name')) and id <> p_id) then
    perform api_error(409, 'Ya existe la categoría «' || trim(p ->> 'name') || '»');
  end if;
  update categories set
    name = coalesce(trim(p ->> 'name'), name),
    color = coalesce(p ->> 'color', color),
    defaults = coalesce(p -> 'defaults', defaults),
    margin_target = case when p ? 'marginTarget' then nullif(p ->> 'marginTarget', '')::numeric else margin_target end
  where id = p_id returning * into c;
  if c.id is null then perform api_error(404, 'La categoría ya no existe'); end if;
  perform log_audit('Categoría editada', c.name);
  perform touch('categories');
  return category_json(c);
end $$;

create or replace function public.supplier_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s suppliers;
  v_name text := trim(p ->> 'name');
begin
  perform req('proveedores.gestionar');
  if length(coalesce(v_name, '')) < 2 then perform api_error(400, 'Escribe el nombre del proveedor'); end if;
  if exists (select 1 from suppliers where lower(name) = lower(v_name)) then perform api_error(409, 'Ya existe el proveedor «' || v_name || '»'); end if;
  insert into suppliers (id, name, contact, phone, email)
  values (coalesce(nullif(p ->> 'id', ''), new_id('sup')), v_name, coalesce(p ->> 'contact', ''), coalesce(p ->> 'phone', ''), coalesce(p ->> 'email', ''))
  returning * into s;
  perform log_audit('Proveedor creado', v_name);
  perform touch('suppliers');
  return supplier_json(s);
end $$;

create or replace function public.supplier_update(p_id text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s suppliers;
begin
  perform req('proveedores.gestionar');
  update suppliers set
    name = coalesce(trim(p ->> 'name'), name), contact = coalesce(p ->> 'contact', contact),
    phone = coalesce(p ->> 'phone', phone), email = coalesce(p ->> 'email', email)
  where id = p_id returning * into s;
  if s.id is null then perform api_error(404, 'El proveedor ya no existe'); end if;
  perform log_audit('Proveedor editado', s.name);
  perform touch('suppliers');
  return supplier_json(s);
end $$;

create or replace function public.season_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s seasons;
  v_new boolean;
begin
  perform req('temporadas.gestionar');
  if length(coalesce(trim(p ->> 'name'), '')) < 2 then perform api_error(400, 'Escribe el nombre de la temporada'); end if;
  v_new := not exists (select 1 from seasons where id = p ->> 'id');
  insert into seasons (id, name, color, rule, lead_days)
  values (coalesce(nullif(p ->> 'id', ''), new_id('temp')), trim(p ->> 'name'), p ->> 'color', p -> 'rule', coalesce((p ->> 'leadDays')::int, 30))
  on conflict (id) do update set name = excluded.name, color = excluded.color, rule = excluded.rule, lead_days = excluded.lead_days
  returning * into s;
  perform log_audit(case when v_new then 'Temporada creada' else 'Temporada editada' end, s.name);
  perform touch('seasons');
  return season_json(s);
end $$;

-- ── Descuentos ─────────────────────────────────────────────────────────────────

create or replace function public.validate_discount(d jsonb) returns void
language plpgsql immutable as $$
begin
  if coalesce(trim(d ->> 'name'), '') = '' then perform public.api_error(400, 'Ponle un nombre al descuento'); end if;
  if not ((d ->> 'percent')::numeric > 0 and (d ->> 'percent')::numeric <= 90) then perform public.api_error(400, 'El porcentaje debe estar entre 1 y 90'); end if;
  if d ->> 'kind' = 'cupon' and coalesce(d ->> 'code', '') !~* '^[A-Z0-9-]{3,20}$' then perform public.api_error(400, 'El código del cupón: 3 a 20 letras o números, sin espacios'); end if;
  if d ->> 'kind' = 'producto' and jsonb_typeof(d -> 'targetIds') = 'array' and jsonb_array_length(d -> 'targetIds') = 0 then perform public.api_error(400, 'Elige al menos un producto'); end if;
  if d ->> 'kind' <> 'cupon' and coalesce(d ->> 'targetId', '') = '' then perform public.api_error(400, 'Elige a qué aplica el descuento'); end if;
  if d ->> 'startsAt' is not null and d ->> 'endsAt' is not null and (d ->> 'startsAt')::timestamptz > (d ->> 'endsAt')::timestamptz then
    perform public.api_error(400, 'La fecha de fin es anterior a la de inicio');
  end if;
end $$;

create or replace function public.discount_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d discounts;
begin
  perform req('descuentos.gestionar');
  perform validate_discount(p);
  if p ->> 'kind' = 'cupon' and exists (select 1 from discounts where kind = 'cupon' and upper(code) = upper(p ->> 'code')) then
    perform api_error(409, 'Ya existe el cupón ' || upper(p ->> 'code'));
  end if;
  insert into discounts (id, name, kind, target_id, target_ids, code, percent, starts_at, ends_at, active)
  values (coalesce(nullif(p ->> 'id', ''), new_id('dto')), trim(p ->> 'name'), p ->> 'kind', nullif(p ->> 'targetId', ''),
    case when jsonb_typeof(p -> 'targetIds') = 'array' then (select array_agg(x) from jsonb_array_elements_text(p -> 'targetIds') x) end,
    upper(nullif(p ->> 'code', '')), (p ->> 'percent')::numeric, (p ->> 'startsAt')::timestamptz, (p ->> 'endsAt')::timestamptz, coalesce((p ->> 'active')::boolean, true))
  returning * into d;
  perform log_audit('Descuento creado', d.name || ' (' || d.percent || '%)');
  perform touch('discounts');
  return discount_json(d);
end $$;

create or replace function public.discount_update(p_id text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d discounts;
begin
  perform req('descuentos.gestionar');
  select * into d from discounts where id = p_id;
  if d.id is null then perform api_error(404, 'El descuento ya no existe'); end if;
  perform validate_discount(discount_json(d) || p);
  update discounts set
    name = coalesce(trim(p ->> 'name'), name), percent = coalesce((p ->> 'percent')::numeric, percent),
    target_id = case when p ? 'targetId' then nullif(p ->> 'targetId', '') else target_id end,
    starts_at = case when p ? 'startsAt' then (p ->> 'startsAt')::timestamptz else starts_at end,
    ends_at = case when p ? 'endsAt' then (p ->> 'endsAt')::timestamptz else ends_at end,
    active = coalesce((p ->> 'active')::boolean, active)
  where id = p_id returning * into d;
  perform log_audit(case when p ->> 'active' = 'false' then 'Descuento pausado' when p ->> 'active' = 'true' then 'Descuento activado' else 'Descuento editado' end, d.name || ' (' || d.percent || '%)');
  perform touch('discounts');
  return discount_json(d);
end $$;

create or replace function public.discount_delete(p_id text) returns void
language plpgsql security definer set search_path = public as $$
declare
  d discounts;
begin
  perform req('descuentos.gestionar');
  delete from discounts where id = p_id returning * into d;
  if d.id is not null then perform log_audit('Descuento eliminado', d.name); perform touch('discounts'); end if;
end $$;

-- ── Configuración ──────────────────────────────────────────────────────────────

create or replace function public.settings_update(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s settings;
begin
  perform req('ajustes.gestionar');
  update settings set
    fixed_costs = coalesce(p -> 'fixedCosts', fixed_costs), default_margin = coalesce((p ->> 'defaultMargin')::numeric, default_margin),
    iva_rate = coalesce((p ->> 'ivaRate')::numeric, iva_rate), business = coalesce(p -> 'business', business)
  where id = 1 returning * into s;
  perform log_audit('Configuración actualizada', (select string_agg(k, ', ') from jsonb_object_keys(p) k));
  perform touch('settings');
  return settings_json(s);
end $$;

-- ── Ventas ─────────────────────────────────────────────────────────────────────

create or replace function public.discount_live(d public.discounts) returns boolean
language sql stable as $$ select d.active and (d.starts_at is null or d.starts_at <= now()) and (d.ends_at is null or d.ends_at >= now()) $$;

/** La promoción vigente más conveniente para el producto (misma regla que src/lib/pricing.ts). */
create or replace function public.best_discount_percent(p public.products) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(max(d.percent), 0) from discounts d
  where d.kind <> 'cupon' and discount_live(d) and (
    (d.kind = 'producto' and (case when d.target_ids is not null then p.id = any (d.target_ids) else d.target_id = p.id end))
    or (d.kind = 'categoria' and d.target_id = p.category_id)
    or (d.kind = 'temporada' and d.target_id = any (p.seasons)))
$$;

create or replace function public.invoice_label(p_type text, p_number int) returns text
language sql immutable as $$ select case when p_type = 'X' then 'Comprobante X' else 'Factura ' || p_type end || ' 0001-' || lpad(p_number::text, 8, '0') $$;

/**
 * Cobra una venta. Puede llamarla la tienda sin sesión (canal «tienda»). Nunca se confía en
 * los precios de la pantalla: se recalculan acá. Valida stock, descuenta, numera el comprobante,
 * deja movimientos y actividad. Todo o nada.
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
  v_number int;
  v_iva_rate numeric;
  s sales;
  v_doc text := regexp_replace(coalesce(p -> 'customer' ->> 'doc', ''), '\D', '', 'g');
begin
  if p ->> 'channel' = 'mostrador' then perform req('productos.reponer');
  elsif p ->> 'channel' is distinct from 'tienda' then perform api_error(400, 'Canal inválido'); end if;
  if v_type not in ('A', 'B', 'X') then perform api_error(400, 'Tipo de comprobante inválido'); end if;
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

  perform pg_advisory_xact_lock(hashtext('dragotoy_invoice_' || v_type));
  select coalesce(max(number), 0) + 1 into v_number from sales where invoice_type = v_type;
  select iva_rate into v_iva_rate from settings where id = 1;

  insert into sales (id, number, invoice_type, channel, customer, items, subtotal, coupon_code, coupon_percent, discount_total, total, iva, payment_method, test, user_id)
  values (new_id('vta'), v_number, v_type, p ->> 'channel',
    jsonb_build_object('name', trim(p -> 'customer' ->> 'name'), 'email', trim(coalesce(p -> 'customer' ->> 'email', '')),
      'docType', coalesce(p -> 'customer' ->> 'docType', ''), 'doc', coalesce(p -> 'customer' ->> 'doc', '')),
    v_items, v_subtotal, v_coupon.code, v_coupon_pct, round(v_subtotal - v_total, 2), v_total,
    round(v_total - v_total / (1 + v_iva_rate / 100), 2), coalesce(p ->> 'paymentMethod', 'efectivo'), coalesce((p ->> 'test')::boolean, false), auth.uid()::text)
  returning * into s;

  for line in select * from jsonb_array_elements(v_items) loop
    update products set stock = stock - (line ->> 'qty')::int, updated_at = s.at where id = line ->> 'productId';
    insert into movements (product_id, date, delta, reason, user_id, note)
    values (line ->> 'productId', s.at, -(line ->> 'qty')::int, 'venta', s.user_id, invoice_label(s.invoice_type, s.number) || case when s.test then ' (prueba)' else '' end);
  end loop;

  perform log_audit(case when s.test then 'Venta de prueba' else 'Venta' end, invoice_label(s.invoice_type, s.number) || ' · ' || s.channel || ' · ' || fmt_price(s.total));
  perform touch('products');
  perform touch('sales');
  return sale_json(s);
end $$;

/** Anula una venta: devuelve el stock y la conserva marcada como anulada (nunca se borra). */
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

-- ── Primer uso y migración desde el navegador ──────────────────────────────────

/** Configuración inicial: categorías base, temporadas y, si se pide, el catálogo de ejemplo. */
create or replace function public.initialize_store(p_categories jsonb, p_seasons jsonb, p_demo jsonb default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
begin
  perform req('ajustes.gestionar');
  if not exists (select 1 from categories) then
    for x in select * from jsonb_array_elements(p_categories) loop
      insert into categories (id, name, color, defaults, margin_target) values (x ->> 'id', x ->> 'name', x ->> 'color', coalesce(x -> 'defaults', '{}'), nullif(x ->> 'marginTarget', '')::numeric);
    end loop;
  end if;
  if not exists (select 1 from seasons) then
    for x in select * from jsonb_array_elements(p_seasons) loop
      insert into seasons (id, name, color, rule, lead_days) values (x ->> 'id', x ->> 'name', x ->> 'color', x -> 'rule', (x ->> 'leadDays')::int);
    end loop;
  end if;
  if p_demo is not null and not exists (select 1 from products) then
    for x in select * from jsonb_array_elements(p_demo -> 'suppliers') loop
      insert into suppliers (id, name, contact, phone, email) values (x ->> 'id', x ->> 'name', coalesce(x ->> 'contact', ''), coalesce(x ->> 'phone', ''), coalesce(x ->> 'email', '')) on conflict do nothing;
    end loop;
    for x in select * from jsonb_array_elements(p_demo -> 'products') loop
      perform insert_product(x, 'Dato de ejemplo');
    end loop;
    perform log_audit('Datos de ejemplo cargados', jsonb_array_length(p_demo -> 'products') || ' productos de ejemplo');
  end if;
  perform log_audit('Configuración inicial', 'Se creó la tienda');
  perform touch('products');
end $$;

/**
 * Trae los datos guardados en el navegador (la copia de seguridad JSON de la versión anterior).
 * Solo el dueño y solo con la base vacía de productos y ventas, para no duplicar nada.
 * Los usuarios no se copian: cada persona se crea de nuevo con su cuenta.
 */
create or replace function public.import_backup(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  x jsonb;
  n_products int := 0;
  n_sales int := 0;
begin
  perform req('respaldo.gestionar');
  if p ->> 'app' is distinct from 'dragotoy' then perform api_error(400, 'El archivo no es una copia de seguridad de DragoToY'); end if;
  if exists (select 1 from products) or exists (select 1 from sales) then
    perform api_error(409, 'La base en la nube ya tiene productos o ventas. La migración solo se hace una vez, con la base vacía.');
  end if;
  for x in select * from jsonb_array_elements(coalesce(p -> 'categories', '[]')) loop
    insert into categories (id, name, color, defaults, margin_target) values (x ->> 'id', x ->> 'name', x ->> 'color', coalesce(x -> 'defaults', '{}'), nullif(x ->> 'marginTarget', '')::numeric)
    on conflict (id) do update set name = excluded.name, color = excluded.color, defaults = excluded.defaults, margin_target = excluded.margin_target;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'suppliers', '[]')) loop
    insert into suppliers (id, name, contact, phone, email) values (x ->> 'id', x ->> 'name', coalesce(x ->> 'contact', ''), coalesce(x ->> 'phone', ''), coalesce(x ->> 'email', '')) on conflict do nothing;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'seasons', '[]')) loop
    insert into seasons (id, name, color, rule, lead_days) values (x ->> 'id', x ->> 'name', x ->> 'color', x -> 'rule', coalesce((x ->> 'leadDays')::int, 30))
    on conflict (id) do update set name = excluded.name, color = excluded.color, rule = excluded.rule, lead_days = excluded.lead_days;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'products', '[]')) loop
    insert into products (id, sku, name, category_id, supplier_id, price, cost, seasons, stock, min_stock, age_min, batteries, brand, photos, lote_id, created_at, updated_at)
    values (x ->> 'id', x ->> 'sku', x ->> 'name', x ->> 'categoryId', nullif(x ->> 'supplierId', ''), (x ->> 'price')::numeric, nullif(x ->> 'cost', '')::numeric,
      coalesce((select array_agg(v) from jsonb_array_elements_text(coalesce(x -> 'seasons', '[]')) v), '{}'), (x ->> 'stock')::int,
      coalesce((x ->> 'minStock')::int, 0), coalesce((x ->> 'ageMin')::int, 0), coalesce((x ->> 'batteries')::boolean, false), coalesce(x ->> 'brand', ''),
      coalesce((select array_agg(v) from jsonb_array_elements_text(coalesce(x -> 'photos', '[]')) v), '{}'), nullif(x ->> 'loteId', ''),
      coalesce((x ->> 'createdAt')::timestamptz, now()), coalesce((x ->> 'updatedAt')::timestamptz, now()));
    n_products := n_products + 1;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'movements', '[]')) loop
    insert into movements (id, product_id, date, delta, reason, user_id, note) values (x ->> 'id', x ->> 'productId', (x ->> 'date')::timestamptz, (x ->> 'delta')::int, x ->> 'reason', x ->> 'userId', x ->> 'note') on conflict do nothing;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'discounts', '[]')) loop
    insert into discounts (id, name, kind, target_id, target_ids, code, percent, starts_at, ends_at, active, created_at)
    values (x ->> 'id', x ->> 'name', x ->> 'kind', x ->> 'targetId',
      case when jsonb_typeof(x -> 'targetIds') = 'array' then (select array_agg(v) from jsonb_array_elements_text(x -> 'targetIds') v) end,
      x ->> 'code', (x ->> 'percent')::numeric, (x ->> 'startsAt')::timestamptz, (x ->> 'endsAt')::timestamptz, coalesce((x ->> 'active')::boolean, true), coalesce((x ->> 'createdAt')::timestamptz, now()))
    on conflict do nothing;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'sales', '[]')) loop
    insert into sales (id, number, invoice_type, at, channel, customer, items, subtotal, coupon_code, coupon_percent, discount_total, total, iva, payment_method, status, voided_at, void_reason, test, user_id)
    values (x ->> 'id', (x ->> 'number')::int, x ->> 'invoiceType', (x ->> 'at')::timestamptz, x ->> 'channel', x -> 'customer', x -> 'items', (x ->> 'subtotal')::numeric,
      x ->> 'couponCode', coalesce((x ->> 'couponPercent')::numeric, 0), (x ->> 'discountTotal')::numeric, (x ->> 'total')::numeric, (x ->> 'iva')::numeric,
      x ->> 'paymentMethod', coalesce(x ->> 'status', 'completada'), (x ->> 'voidedAt')::timestamptz, x ->> 'voidReason', coalesce((x ->> 'test')::boolean, false), x ->> 'userId');
    n_sales := n_sales + 1;
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p -> 'audit', '[]')) loop
    insert into audit (id, at, user_id, user_name, action, detail) values (x ->> 'id', (x ->> 'at')::timestamptz, x ->> 'userId', coalesce(x ->> 'userName', 'Sistema'), x ->> 'action', coalesce(x ->> 'detail', '')) on conflict do nothing;
  end loop;
  if jsonb_typeof(p -> 'settings') = 'array' and jsonb_array_length(p -> 'settings') > 0 then
    update settings set fixed_costs = coalesce(p -> 'settings' -> 0 -> 'fixedCosts', fixed_costs), default_margin = coalesce((p -> 'settings' -> 0 ->> 'defaultMargin')::numeric, default_margin),
      iva_rate = coalesce((p -> 'settings' -> 0 ->> 'ivaRate')::numeric, iva_rate), business = coalesce(p -> 'settings' -> 0 -> 'business', business) where id = 1;
  end if;
  perform log_audit('Migración a la nube', n_products || ' productos y ' || n_sales || ' ventas desde la copia del navegador');
  perform touch('products');
  perform touch('sales');
  return jsonb_build_object('products', n_products, 'sales', n_sales);
end $$;

-- ── Quién puede llamar a qué ───────────────────────────────────────────────────

-- Por defecto nadie ejecuta nada; se habilita explícitamente lo que la app usa.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.sync_events to authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Sin sesión (tienda y pantalla de ingreso)
grant execute on function public.has_users(), public.username_available(text), public.log_login_failure(text), public.public_catalog(), public.checkout(jsonb) to anon, authenticated;

-- Con sesión (cada función verifica el permiso por dentro)
grant execute on function
  public.register_login(), public.my_profile(), public.register_logout(), public.user_names(), public.list_users(),
  public.admin_approve_user(uuid, text), public.admin_set_active(uuid, boolean), public.admin_set_role(uuid, text), public.admin_set_password(uuid, text),
  public.list_products(), public.list_categories(), public.list_suppliers(), public.list_seasons(), public.list_discounts(), public.get_settings(),
  public.list_sales(), public.list_movements(text, int), public.list_audit(int),
  public.product_create(jsonb), public.product_bulk_create(jsonb), public.product_restock(text, int), public.product_update(text, jsonb, text),
  public.product_delete(text), public.product_undo_create(text), public.product_undo_restock(text, int), public.product_add_photo(text, text),
  public.category_create(jsonb), public.category_update(text, jsonb), public.supplier_create(jsonb), public.supplier_update(text, jsonb),
  public.season_save(jsonb), public.discount_create(jsonb), public.discount_update(text, jsonb), public.discount_delete(text),
  public.settings_update(jsonb), public.sale_void(text, text), public.initialize_store(jsonb, jsonb, jsonb), public.import_backup(jsonb)
to authenticated;

-- Realtime: las pantallas abiertas se enteran de cambios por esta tabla.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'sync_events') then
    alter publication supabase_realtime add table public.sync_events;
  end if;
end $$;
