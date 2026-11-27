revoke update on public.household_members from public, anon, authenticated;
grant update (role) on public.household_members to authenticated;

-- Coordonează scrierile Storage cu lock-ul folosit la ștergerea contului.
create function public.can_write_recipe_photo(object_name text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  hid uuid := public.photo_household(object_name);
begin
  if not public.is_member(hid) then return false; end if;
  perform 1 from public.households where id = hid for key share;
  return found and public.is_member(hid);
end;
$$;
revoke execute on function public.can_write_recipe_photo(text) from public, anon;
grant execute on function public.can_write_recipe_photo(text) to authenticated;

alter policy "fotografii rețete: încărcare" on storage.objects
  with check (bucket_id = 'recipe-photos' and public.can_write_recipe_photo(name));
alter policy "fotografii rețete: înlocuire" on storage.objects
  with check (bucket_id = 'recipe-photos' and public.can_write_recipe_photo(name));

-- Verifică toate gospodăriile înainte ca aplicația să șteargă vreun obiect.
create function public.account_deletion_photo_paths() returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  shared_household text;
begin
  if uid is null then
    raise exception 'Trebuie să fii autentificat' using errcode = '42501';
  end if;

  select h.name into shared_household
  from public.household_members m
  join public.households h on h.id = m.household_id
  where m.user_id = uid and m.role = 'owner'
    and exists (
      select 1 from public.household_members other
      where other.household_id = m.household_id and other.user_id <> uid
    )
  order by h.id limit 1;
  if found then
    raise exception 'Ești proprietarul gospodăriei „%”. Transferă dreptul de proprietate către alt membru înainte de a-ți șterge contul.', shared_household
      using errcode = '22023';
  end if;

  return array(
    select o.name
    from storage.objects o
    join public.household_members m on m.household_id = public.photo_household(o.name)
    where o.bucket_id = 'recipe-photos' and m.user_id = uid and m.role = 'owner'
    order by o.name limit 100
  );
end;
$$;
revoke execute on function public.account_deletion_photo_paths() from public, anon;
grant execute on function public.account_deletion_photo_paths() to authenticated;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  perform h.id
  from public.households h
  join public.household_members m on m.household_id = h.id
  where m.user_id = uid and m.role = 'owner'
  order by h.id
  for update of h, m;

  if cardinality(public.account_deletion_photo_paths()) > 0 then
    raise exception 'Fotografiile trebuie eliminate prin Storage înainte de ștergerea contului.'
      using errcode = '22023';
  end if;

  delete from public.households h
  using public.household_members m
  where h.id = m.household_id and m.user_id = uid and m.role = 'owner';
  delete from public.household_members where user_id = uid;
  delete from public.user_preferences where user_id = uid;
  delete from public.profiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

alter table public.recipe_import_requests drop constraint recipe_import_requests_kind_check;
alter table public.recipe_import_requests add constraint recipe_import_requests_kind_check
  check (kind in ('import', 'translate', 'receipt', 'nutrition'));
create index recipe_import_requests_kind_time on public.recipe_import_requests (kind, created_at);

create function public.take_nutrition_lookup_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  checked_at timestamptz;
begin
  if uid is null then
    raise exception 'neautentificat' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('nutrition_lookup_global', 0));
  checked_at := clock_timestamp();
  delete from public.recipe_import_requests
    where kind = 'nutrition' and created_at <= checked_at - interval '1 minute';
  if exists (
    select 1 from public.recipe_import_requests
    where kind = 'nutrition' and user_id = uid and created_at > checked_at - interval '4.1 seconds'
  ) or (select count(*) from public.recipe_import_requests where kind = 'nutrition') >= 90 then
    return false;
  end if;
  insert into public.recipe_import_requests (user_id, kind, created_at)
    values (uid, 'nutrition', checked_at);
  return true;
end;
$$;
revoke execute on function public.take_nutrition_lookup_quota() from public, anon;
grant execute on function public.take_nutrition_lookup_quota() to authenticated;
