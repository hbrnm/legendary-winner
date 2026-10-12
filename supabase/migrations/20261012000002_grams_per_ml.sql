-- Densitatea (grame la 1 ml), pentru produsele vândute la kg pe care rețetele
-- le cer cu lingura sau lingurița („2 linguri de zahăr”). Cu ea, lista,
-- cămara și costul pot converti volum ↔ masă. null = nu se convertește.
-- Valorile sunt aproximative (linguri rase), aprobate de proprietar (12 oct. 2026).
alter table public.products
  add column grams_per_ml numeric(6, 3) check (grams_per_ml > 0 and grams_per_ml <= 25);
