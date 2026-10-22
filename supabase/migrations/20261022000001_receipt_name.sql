-- Numele de pe bon (.tasks/016, etapa 1a): linia se salvează cu denumirea
-- tipărită pe bon („Lapte Zuzu 1,5% 1L”), iar `product_id` rămâne legătura cu
-- produsul generic („Lapte”). Pe listă stă până la „Gata”, apoi trece în
-- cumpărătură. Migrația doar adaugă coloane nulabile (null = fără bon).

alter table public.shopping_list_items add column receipt_name text check (char_length(receipt_name) between 1 and 200);
alter table public.shopping_transaction_items add column receipt_name text check (char_length(receipt_name) between 1 and 200);
