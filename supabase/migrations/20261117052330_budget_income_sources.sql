-- Venituri recurente păstrate separat de plafonul de cheltuieli (amount).
create function public.valid_budget_income_sources(sources jsonb)
returns boolean
language plpgsql immutable strict security invoker
set search_path = pg_catalog
as $$
declare source jsonb; value numeric; label text;
begin
  if jsonb_typeof(sources) <> 'array' then return false; end if;
  if jsonb_array_length(sources) > 30 then return false; end if;
  for source in select jsonb_array_elements(sources) loop
    if jsonb_typeof(source) <> 'object'
       or jsonb_typeof(source->'name') is distinct from 'string'
       or jsonb_typeof(source->'amount') is distinct from 'number' then return false; end if;
    label := regexp_replace(source->>'name', '^\s+|\s+$', '', 'g');
    if char_length(label) not between 1 and 60 then return false; end if;
    value := (source->>'amount')::numeric;
    if value <= 0 or value > 9999999 or value <> round(value, 2) then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.valid_budget_income_sources(jsonb) from public, anon;
grant execute on function public.valid_budget_income_sources(jsonb) to authenticated, service_role;

alter table public.budgets
  add column income_sources jsonb not null default '[]'::jsonb,
  add constraint budgets_income_sources_valid check (public.valid_budget_income_sources(income_sources)),
  add constraint budgets_income_monthly_family check (
    income_sources = '[]'::jsonb or (period = 'lunar' and scope->>'kind' = 'familie')
  );
comment on column public.budgets.income_sources is 'Surse lunare recurente. amount este plafonul ales separat pentru cheltuieli.';
