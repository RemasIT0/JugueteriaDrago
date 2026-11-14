-- Cambia el acceso de la cuenta del dueño a:  usuario «admin»  ·  contraseña «admin123»
-- Uso: Supabase → SQL Editor → pegar todo → Run. Se corre una sola vez (no es una migración).
--
-- Toca la cuenta de dueño más antigua (la que se creó al configurar el sistema).
-- La app arma el correo interno de Supabase Auth a partir del usuario: «admin» → u61646d696e@usuarios.dragotoy.app
-- (ver emailFor en src/services/supabase.ts), así que también se actualiza ese correo.

do $$
declare
  v_id uuid;
  v_email constant text := 'u61646d696e@usuarios.dragotoy.app';
begin
  select id into v_id from public.profiles where role = 'dueno' order by created_at limit 1;
  if v_id is null then
    raise exception 'No hay ninguna cuenta de dueño. Abre la app y crea la cuenta inicial con usuario admin y contraseña admin123.';
  end if;
  if exists (select 1 from public.profiles where username = 'admin' and id <> v_id) then
    raise exception 'Ya existe otro usuario llamado «admin». Cámbiale el nombre o desactívalo antes de correr esto.';
  end if;

  update public.profiles set username = 'admin' where id = v_id;

  update auth.users
     set email = v_email,
         encrypted_password = extensions.crypt('admin123', extensions.gen_salt('bf')),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', 'admin'),
         updated_at = now()
   where id = v_id;

  update auth.identities
     set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', v_email),
         updated_at = now()
   where user_id = v_id and provider = 'email';

  raise notice 'Listo: ahora se entra con usuario admin y contraseña admin123.';
end $$;
