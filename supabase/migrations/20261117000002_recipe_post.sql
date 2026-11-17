-- Explicit household/editor tag only. Existing recipes keep their categories.
alter table public.recipes drop constraint recipes_categories_check;
alter table public.recipes add constraint recipes_categories_check check (
  categories <@ array[
    'mic_dejun','pranz','cina','gustari','supe_ciorbe','traditionale',
    'carne','peste','vegetariene','de_post','salate','deserturi','rapide','meal_prep'
  ]::text[]
);
