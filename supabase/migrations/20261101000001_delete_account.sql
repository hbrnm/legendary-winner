-- Cămara — Ștergerea contului de utilizator (GDPR Art. 17 / Ghidurile App Store).
--
-- Un utilizator autentificat își poate șterge definitiv contul.
-- Reguli:
-- 1. Dacă utilizatorul este proprietar într-o gospodărie cu mai mulți membri,
--    este refuzată ștergerea până când transferă proprietatea către un alt membru.
-- 2. Dacă este singurul membru într-o gospodărie deținută, gospodăria este ștearsă
--    complet (cascade pe toate tabelele asociate și curățarea fișierelor storage).
-- 3. Dacă este doar membru/admin în alte gospodării, este eliminat din ele.
-- 4. Profilul, preferințele și contul auth.users sunt șterse definitiv.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  h record;
begin
  if uid is null then
    raise exception 'Trebuie să fii autentificat' using errcode = '42501';
  end if;

  -- 1. Verificăm dacă utilizatorul este owner într-o gospodărie cu mai mulți membri
  for h in
    select hm.household_id, h.name
    from household_members hm
    join households h on h.id = hm.household_id
    where hm.user_id = uid and hm.role = 'owner'
  loop
    if (select count(*) from household_members where household_id = h.household_id) > 1 then
      raise exception 'Ești proprietarul gospodăriei „%”. Transferă dreptul de proprietate către alt membru înainte de a-ți șterge contul.', h.name
        using errcode = '22023';
    end if;

    -- Dacă e singurul membru, curățăm fișierele din storage aferente gospodăriei
    delete from storage.objects where bucket_id = 'recipe-photos' and name like (h.household_id::text || '/%');

    -- Ștergem gospodăria complet (toate tabelele copil sunt legate cu ON DELETE CASCADE)
    delete from public.households where id = h.household_id;
  end loop;

  -- 2. Ștergem calitatea de membru din orice altă gospodărie
  delete from public.household_members where user_id = uid;

  -- 3. Ștergem preferințele și profilul
  delete from public.user_preferences where user_id = uid;
  delete from public.profiles where id = uid;

  -- 4. Ștergem utilizatorul din auth.users
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
