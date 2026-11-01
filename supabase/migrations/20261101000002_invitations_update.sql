-- F01: Securizare UPDATE invitații împotriva escaladării rolului și prelungirii termenului.
-- Politica RLS și trigger-ul asigură că UPDATE-ul poate fi folosit strict pentru revocare (revoked_at),
-- iar câmpurile de identitate, rol, token, email și expirare sunt imuabile.

create or replace function public.check_invitation_update()
returns trigger as $$
begin
  if new.id <> old.id
     or new.household_id <> old.household_id
     or new.token <> old.token
     or new.role <> old.role
     or new.email is distinct from old.email
     or new.created_by <> old.created_by
     or new.created_at <> old.created_at
     or new.expires_at <> old.expires_at
     or new.accepted_at is distinct from old.accepted_at
     or new.accepted_by is distinct from old.accepted_by then
    raise exception 'Modificarea câmpurilor de identitate, rol sau expirare ale invitației este interzisă.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists tr_protect_household_invitations on public.household_invitations;
create trigger tr_protect_household_invitations
  before update on public.household_invitations
  for each row execute function public.check_invitation_update();

drop policy if exists "administratorii revocă" on public.household_invitations;
create policy "administratorii revocă" on public.household_invitations for update to authenticated
  using (public.is_household_admin(household_id) and accepted_at is null)
  with check (
    public.is_household_admin(household_id)
    and accepted_at is null
    and revoked_at is not null
  );

