-- 0007 · Rol «Admin»
-- Un rol superior a «Dueño», de una sola cuenta: la que creó el sistema.
--   · Puede todo (todos los permisos de la matriz, sin excepción).
--   · Nadie le puede cambiar el rol, desactivarla ni cambiarle la contraseña (solo ella misma).
--   · El rol Admin no se puede asignar a otra cuenta.
-- Dueño y Vendedor quedan igual. No borra datos.
-- Pegar entero en Supabase → SQL Editor → Run (después de 0001 a 0006).

-- 1) El rol nuevo en la tabla de perfiles.
--    (se borra la regla vieja de roles sea cual sea su nombre)
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'dueno', 'vendedor'));

-- 2) Las tiendas que ya existen: el dueño más antiguo pasa a ser el Admin.
update public.profiles set role = 'admin', active = true, approved = true
where id = (select id from public.profiles where role = 'dueno' order by created_at limit 1)
  and not exists (select 1 from public.profiles where role = 'admin');

-- 3) El Admin tiene todos los permisos; el resto, según la matriz de siempre.
create or replace function public.can(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin' or public.my_role() = any (public.perm_roles(p)), false)
$$;

-- 4) Para «debe quedar al menos un dueño activo», el Admin cuenta como dueño.
create or replace function public.active_owners(except_id uuid default null) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from profiles where role in ('admin', 'dueno') and active and approved and id is distinct from except_id
$$;

-- 5) En una instalación nueva, la primera cuenta es el Admin.
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
    case when v_first then 'admin' else 'vendedor' end,
    v_first,
    v_first
  );
  return new;
end $$;

-- 6) Habilitar una cuenta: nunca como Admin, y nunca sobre el Admin.
create or replace function public.admin_approve_user(p_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u profiles;
begin
  perform req('usuarios.gestionar');
  if p_role not in ('dueno', 'vendedor') then perform api_error(400, 'Rol inválido'); end if;
  if exists (select 1 from profiles where id = p_id and role = 'admin') then perform api_error(400, 'Al Admin no se le puede cambiar el rol.'); end if;
  update profiles set role = p_role, active = true, approved = true where id = p_id returning * into u;
  if u.id is null then perform api_error(404, 'El usuario ya no existe'); end if;
  perform log_audit('Usuario creado', '«' || u.username || '» como ' || case p_role when 'dueno' then 'Dueño' else 'Vendedor' end);
  return profile_json(u);
end $$;

-- 7) Desactivar: el Admin no se puede desactivar.
create or replace function public.admin_set_active(p_id uuid, p_active boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u profiles;
begin
  perform req('usuarios.gestionar');
  select * into u from profiles where id = p_id;
  if u.id is null then perform api_error(404, 'El usuario ya no existe'); end if;
  if p_id = auth.uid() then perform api_error(400, 'No puedes desactivar tu propio usuario.'); end if;
  if u.role = 'admin' then perform api_error(400, 'El Admin no se puede desactivar.'); end if;
  if not p_active and u.role = 'dueno' and active_owners(p_id) < 1 then perform api_error(400, 'Debe quedar al menos un dueño activo.'); end if;
  update profiles set active = p_active, approved = approved or p_active where id = p_id returning * into u;
  perform log_audit(case when p_active then 'Usuario reactivado' else 'Usuario desactivado' end, '«' || u.username || '»');
  return profile_json(u);
end $$;

-- 8) Cambiar el rol: al Admin no se le cambia, y el rol Admin no se asigna.
create or replace function public.admin_set_role(p_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u profiles;
begin
  perform req('usuarios.gestionar');
  if p_role not in ('dueno', 'vendedor') then perform api_error(400, 'El rol Admin no se puede asignar.'); end if;
  select * into u from profiles where id = p_id;
  if u.id is null then perform api_error(404, 'El usuario ya no existe'); end if;
  if u.role = 'admin' then perform api_error(400, 'Al Admin no se le puede cambiar el rol.'); end if;
  if u.role = 'dueno' and p_role <> 'dueno' and active_owners(p_id) < 1 then perform api_error(400, 'Debe quedar al menos un dueño activo.'); end if;
  update profiles set role = p_role where id = p_id returning * into u;
  perform log_audit('Cambio de rol', '«' || u.username || '» → ' || case p_role when 'dueno' then 'Dueño' else 'Vendedor' end);
  return profile_json(u);
end $$;

-- 9) Contraseña de otro usuario: la del Admin solo la cambia el Admin.
create or replace function public.admin_set_password(p_id uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_problem text := password_problem(p_password);
  v_username text;
  v_role text;
begin
  perform req('usuarios.gestionar');
  if v_problem is not null then perform api_error(400, v_problem); end if;
  select username, role into v_username, v_role from profiles where id = p_id;
  if v_username is null then perform api_error(404, 'El usuario ya no existe'); end if;
  if v_role = 'admin' and p_id <> auth.uid() then perform api_error(403, 'La contraseña del Admin solo la puede cambiar el Admin.'); end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  perform log_audit('Contraseña restablecida', '«' || v_username || '»');
end $$;
