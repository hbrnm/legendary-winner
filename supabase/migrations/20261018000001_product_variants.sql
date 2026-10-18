-- Variantele comerciale ale produselor (.tasks/007, etapa 2): marca,
-- denumirea de pe ambalaj, conținutul net și codul de bare („Sissi, Șuncă
-- de pui, 300 g”). Ca restul catalogului: household_id NULL = global, scris
-- doar de app_admins; altfel al gospodăriei, scris de membrii ei.
-- Migrația doar adaugă: un tabel nou și coloane nulabile (null = produsul generic).

create table public.product_variants (
  id public.text_id primary key,
  household_id uuid references public.households (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  brand_id text references public.brands (id),
  name text not null check (char_length(name) between 1 and 120),
  -- Conținutul net al unui ambalaj; ambele sau niciunul.
  net_quantity numeric(10, 3) check (net_quantity > 0 and net_quantity <= 100000),
  net_unit text check (net_unit in ('g', 'kg', 'ml', 'l')),
  ean text check (ean ~ '^(\d{8}|\d{12,14})$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((net_quantity is null) = (net_unit is null))
);
create index product_variants_product on public.product_variants (product_id);
create index product_variants_household on public.product_variants (household_id, updated_at);
create unique index product_variants_ean on public.product_variants (ean, coalesce(household_id, '00000000-0000-0000-0000-000000000000'))
  where ean is not null and deleted_at is null;

create trigger touch_updated_at before insert or update on public.product_variants
  for each row execute function public.touch_updated_at();
create trigger keep_household_id before update on public.product_variants
  for each row execute function public.keep_household_id();
create trigger check_refs before insert or update on public.product_variants
  for each row execute function public.check_household_refs('product_id', 'products', 'brand_id', 'brands');

alter table public.product_variants enable row level security;
create policy "citire" on public.product_variants for select to authenticated using (public.can_read(household_id));
create policy "adăugare" on public.product_variants for insert to authenticated with check (public.can_write(household_id));
create policy "modificare" on public.product_variants for update to authenticated
  using (public.can_write(household_id)) with check (public.can_write(household_id));
-- Supabase dă implicit toate drepturile pe tabelele noi; le restrângem (fără DELETE: ștergerea e logică).
revoke all on public.product_variants from anon;
revoke delete, truncate on public.product_variants from authenticated;
grant select, insert, update on public.product_variants to authenticated;

alter publication supabase_realtime add table public.product_variants;

-- Varianta aleasă pe linia din listă, la cumpărătură și la preț.
alter table public.shopping_list_items add column variant_id text references public.product_variants (id);
alter table public.shopping_transaction_items add column variant_id text references public.product_variants (id);
alter table public.product_prices add column variant_id text references public.product_variants (id);
create index product_prices_variant on public.product_prices (variant_id) where variant_id is not null;

-- Varianta e globală sau a aceleiași gospodării, și e a produsului rândului.
drop trigger check_refs on public.shopping_list_items;
create trigger check_refs before insert or update on public.shopping_list_items
  for each row execute function public.check_household_refs('product_id', 'products', 'category_id', 'product_categories', 'retailer_id', 'retailers', 'variant_id', 'product_variants');
drop trigger check_refs on public.shopping_transaction_items;
create trigger check_refs before insert or update on public.shopping_transaction_items
  for each row execute function public.check_household_refs('product_id', 'products', 'category_id', 'product_categories', 'retailer_id', 'retailers', 'variant_id', 'product_variants');
drop trigger check_refs on public.product_prices;
create trigger check_refs before insert or update on public.product_prices
  for each row execute function public.check_household_refs('product_id', 'products', 'retailer_id', 'retailers', 'variant_id', 'product_variants');

create or replace function public.check_variant_product() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.variant_id is not null and not exists (
    select 1 from public.product_variants v where v.id = new.variant_id and v.product_id is not distinct from new.product_id
  ) then
    raise exception 'Varianta nu e a acestui produs' using errcode = '23514';
  end if;
  return new;
end $$;
revoke execute on function public.check_variant_product() from public, anon, authenticated;

create trigger check_variant before insert or update on public.shopping_list_items
  for each row execute function public.check_variant_product();
create trigger check_variant before insert or update on public.shopping_transaction_items
  for each row execute function public.check_variant_product();
create trigger check_variant before insert or update on public.product_prices
  for each row execute function public.check_variant_product();
