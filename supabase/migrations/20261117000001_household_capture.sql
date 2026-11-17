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
