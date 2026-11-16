-- Plăți manuale ale familiei, distincte de produse și bonuri.
create table public.manual_expenses (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 120 and char_length(description) <= 120),
  amount numeric(10,2) not null check (amount > 0 and amount < 10000000),
  category_id text not null check (category_id in (
    'alimentatie','educatie','haine','transport','locuinta','sanatate',
    'ingrijire','activitati','vacante','abonamente','cadouri','altele'
  )),
  spent_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index manual_expenses_household on public.manual_expenses(household_id, updated_at);
create trigger touch_updated_at before insert or update on public.manual_expenses
  for each row execute function public.touch_updated_at();
create trigger keep_household_id before update on public.manual_expenses
  for each row execute function public.keep_household_id();

alter table public.manual_expenses enable row level security;
create policy "citire" on public.manual_expenses for select to authenticated using (public.is_member(household_id));
create policy "adăugare" on public.manual_expenses for insert to authenticated with check (public.is_member(household_id));
create policy "modificare" on public.manual_expenses for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
revoke all on public.manual_expenses from anon;
revoke delete, truncate on public.manual_expenses from authenticated;
grant select, insert, update on public.manual_expenses to authenticated;
alter publication supabase_realtime add table public.manual_expenses;

-- Scopurile vechi își păstrează semnificația: cumpărături. Cele două noi
-- includ plățile manuale, în total sau după categoria generală a familiei.
alter table public.budgets drop constraint budgets_scope_check;
alter table public.budgets add constraint budgets_scope_check check (coalesce(
  scope ->> 'kind' in ('total', 'alimente', 'nealimentare', 'familie')
  or (scope ->> 'kind' = 'sursa' and scope ->> 'source' in ('supermarket','piata','producator','alta'))
  or (scope ->> 'kind' = 'categorie' and scope ? 'category_id')
  or (scope ->> 'kind' = 'magazin' and scope ? 'retailer_id')
  or (scope ->> 'kind' = 'cheltuiala' and scope ->> 'category_id' in (
    'alimentatie','educatie','haine','transport','locuinta','sanatate',
    'ingrijire','activitati','vacante','abonamente','cadouri','altele'
  )), false
));
