-- Cămara din cumpărături (.tasks/016, etapa 2): ziua de la care produsul se
-- consideră consumat și iese singur din cămară (ștergere logică, din aplicație).
-- Se completează la intrarea din cumpărături, după categorie; null = rămâne
-- (produsele adăugate de mână). Migrația doar adaugă o coloană nulabilă.

alter table public.pantry_items add column auto_consume_on date;
