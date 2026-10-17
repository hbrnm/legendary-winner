-- Traducerea rețetelor importate (.tasks/012, etapa 1): limita de cereri pentru
-- funcția Edge `translate-recipe`, în același tabel cu importul, despărțite după `kind`.

alter table public.recipe_import_requests add column kind text not null default 'import'
  check (kind in ('import', 'translate'));
drop index public.recipe_import_requests_user;
create index recipe_import_requests_user on public.recipe_import_requests (user_id, kind, created_at);

-- Limita comună: 20 de cereri pe oră de om și de fel. Nu se cheamă prin API,
-- doar din funcțiile de mai jos (care rulează ca proprietarul lor).
create or replace function public.take_recipe_request_quota(p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  recent integer;
begin
  if uid is null then
    raise exception 'neautentificat' using errcode = '42501';
  end if;
  -- Două cereri simultane ale aceluiași om nu trec amândouă de limită.
  perform pg_advisory_xact_lock(hashtextextended('recipe_' || p_kind || ':' || uid::text, 0));
  delete from public.recipe_import_requests where user_id = uid and kind = p_kind and created_at < now() - interval '1 day';
  select count(*) into recent from public.recipe_import_requests
    where user_id = uid and kind = p_kind and created_at > now() - interval '1 hour';
  if recent >= 20 then
    return false;
  end if;
  insert into public.recipe_import_requests (user_id, kind) values (uid, p_kind);
  return true;
end;
$$;
revoke execute on function public.take_recipe_request_quota(text) from public, anon, authenticated;

-- Importul păstrează aceeași funcție (și aceeași limită), acum doar pentru importuri.
create or replace function public.take_recipe_import_quota() returns boolean
language sql security definer set search_path = '' as $$
  select public.take_recipe_request_quota('import');
$$;
revoke execute on function public.take_recipe_import_quota() from public, anon;
grant execute on function public.take_recipe_import_quota() to authenticated;

-- Funcția Edge `translate-recipe` o cheamă cu tokenul omului, înainte de model.
create or replace function public.take_recipe_translate_quota() returns boolean
language sql security definer set search_path = '' as $$
  select public.take_recipe_request_quota('translate');
$$;
revoke execute on function public.take_recipe_translate_quota() from public, anon;
grant execute on function public.take_recipe_translate_quota() to authenticated;
