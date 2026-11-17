-- Cămara: aplicați o singură dată în SQL Editor pentru proiectul wvgmwpvivospyetpznzv.
-- Cele două migrații se aplică atomic; în caz de eroare nu se păstrează schimbări parțiale.
begin;

-- Nullable additions preserve old clients and existing receipt/expense rows.
alter table public.shopping_transactions
  add column declared_total numeric(12,2) check (declared_total >= 0 and declared_total <= 9999999.99),
  add column retailer_id text references public.retailers(id);

alter table public.manual_expenses
  add column place_name text check (char_length(btrim(place_name)) between 1 and 120),
  add column retailer_id text references public.retailers(id),
  add column source text check (source in ('supermarket','piata','producator','alta')),
  add column note text check (char_length(note) <= 500);

-- Existing membership RLS still applies; reject references to other households.
create trigger capture_place_refs before insert or update on public.shopping_transactions
  for each row execute function public.check_household_refs('retailer_id', 'retailers');
create trigger capture_place_refs before insert or update on public.manual_expenses
  for each row execute function public.check_household_refs('retailer_id', 'retailers');

-- Explicit household/editor tag only. Existing recipes keep their categories.
alter table public.recipes drop constraint recipes_categories_check;
alter table public.recipes add constraint recipes_categories_check check (
  categories <@ array[
    'mic_dejun','pranz','cina','gustari','supe_ciorbe','traditionale',
    'carne','peste','vegetariene','de_post','salate','deserturi','rapide','meal_prep'
  ]::text[]
);

notify pgrst, 'reload schema';
commit;
