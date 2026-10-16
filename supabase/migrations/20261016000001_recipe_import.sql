-- Importul rețetelor (.tasks/009, etapa 2): sursa rețetei importate și
-- limita de cereri pentru funcția Edge `import-recipe`.

-- De unde vine rețeta importată (pagina de pe site), afișată pe rețetă.
alter table public.recipes add column source_url text
  check (source_url is null or (source_url ~ '^https://' and char_length(source_url) <= 500));

-- Cererile de import ale fiecărui om, pentru limita de cereri. Le scrie doar
-- take_recipe_import_quota(); nimeni nu le citește prin API.
create table public.recipe_import_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index recipe_import_requests_user on public.recipe_import_requests (user_id, created_at);

alter table public.recipe_import_requests enable row level security;
revoke all on public.recipe_import_requests from public, anon, authenticated;

-- Funcția Edge o cheamă cu tokenul omului, înainte să descarce pagina:
-- true dacă mai are voie (și notează cererea), false peste 20 de cereri pe oră.
create or replace function public.take_recipe_import_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  recent integer;
begin
  if uid is null then
    raise exception 'neautentificat' using errcode = '42501';
  end if;
  -- Două cereri simultane ale aceluiași om nu trec amândouă de limită.
  perform pg_advisory_xact_lock(hashtextextended('recipe_import:' || uid::text, 0));
  delete from public.recipe_import_requests where user_id = uid and created_at < now() - interval '1 day';
  select count(*) into recent from public.recipe_import_requests
    where user_id = uid and created_at > now() - interval '1 hour';
  if recent >= 20 then
    return false;
  end if;
  insert into public.recipe_import_requests (user_id) values (uid);
  return true;
end;
$$;
revoke execute on function public.take_recipe_import_quota() from public, anon;
grant execute on function public.take_recipe_import_quota() to authenticated;
