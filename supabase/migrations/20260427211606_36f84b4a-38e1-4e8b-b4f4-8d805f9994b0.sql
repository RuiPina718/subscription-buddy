
-- Fix search_path on set_updated_at and restrict execute
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- handle_new_user must remain SECURITY DEFINER (writes to public.profiles from auth trigger)
-- but we lock down EXECUTE to only the supabase_auth_admin role
revoke execute on function public.handle_new_user() from public, anon, authenticated;
