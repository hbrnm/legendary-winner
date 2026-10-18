# Schema bazei de date

Sursa de adevăr: [`supabase/migrations/20261011000001_schema.sql`](../supabase/migrations/20261011000001_schema.sql). Schimbările se fac doar prin migrații noi.

## Principii
- Fiecare rând de date are `household_id`. Catalogul global are `household_id NULL`.
- `updated_at` îl setează serverul la fiecare scriere (declanșatorul `touch_updated_at`) și e cursorul de sincronizare.
- Ștergerea e logică (`deleted_at`); tabelele sincronizate nu au politici `DELETE`.
- `household_id` nu se poate schimba după creare (`keep_household_id`).
- Referințele între tabele trebuie să fie din aceeași gospodărie sau globale (`check_household_refs`).
- `variant_id` (listă, cumpărătură, preț) e nulabil (null = produsul generic) și trebuie să fie o variantă a `product_id` de pe același rând (`check_variant_product`).

## Conturi și gospodării
| Tabel | Câmpuri principale | Acces (RLS) |
| --- | --- | --- |
| `profiles` | `id` (= `auth.users.id`), `display_name` | doar profilul propriu; numele membrilor vin prin `household_member_list` |
| `households` | `name`, `created_by` | citesc membrii; redenumesc owner/admin; șterge doar owner |
| `household_members` | `household_id`, `user_id`, `role` (`owner`/`admin`/`member`) | membrii se văd între ei; rolurile le schimbă owner; un singur owner pe gospodărie |
| `household_invitations` | `token`, `role`, `email` (opțional), `expires_at` (7 zile), `accepted_at`, `revoked_at` | doar owner/admin; cel mult 20 pe zi pe gospodărie |
| `app_admins` | `user_id` | fiecare își vede doar rândul propriu; se completează manual (vezi DEPLOYMENT) |
| `user_preferences` | `active_household_id`, `theme` | doar ale utilizatorului |

## Catalog (global sau al gospodăriei)
Citire: rândurile globale + ale gospodăriilor proprii. Scriere: globale doar `app_admins`, ale gospodăriei doar membrii.

| Tabel | Câmpuri principale |
| --- | --- |
| `units` | `code`, `singular`, `plural`, `dimension`, `factor` (doar citire) |
| `product_categories` | `name`, `icon`, `sort_order`, `is_food` |
| `brands` | `name` |
| `products` | `name`, `category_id`, `subcategory`, `default_unit`, `brand_id`, `ean`, `season_months`, `is_traditional`, `is_market_typical`, `allergens`, `piece_grams` (g pe bucată, aproximativ, pentru buc ↔ kg; migrația `20261012000001`), `grams_per_ml` (densitate aproximativă, g/ml, pentru lingură ↔ g; migrația `20261012000002`) |
| `product_aliases` | `product_id`, `alias` |
| `product_variants` | `product_id`, `brand_id`, `name` (denumirea comercială), `net_quantity` + `net_unit` (conținutul net, g/kg/ml/l, ambele sau niciunul), `ean` (unic pe gospodărie/global); fără `DELETE` nici în drepturi; migrația `20261018000001` |
| `retailers` | `name`, `kind`, `details` |
| `product_retailer_mappings` | `product_id`, `retailer_id`, `retailer_product_name`, `ean` |
| `pantry_locations` | `name`, `sort_order` |
| `recipes` | `name`, `description`, `categories`, `cuisine`, `servings`, `prep_minutes`, `cook_minutes`, `difficulty`, `image_url`, `nutrition` (`null`) |
| `recipe_ingredients` | `recipe_id`, `product_id`, `quantity`, `unit`, `note`, `optional`, `sort_order` |
| `recipe_steps` | `recipe_id`, `position`, `text` |

## Datele gospodăriei
Citesc și scriu doar membrii gospodăriei.

| Tabel | Câmpuri principale |
| --- | --- |
| `household_settings` | `pantry_on_purchase`, `week_starts_on` |
| `shopping_lists` | `name`, `is_recurring`, `cycle`, `archived_at`, `default_retailer_id` |
| `shopping_list_items` | `list_id`, `product_id`/`name`, `quantity`, `unit`, `category_id`, `estimated_price`, `actual_price`, `retailer_id`, `source`, `checked`, `checked_by`, `origin`, `variant_id` |
| `shopping_transactions` | `list_id`, `list_cycle` (unic pe listă), `started_at`, `completed_at` |
| `shopping_transaction_items` | `transaction_id`, `list_item_id`, `product_id`, `quantity`, `amount`, `retailer_id`, `purchased_at`, `variant_id` |
| `product_prices` | `product_id`, `retailer_id`, `source`, `amount`, `quantity`, `unit`, `price_type`, `confidence`, `observed_on`, `variant_id` |
| `favorite_recipes` | `recipe_id` |
| `recipe_photos` | `recipe_id` (globală sau a gospodăriei), `storage_path` (`{household_id}/{recipe_id}/{id}.webp` sau `.jpg`, legată de rând), `width`, `height` (1–1280), `created_by`; cel mult una activă pe gospodărie și rețetă |
| `meal_plan_items` | `date`, `slot`, `recipe_id`, `servings`, `note` |
| `pantry_items` | `product_id`/`name`, `quantity`, `unit`, `location_id`, `purchased_on`, `expires_on` |
| `budgets` | `name`, `period`, `scope` (total, sursă, categorie sau magazin), `amount`, `active` |

## Storage
Bucketul privat `recipe-photos` (max. 1 MB pe fișier, `image/webp` și `image/jpeg`) ține fișierele din `recipe_photos`. Politicile pe `storage.objects` lasă doar membrii gospodăriei din primul segment al căii să citească, să încarce, să înlocuiască și să șteargă (`is_member(photo_household(name))`; o cale fără gospodărie e refuzată). Niciun URL public.

## Realtime
Publicația `supabase_realtime` include listele, tranzacțiile, prețurile, planul, cămara, bugetele, favoritele, setările, produsele, variantele lor, rețetele și fotografiile rețetelor.

## Catalogul inițial
`supabase/seed.sql` e generat din `src/data` cu `npm run seed:sql`. Testul `src/data/catalog.test.ts` verifică dacă e la zi.
