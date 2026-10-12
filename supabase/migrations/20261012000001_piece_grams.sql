-- Greutatea aproximativă a unei bucăți (g), pentru produsele vândute la kg
-- pe care rețetele le cer la bucată („2 cepe”). Cu ea, lista, cămara și
-- costul pot converti bucăți ↔ kg (.tasks/004). null = nu se convertește.
-- Valorile din catalog sunt aproximative, aprobate de proprietar (11 oct. 2026).
alter table public.products
  add column piece_grams numeric(8, 1) check (piece_grams > 0 and piece_grams <= 5000);
