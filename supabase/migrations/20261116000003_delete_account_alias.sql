-- Evită coliziunea dintre variabila record și aliasul SQL `h` din funcția
-- inițială. Regulile de autorizare și de ștergere rămân aceleași.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  owned_household record;
begin
  if uid is null then
    raise exception 'Trebuie să fii autentificat' using errcode = '42501';
  end if;
  for owned_household in
    select hm.household_id, household_row.name
    from household_members hm
    join households household_row on household_row.id = hm.household_id
    where hm.user_id = uid and hm.role = 'owner'
  loop
    if (select count(*) from household_members where household_id = owned_household.household_id) > 1 then
      raise exception 'Ești proprietarul gospodăriei „%”. Transferă dreptul de proprietate către alt membru înainte de a-ți șterge contul.', owned_household.name
        using errcode = '22023';
    end if;
    delete from storage.objects where bucket_id = 'recipe-photos' and name like (owned_household.household_id::text || '/%');
    delete from public.households where id = owned_household.household_id;
  end loop;
  delete from public.household_members where user_id = uid;
  delete from public.user_preferences where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
