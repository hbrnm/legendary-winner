-- Cămara — schema inițială.
--
-- Principii:
-- * Fiecare rând de date aparține unei gospodării (household_id). Datele de
--   referință globale (catalogul) au household_id NULL și pot fi modificate
--   doar de administratorii aplicației.
-- * Accesul e controlat prin RLS: un utilizator vede și modifică doar
--   rândurile gospodăriilor din care face parte.
-- * Rândurile nu se șterg fizic de către client: se marchează cu deleted_at,
--   ca ștergerea să ajungă la toate dispozitivele (sincronizare).
-- * updated_at e setat de server la fiecare scriere și e cursorul de
--   sincronizare.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Funcții utilitare
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- household_id nu se poate muta după creare (un rând nu „sare” în altă gospodărie).
create or replace function public.keep_household_id() returns trigger
language plpgsql as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id nu poate fi modificat' using errcode = '42501';
  end if;
  return new;
end $$;

-- Verifică faptul că un rând referit (produs, categorie, magazin...) e global
-- sau aparține aceleiași gospodării. Argumente: perechi (coloană, tabel).
-- Cu sufixul ':strict' pe tabel, referința trebuie să fie din exact aceeași
-- gospodărie (ex. ingredientele unei rețete).
create or replace function public.check_household_refs() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  i int := 0;
  col text;
  ref_table text;
  is_strict boolean;
  ref_value text;
  ref_household uuid;
  found_row boolean;
  row_json jsonb := to_jsonb(new);
