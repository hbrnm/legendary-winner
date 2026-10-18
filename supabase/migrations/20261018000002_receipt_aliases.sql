-- Potrivirile învățate de pe bonurile fiscale (.tasks/005, etapa 3): textul
-- unei linii de pe bon, la un magazin, înseamnă un produs. Le scriu și le
-- citesc doar membrii gospodăriei. Fotografia și textul brut al bonului nu
-- ajung pe server; rămâne doar textul liniei confirmate, normalizat.

create table public.receipt_aliases (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  -- null = bon de la un magazin necunoscut. Magazin global sau al gospodăriei (check_household_refs).
  retailer_id text references public.retailers (id),
  -- Normalizat în aplicație (fără diacritice, majuscule și semne).
  receipt_text text not null check (char_length(receipt_text) between 1 and 120 and receipt_text = lower(receipt_text)),
  product_id text not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- Un singur produs pentru același text, la același magazin.
create unique index receipt_aliases_once on public.receipt_aliases (household_id, coalesce(retailer_id, ''), receipt_text) where deleted_at is null;
create index receipt_aliases_household on public.receipt_aliases (household_id, updated_at);

create trigger touch_updated_at before insert or update on public.receipt_aliases
  for each row execute function public.touch_updated_at();
create trigger keep_household_id before update on public.receipt_aliases
  for each row execute function public.keep_household_id();
create trigger check_refs before insert or update on public.receipt_aliases
  for each row execute function public.check_household_refs('product_id', 'products', 'retailer_id', 'retailers');

-- Fără politică DELETE: ștergerea e logică (deleted_at).
alter table public.receipt_aliases enable row level security;
create policy "citire" on public.receipt_aliases for select to authenticated using (public.is_member(household_id));
create policy "adăugare" on public.receipt_aliases for insert to authenticated with check (public.is_member(household_id));
create policy "modificare" on public.receipt_aliases for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
-- Supabase dă implicit toate drepturile pe tabelele noi; le restrângem.
revoke all on public.receipt_aliases from anon;
revoke delete, truncate on public.receipt_aliases from authenticated;
grant select, insert, update on public.receipt_aliases to authenticated;

alter publication supabase_realtime add table public.receipt_aliases;
