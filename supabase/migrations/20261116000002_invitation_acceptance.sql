-- Protecția de UPDATE a invitațiilor trebuie să permită funcției de
-- acceptare (SECURITY DEFINER) să marcheze acceptarea, păstrând interdicția
-- pentru UPDATE-urile directe ale rolului authenticated.
create or replace function public.check_invitation_update()
returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if new.id <> old.id
     or new.household_id <> old.household_id
     or new.token <> old.token
     or new.role <> old.role
     or new.email is distinct from old.email
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at
     or new.expires_at <> old.expires_at then
    raise exception 'Modificarea câmpurilor de identitate, rol sau expirare ale invitației este interzisă.';
  end if;

  if (new.accepted_at is distinct from old.accepted_at or new.accepted_by is distinct from old.accepted_by)
     and current_user <> (
       select pg_catalog.pg_get_userbyid(p.proowner)
       from pg_catalog.pg_proc p
       where p.oid = 'public.accept_invitation(text)'::pg_catalog.regprocedure
     ) then
    raise exception 'Modificarea câmpurilor de acceptare ale invitației este interzisă.';
  end if;
  return new;
end;
$$;

-- Funcție de trigger, nu RPC public. Revocarea nu afectează execuția triggerului.
revoke execute on function public.check_invitation_update() from public, anon, authenticated;
