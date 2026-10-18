-- Citirea bonurilor cu AI pe server (.tasks/015, etapa 1): limita de cereri
-- pentru funcția Edge `read-receipt`, în același tabel ca importul și
-- traducerea rețetelor (.tasks/012), cu felul „receipt”. Se păstrează doar
-- cine și când a cerut, nimic din bon.

alter table public.recipe_import_requests drop constraint recipe_import_requests_kind_check;
alter table public.recipe_import_requests add constraint recipe_import_requests_kind_check
  check (kind in ('import', 'translate', 'receipt'));

-- Funcția Edge `read-receipt` o cheamă cu tokenul omului, înainte de model:
-- 20 de bonuri pe oră de om (limita comună, take_recipe_request_quota).
create or replace function public.take_receipt_read_quota() returns boolean
language sql security definer set search_path = '' as $$
  select public.take_recipe_request_quota('receipt');
$$;
revoke execute on function public.take_receipt_read_quota() from public, anon;
grant execute on function public.take_receipt_read_quota() to authenticated;