begin
  while i < tg_nargs loop
    col := tg_argv[i];
    ref_table := split_part(tg_argv[i + 1], ':', 1);
    is_strict := split_part(tg_argv[i + 1], ':', 2) = 'strict';
    ref_value := row_json ->> col;
    if ref_value is not null then
      execute format('select household_id, true from public.%I where id::text = $1', ref_table)
        into ref_household, found_row using ref_value;
      if found_row is null then
        raise exception 'Referință inexistentă: %.%', ref_table, ref_value using errcode = '23503';
      end if;
      if is_strict then
        if ref_household is distinct from new.household_id then
          raise exception 'Referință din altă gospodărie: %', col using errcode = '42501';
        end if;
      elsif ref_household is not null and ref_household is distinct from new.household_id then
        raise exception 'Referință din altă gospodărie: %', col using errcode = '42501';
      end if;
    end if;
    i := i + 2;
  end loop;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Utilizatori, gospodării, membri
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Utilizator'), 60)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create unique index household_one_owner on public.household_members (household_id) where role = 'owner';
create index household_members_user on public.household_members (user_id);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  role text not null default 'member' check (role in ('admin', 'member')),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_by uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index household_invitations_household on public.household_invitations (household_id, created_at);

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  active_household_id uuid references public.households (id) on delete set null,
  theme text not null default 'sistem' check (theme in ('sistem', 'luminos', 'intunecat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Funcții de autorizare. SECURITY DEFINER ca să nu intre în recursie cu RLS
-- pe household_members.
create or replace function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

create or replace function public.member_role(hid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from household_members where household_id = hid and user_id = auth.uid();
$$;

create or replace function public.is_household_admin(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(hid) in ('owner', 'admin'), false);
$$;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_admins where user_id = auth.uid());
$$;

-- Poate scrie rândul? Global: doar administratorii aplicației. Al gospodăriei: membrii.
create or replace function public.can_write(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when hid is null then public.is_app_admin() else public.is_member(hid) end;
$$;

create or replace function public.can_read(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select hid is null or public.is_member(hid);
$$;

-- ---------------------------------------------------------------------------
-- Date de referință
-- ---------------------------------------------------------------------------

create table public.units (
  code text primary key,
  singular text not null,
  plural text not null,
  dimension text not null,
  factor numeric not null check (factor > 0)
);

insert into public.units (code, singular, plural, dimension, factor) values
  ('g', 'g', 'g', 'masa', 1),
  ('kg', 'kg', 'kg', 'masa', 1000),
  ('ml', 'ml', 'ml', 'volum', 1),
  ('l', 'l', 'l', 'volum', 1000),
  ('lingura', 'lingură', 'linguri', 'volum', 15),
  ('lingurita', 'linguriță', 'lingurițe', 'volum', 5),
  ('cana', 'cană', 'căni', 'volum', 250),
  ('buc', 'buc', 'buc', 'bucata', 1),
  ('legatura', 'legătură', 'legături', 'legatura', 1),
  ('caserola', 'caserolă', 'caserole', 'caserola', 1),
  ('borcan', 'borcan', 'borcane', 'borcan', 1),
  ('punga', 'pungă', 'pungi', 'punga', 1),
  ('pachet', 'pachet', 'pachete', 'pachet', 1),
  ('sticla', 'sticlă', 'sticle', 'sticla', 1),
  ('cutie', 'cutie', 'cutii', 'cutie', 1),
  ('conserva', 'conservă', 'conserve', 'conserva', 1),
  ('plic', 'plic', 'plicuri', 'plic', 1),
  ('rola', 'rolă', 'role', 'rola', 1),
  ('catel', 'cățel', 'căței', 'catel', 1),
  ('felie', 'felie', 'felii', 'felie', 1);

-- Identificatorii textuali: slug-uri pentru catalog („ardei-kapia”) sau UUID-uri
-- generate de client pentru rândurile gospodăriei.
create domain public.text_id as text check (value ~ '^[a-z0-9][a-z0-9:-]{0,79}$');

create table public.product_categories (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'tag' check (char_length(icon) <= 40),
  sort_order integer not null default 100,
  is_food boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.brands (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.products (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category_id text not null references public.product_categories (id),
  subcategory text check (char_length(subcategory) <= 60),
  default_unit text not null references public.units (code),
  brand_id text references public.brands (id),
  ean text check (ean ~ '^(\d{8}|\d{12,14})$'),
  season_months smallint[] not null default '{}' check (season_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  is_traditional boolean not null default false,
  is_market_typical boolean not null default false,
  allergens text[] not null default '{}' check (allergens <@ array['gluten','crustacee','oua','peste','arahide','soia','lapte','fructe_coaja','telina','mustar','susan','sulfiti','lupin','moluste']),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index products_household on public.products (household_id);
create index products_category on public.products (category_id);
create unique index products_ean on public.products (ean, coalesce(household_id, '00000000-0000-0000-0000-000000000000')) where ean is not null and deleted_at is null;

create table public.product_aliases (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  alias text not null check (char_length(alias) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index product_aliases_product on public.product_aliases (product_id);

create table public.retailers (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('supermarket','hipermarket','discount','cash_carry','proximitate','piata','producator','alta')),
  details text check (char_length(details) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.product_retailer_mappings (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  retailer_id text not null references public.retailers (id) on delete cascade,
  retailer_product_name text not null check (char_length(retailer_product_name) between 1 and 160),
  ean text check (ean ~ '^(\d{8}|\d{12,14})$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index product_retailer_mappings_product on public.product_retailer_mappings (product_id);

create table public.pantry_locations (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.recipes (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  categories text[] not null default '{}' check (categories <@ array['mic_dejun','pranz','cina','gustari','supe_ciorbe','traditionale','carne','peste','vegetariene','salate','deserturi','rapide','meal_prep']),
  cuisine text not null default 'romaneasca' check (cuisine in ('romaneasca', 'internationala')),
  servings integer not null check (servings between 1 and 50),
  prep_minutes integer not null default 0 check (prep_minutes between 0 and 2880),
  cook_minutes integer not null default 0 check (cook_minutes between 0 and 2880),
  difficulty text not null default 'mediu' check (difficulty in ('usor', 'mediu', 'dificil')),
  image_url text check (char_length(image_url) <= 500),
  nutrition jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index recipes_household on public.recipes (household_id);

create table public.recipe_ingredients (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  product_id text not null references public.products (id),
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit text references public.units (code),
  note text check (char_length(note) <= 120),
  optional boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((quantity is null) = (unit is null))
);
create index recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);
create index recipe_ingredients_product on public.recipe_ingredients (product_id);

create table public.recipe_steps (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  position integer not null check (position >= 0),
  text text not null check (char_length(text) between 1 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index recipe_steps_recipe on public.recipe_steps (recipe_id);

-- ---------------------------------------------------------------------------
-- Datele gospodăriei
-- ---------------------------------------------------------------------------

create table public.household_settings (
  id uuid primary key,
  household_id uuid not null unique references public.households (id) on delete cascade,
  pantry_on_purchase text not null default 'intreaba' check (pantry_on_purchase in ('intreaba', 'mereu', 'niciodata')),
  week_starts_on smallint not null default 1 check (week_starts_on = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (id = household_id)
);

create table public.shopping_lists (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_recurring boolean not null default false,
  -- Numărul „turei” de cumpărături; crește la fiecare finalizare.
  cycle integer not null default 1 check (cycle >= 1),
  archived_at timestamptz,
  default_retailer_id text references public.retailers (id),
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, household_id)
);
create index shopping_lists_household on public.shopping_lists (household_id, updated_at);

create table public.shopping_list_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null,
  product_id text references public.products (id),
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit text references public.units (code),
  category_id text not null references public.product_categories (id),
  estimated_price numeric(10, 2) check (estimated_price is null or estimated_price >= 0),
  actual_price numeric(10, 2) check (actual_price is null or actual_price >= 0),
  retailer_id text references public.retailers (id),
  source text not null default 'supermarket' check (source in ('supermarket', 'piata', 'producator', 'alta')),
  priority text not null default 'normala' check (priority in ('normala', 'ridicata')),
  note text check (char_length(note) <= 500),
  checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid references auth.users (id) on delete set null,
  origin text not null default 'manual' check (origin in ('manual', 'reteta', 'plan', 'recurent')),
  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade
);
create index shopping_list_items_household on public.shopping_list_items (household_id, updated_at);
create index shopping_list_items_list on public.shopping_list_items (list_id);

create table public.shopping_transactions (
  -- Id determinist (derivat din listă + tură) ca două dispozitive care
  -- finalizează aceeași tură offline să nu dubleze cheltuiala.
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid,
  list_cycle integer,
  started_at timestamptz not null,
  completed_at timestamptz,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, household_id),
  foreign key (list_id, household_id) references public.shopping_lists (id, household_id) on delete cascade
);
create unique index shopping_transactions_cycle on public.shopping_transactions (list_id, list_cycle) where list_id is not null;
create index shopping_transactions_household on public.shopping_transactions (household_id, updated_at);

create table public.shopping_transaction_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  transaction_id uuid not null,
  list_item_id uuid,
  product_id text references public.products (id),
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(12, 3) check (quantity is null or quantity > 0),
  unit text references public.units (code),
  category_id text not null references public.product_categories (id),
  amount numeric(10, 2) check (amount is null or amount >= 0),
  retailer_id text references public.retailers (id),
  source text not null default 'supermarket' check (source in ('supermarket', 'piata', 'producator', 'alta')),
  purchased_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (transaction_id, household_id) references public.shopping_transactions (id, household_id) on delete cascade
);
create unique index shopping_transaction_items_once on public.shopping_transaction_items (transaction_id, list_item_id) where list_item_id is not null;
create index shopping_transaction_items_household on public.shopping_transaction_items (household_id, updated_at);
create index shopping_transaction_items_purchased on public.shopping_transaction_items (household_id, purchased_at);

create table public.product_prices (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  product_id text not null references public.products (id),
  retailer_id text references public.retailers (id),
  source text not null check (source in ('supermarket', 'piata', 'producator', 'alta')),
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'RON' check (currency = 'RON'),
  quantity numeric(12, 3) not null check (quantity > 0),
  unit text not null references public.units (code),
  price_type text not null check (price_type in ('platit', 'observat', 'promotie', 'estimat')),
  confidence text not null default 'ridicata' check (confidence in ('ridicata', 'medie', 'scazuta')),
  observed_on date not null,
  transaction_item_id uuid references public.shopping_transaction_items (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index product_prices_product on public.product_prices (household_id, product_id, observed_on desc);
create index product_prices_household on public.product_prices (household_id, updated_at);

create table public.favorite_recipes (
  -- Id determinist (gospodărie + rețetă): un singur rând per rețetă favorită.
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, recipe_id)
);

create table public.meal_plan_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('mic_dejun', 'pranz', 'cina', 'gustare')),
  recipe_id text not null references public.recipes (id),
  servings integer not null check (servings between 1 and 50),
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index meal_plan_items_household on public.meal_plan_items (household_id, date);

create table public.pantry_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  product_id text references public.products (id),
  name text not null check (char_length(name) between 1 and 120),
  quantity numeric(12, 3) not null check (quantity >= 0),
  unit text not null references public.units (code),
  location_id text not null references public.pantry_locations (id),
  purchased_on date,
  expires_on date,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pantry_items_household on public.pantry_items (household_id, updated_at);

create table public.budgets (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  period text not null check (period in ('lunar', 'saptamanal')),
  scope jsonb not null check (
    scope ->> 'kind' in ('total', 'alimente', 'nealimentare')
    or (scope ->> 'kind' = 'sursa' and scope ->> 'source' in ('supermarket', 'piata', 'producator', 'alta'))
    or (scope ->> 'kind' = 'categorie' and scope ? 'category_id')
    or (scope ->> 'kind' = 'magazin' and scope ? 'retailer_id')
  ),
  amount numeric(10, 2) not null check (amount > 0 and amount < 10000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Declanșatoare
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','households','household_members','household_invitations','user_preferences',
    'product_categories','brands','products','product_aliases','retailers','product_retailer_mappings',
    'pantry_locations','recipes','recipe_ingredients','recipe_steps','household_settings',
    'shopping_lists','shopping_list_items','shopping_transactions','shopping_transaction_items',
    'product_prices','favorite_recipes','meal_plan_items','pantry_items','budgets'
  ] loop
    execute format('create trigger touch_updated_at before insert or update on public.%I for each row execute function public.touch_updated_at()', t);
  end loop;

  foreach t in array array[
    'product_categories','brands','products','product_aliases','retailers','product_retailer_mappings',
    'pantry_locations','recipes','recipe_ingredients','recipe_steps','household_settings',
    'shopping_lists','shopping_list_items','shopping_transactions','shopping_transaction_items',
    'product_prices','favorite_recipes','meal_plan_items','pantry_items','budgets','household_invitations'
  ] loop
    execute format('create trigger keep_household_id before update on public.%I for each row execute function public.keep_household_id()', t);
  end loop;
end $$;

create trigger check_refs before insert or update on public.products
  for each row execute function public.check_household_refs('category_id', 'product_categories', 'brand_id', 'brands');
create trigger check_refs before insert or update on public.product_aliases
  for each row execute function public.check_household_refs('product_id', 'products');
create trigger check_refs before insert or update on public.product_retailer_mappings
  for each row execute function public.check_household_refs('product_id', 'products', 'retailer_id', 'retailers');
create trigger check_refs before insert or update on public.recipe_ingredients
  for each row execute function public.check_household_refs('recipe_id', 'recipes:strict', 'product_id', 'products');
create trigger check_refs before insert or update on public.recipe_steps
  for each row execute function public.check_household_refs('recipe_id', 'recipes:strict');
create trigger check_refs before insert or update on public.shopping_lists
  for each row execute function public.check_household_refs('default_retailer_id', 'retailers');
create trigger check_refs before insert or update on public.shopping_list_items
  for each row execute function public.check_household_refs('product_id', 'products', 'category_id', 'product_categories', 'retailer_id', 'retailers');
create trigger check_refs before insert or update on public.shopping_transaction_items
  for each row execute function public.check_household_refs('product_id', 'products', 'category_id', 'product_categories', 'retailer_id', 'retailers');
create trigger check_refs before insert or update on public.product_prices
  for each row execute function public.check_household_refs('product_id', 'products', 'retailer_id', 'retailers');
create trigger check_refs before insert or update on public.favorite_recipes
  for each row execute function public.check_household_refs('recipe_id', 'recipes');
create trigger check_refs before insert or update on public.meal_plan_items
  for each row execute function public.check_household_refs('recipe_id', 'recipes');
create trigger check_refs before insert or update on public.pantry_items
  for each row execute function public.check_household_refs('product_id', 'products', 'location_id', 'pantry_locations');

-- Limitează invitațiile: cel mult 20 pe zi per gospodărie (protecție la abuz).
create or replace function public.limit_invitations() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from household_invitations
      where household_id = new.household_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Prea multe invitații într-o zi' using errcode = '54000';
  end if;
  return new;
end $$;
create trigger limit_invitations before insert on public.household_invitations
  for each row execute function public.limit_invitations();

-- ---------------------------------------------------------------------------
-- Funcții apelate de aplicație (RPC)
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then
    raise exception 'Trebuie să fii autentificat' using errcode = '42501';
  end if;
  if p_name is null or char_length(trim(p_name)) not between 1 and 80 then
    raise exception 'Numele gospodăriei trebuie să aibă între 1 și 80 de caractere' using errcode = '22023';
  end if;
  if (select count(*) from household_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'Poți crea cel mult 5 gospodării' using errcode = '54000';
  end if;
  insert into households (name, created_by) values (trim(p_name), auth.uid()) returning id into hid;
  insert into household_members (household_id, user_id, role) values (hid, auth.uid(), 'owner');
  insert into household_settings (id, household_id) values (hid, hid);
  insert into user_preferences (user_id, active_household_id) values (auth.uid(), hid)
    on conflict (user_id) do update set active_household_id = excluded.active_household_id;
  return hid;
end $$;

-- Ce vede cineva care deschide un link de invitație, înainte să accepte.
create or replace function public.invitation_preview(p_token text)
returns table (household_name text, invited_by text, role text, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select h.name, p.display_name, i.role, i.expires_at
  from household_invitations i
  join households h on h.id = i.household_id
  left join profiles p on p.id = i.created_by
  where i.token = p_token and i.accepted_at is null and i.revoked_at is null and i.expires_at > now();
$$;

create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv household_invitations;
begin
  if auth.uid() is null then
    raise exception 'Trebuie să fii autentificat' using errcode = '42501';
  end if;
  select * into inv from household_invitations where token = p_token for update;
  if inv.id is null or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at <= now() then
    raise exception 'Invitația nu mai este valabilă' using errcode = '22023';
  end if;
  if inv.email is not null and lower(inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'Invitația a fost trimisă pentru altă adresă de email' using errcode = '42501';
  end if;
  insert into household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid(), inv.role)
  on conflict (household_id, user_id) do nothing;
  update household_invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  insert into user_preferences (user_id, active_household_id) values (auth.uid(), inv.household_id)
    on conflict (user_id) do update set active_household_id = excluded.active_household_id;
  return inv.household_id;
end $$;

create or replace function public.transfer_ownership(p_household uuid, p_new_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.member_role(p_household) is distinct from 'owner' then
    raise exception 'Doar proprietarul poate transfera gospodăria' using errcode = '42501';
  end if;
  if not exists (select 1 from household_members where household_id = p_household and user_id = p_new_owner) then
    raise exception 'Persoana nu este membră a gospodăriei' using errcode = '22023';
  end if;
  update household_members set role = 'admin' where household_id = p_household and user_id = auth.uid();
  update household_members set role = 'owner' where household_id = p_household and user_id = p_new_owner;
end $$;

-- Membrii gospodăriei, cu numele afișat (profilurile nu sunt publice).
create or replace function public.household_member_list(p_household uuid)
returns table (user_id uuid, display_name text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, coalesce(p.display_name, 'Membru'), m.role, m.joined_at
  from household_members m left join profiles p on p.id = m.user_id
  where m.household_id = p_household and public.is_member(p_household)
  order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.joined_at;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.app_admins enable row level security;
alter table public.user_preferences enable row level security;
alter table public.units enable row level security;

create policy "profil propriu" on public.profiles for select to authenticated using (id = auth.uid());
create policy "actualizare profil propriu" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "membrii văd gospodăria" on public.households for select to authenticated using (public.is_member(id));
create policy "administratorii redenumesc" on public.households for update to authenticated
  using (public.is_household_admin(id)) with check (public.is_household_admin(id));
create policy "proprietarul șterge" on public.households for delete to authenticated using (public.member_role(id) = 'owner');

create policy "membrii se văd între ei" on public.household_members for select to authenticated using (public.is_member(household_id));
-- Doar proprietarul schimbă rolurile, și nu poate crea un al doilea proprietar.
create policy "proprietarul schimbă roluri" on public.household_members for update to authenticated
  using (public.member_role(household_id) = 'owner' and role <> 'owner')
  with check (role in ('admin', 'member'));
-- Oricine poate pleca (în afară de proprietar); administratorii scot membri; proprietarul scoate pe oricine în afară de el.
create policy "plecare sau excludere" on public.household_members for delete to authenticated using (
  (user_id = auth.uid() and role <> 'owner')
  or (public.member_role(household_id) = 'admin' and role = 'member')
  or (public.member_role(household_id) = 'owner' and role <> 'owner')
);

create policy "administratorii văd invitațiile" on public.household_invitations for select to authenticated
  using (public.is_household_admin(household_id));
create policy "administratorii invită" on public.household_invitations for insert to authenticated with check (
  public.is_household_admin(household_id)
  and created_by = auth.uid()
  and accepted_at is null and revoked_at is null
  and (role = 'member' or public.member_role(household_id) = 'owner')
  and expires_at <= now() + interval '30 days'
);
create policy "administratorii revocă" on public.household_invitations for update to authenticated
  using (public.is_household_admin(household_id) and accepted_at is null)
  with check (public.is_household_admin(household_id) and accepted_at is null);

create policy "admin propriu" on public.app_admins for select to authenticated using (user_id = auth.uid());

create policy "preferințe proprii" on public.user_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (active_household_id is null or public.is_member(active_household_id)));

create policy "unități pentru toți" on public.units for select to authenticated using (true);

-- Tabelele sincronizate. Nu există politici DELETE: ștergerea e logică (deleted_at).
do $$
declare t text;
begin
  -- Catalog: global (household_id NULL) sau propriu gospodăriei.
  foreach t in array array[
    'product_categories','brands','products','product_aliases','retailers','product_retailer_mappings',
    'pantry_locations','recipes','recipe_ingredients','recipe_steps'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "citire" on public.%I for select to authenticated using (public.can_read(household_id))', t);
    execute format('create policy "adăugare" on public.%I for insert to authenticated with check (public.can_write(household_id))', t);
    execute format('create policy "modificare" on public.%I for update to authenticated using (public.can_write(household_id)) with check (public.can_write(household_id))', t);
  end loop;

  -- Date doar ale gospodăriei.
  foreach t in array array[
    'household_settings','shopping_lists','shopping_list_items','shopping_transactions','shopping_transaction_items',
    'product_prices','favorite_recipes','meal_plan_items','pantry_items','budgets'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "citire" on public.%I for select to authenticated using (public.is_member(household_id))', t);
    execute format('create policy "adăugare" on public.%I for insert to authenticated with check (public.is_member(household_id))', t);
    execute format('create policy "modificare" on public.%I for update to authenticated using (public.is_member(household_id)) with check (public.is_member(household_id))', t);
  end loop;
end $$;

-- Funcțiile RPC pot fi apelate doar de utilizatori autentificați.
revoke execute on function public.create_household(text), public.accept_invitation(text), public.transfer_ownership(uuid, uuid),
  public.household_member_list(uuid), public.invitation_preview(text) from public, anon;
grant execute on function public.create_household(text), public.accept_invitation(text), public.transfer_ownership(uuid, uuid),
  public.household_member_list(uuid), public.invitation_preview(text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: modificările gospodăriei ajung imediat la ceilalți membri.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.shopping_lists, public.shopping_list_items, public.shopping_transactions, public.shopping_transaction_items,
  public.product_prices, public.meal_plan_items, public.pantry_items, public.budgets, public.favorite_recipes,
  public.household_settings, public.products, public.recipes;
