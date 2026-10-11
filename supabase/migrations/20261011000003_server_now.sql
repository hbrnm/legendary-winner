-- Ora serverului, pentru sincronizare (.tasks/003). Rândurile cu updated_at
-- mai vechi decât această oră minus 30 s sunt deja confirmate, deci tragerea
-- următoare poate porni strict după ultimul rând citit, fără să le re-citească.
create or replace function public.server_now() returns timestamptz
language sql stable set search_path = '' as $$ select now() $$;

revoke execute on function public.server_now() from public, anon;
grant execute on function public.server_now() to authenticated;
