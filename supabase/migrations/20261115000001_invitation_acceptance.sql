-- F01: Protecția UPDATE nu trebuie să blocheze acceptarea prin RPC-ul autorizat.
-- SECURITY INVOKER păstrează distincția dintre clientul PostgREST și proprietarul
-- funcției SECURITY DEFINER accept_invitation, care validează tokenul și destinatarul.
create or replace function public.check_invitation_update()
returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = (
    select pg_catalog.pg_get_userbyid(p.proowner)
    from pg_catalog.pg_proc p
    where p.oid = 'public.accept_invitation(text)'::pg_catalog.regprocedure
  ) then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.household_id is distinct from old.household_id
     or new.token is distinct from old.token
     or new.role is distinct from old.role
     or new.email is distinct from old.email
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at
     or new.accepted_at is distinct from old.accepted_at
     or new.accepted_by is distinct from old.accepted_by then
    raise exception 'Modificarea câmpurilor de identitate, rol sau expirare ale invitației este interzisă.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- Funcția de trigger nu este un RPC accesibil clienților.
revoke execute on function public.check_invitation_update() from public, anon, authenticated;
