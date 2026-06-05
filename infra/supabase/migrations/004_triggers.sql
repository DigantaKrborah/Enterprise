-- Auto-create public.users profile when auth.users record is created.
-- Reads role + department_id + full_name from user metadata set during invite.

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
declare
  dept_id uuid;
begin
  -- resolve department by name if passed as text
  if new.raw_user_meta_data->>'department_id' is not null then
    dept_id := (new.raw_user_meta_data->>'department_id')::uuid;
  end if;

  insert into public.users (id, email, full_name, role, department_id, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'employee')::user_role,
    dept_id,
    true
  )
  on conflict (id) do update set
    email     = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    role      = coalesce(excluded.role,      public.users.role),
    is_active = true;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
