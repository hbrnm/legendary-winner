-- Fotografiile gospodăriei la rețete (.tasks/008, etapa 3). Rândul ține
-- metadatele; fișierul stă în bucketul privat `recipe-photos`, la calea
-- `{household_id}/{recipe_id}/{id}.webp` (sau `.jpg`). Le văd doar membrii.

create table public.recipe_photos (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  -- Rețetă globală sau a aceleiași gospodării (check_household_refs).
  recipe_id text not null references public.recipes (id) on delete cascade,
  -- Calea e legată de rând: o fotografie nu poate arăta spre fișierul altei gospodării.
  storage_path text not null check (
    storage_path in (household_id::text || '/' || recipe_id || '/' || id::text || '.webp',
                     household_id::text || '/' || recipe_id || '/' || id::text || '.jpg')
  ),
  width integer not null check (width between 1 and 1280),
  height integer not null check (height between 1 and 1280),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- Cel mult o fotografie activă pe gospodărie și rețetă.
create unique index recipe_photos_active on public.recipe_photos (household_id, recipe_id) where deleted_at is null;
create index recipe_photos_household on public.recipe_photos (household_id, updated_at);

create trigger touch_updated_at before insert or update on public.recipe_photos
  for each row execute function public.touch_updated_at();
create trigger keep_household_id before update on public.recipe_photos
  for each row execute function public.keep_household_id();
create trigger check_refs before insert or update on public.recipe_photos
  for each row execute function public.check_household_refs('recipe_id', 'recipes');

-- Fără politică DELETE: ștergerea e logică (deleted_at).
alter table public.recipe_photos enable row level security;
create policy "citire" on public.recipe_photos for select to authenticated using (public.is_member(household_id));
create policy "adăugare" on public.recipe_photos for insert to authenticated with check (public.is_member(household_id));
create policy "modificare" on public.recipe_photos for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
-- Supabase dă implicit toate drepturile pe tabelele noi; le restrângem.
revoke all on public.recipe_photos from anon;
revoke delete, truncate on public.recipe_photos from authenticated;
grant select, insert, update on public.recipe_photos to authenticated;

alter publication supabase_realtime add table public.recipe_photos;

-- ---------------------------------------------------------------------------
-- Storage: bucket privat și politicile pe fișiere
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', false, 1048576, array['image/webp', 'image/jpeg'])
-- Dacă bucketul există deja (creat de mână), îl aducem la aceste setări.
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Gospodăria din calea fișierului (primul segment). NULL dacă nu e un uuid;
-- politicile folosesc is_member, iar is_member(NULL) e fals (nu can_read,
-- unde NULL ar însemna „catalog global”, vizibil tuturor).
create or replace function public.photo_household(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then split_part(p_name, '/', 1)::uuid end;
$$;
revoke execute on function public.photo_household(text) from public, anon;
grant execute on function public.photo_household(text) to authenticated;

-- Ștergerea fișierului e permisă: se face după sincronizarea ștergerii logice.
create policy "fotografii rețete: citire" on storage.objects for select to authenticated
  using (bucket_id = 'recipe-photos' and public.is_member(public.photo_household(name)));
create policy "fotografii rețete: încărcare" on storage.objects for insert to authenticated
  with check (bucket_id = 'recipe-photos' and public.is_member(public.photo_household(name)));
create policy "fotografii rețete: înlocuire" on storage.objects for update to authenticated
  using (bucket_id = 'recipe-photos' and public.is_member(public.photo_household(name)))
  with check (bucket_id = 'recipe-photos' and public.is_member(public.photo_household(name)));
create policy "fotografii rețete: ștergere" on storage.objects for delete to authenticated
  using (bucket_id = 'recipe-photos' and public.is_member(public.photo_household(name)));
