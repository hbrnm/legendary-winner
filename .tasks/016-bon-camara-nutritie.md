# 016 — Bonul cu numele lui, categorii, cămara din bon, sugestii după oră, nutriție

**Stare:** în lucru (etapa 1a gata, PR #92 integrat; etapa 1b: PR deschis, funcția `read-receipt` de publicat cu acordul proprietarului)
**Ramuri:** câte una pe etapă, din `main` (`claude/016-...`).

## Scop
Lista proprietarului (22 oct. 2026), cu deciziile din chestionar (variantele recomandate):
1. **Numele de pe bon:** bonul se salvează cu denumirea de pe bon, chiar dacă linia e legată de un produs generic din catalog. Istoricul, cămara și prețurile arată numele de pe bon; legătura cu produsul generic rămâne (rețete, cămară, compararea prețurilor). Fiecare magazin își păstrează numele lui.
2. **Categorii:** produsele noi de pe bon nu mai merg toate la „Diverse”. Gemini propune categoria (din cele 20 fixe); fără internet, aplicația o propune după cuvinte; omul o poate schimba pe „Verifică bonul”. Un ecran pentru mutarea produselor deja ajunse la „Diverse”.
3. **Nutriție:** calculată din ingrediente; fiecare produs din catalog primește valorile la 100 g din USDA FoodData Central (domeniu public); pe rețetă: kcal, proteine, glucide, grăsimi pe porție, „aproximativ”. Când un ingredient nu se poate calcula, se spune ce lipsește. Tabelul se aprobă de proprietar înainte de producție.
4. **Sugestii după oră:** 05:00–10:59 mic dejun, 11:00–16:59 prânz, 17:00–04:59 cină. În interval rămâne regula de azi: întâi ce poți găti cu cămara.
5. **Cămara din bon:** bonul salvat fără listă pune alimentele în cămară după setarea gospodăriei (`pantry_on_purchase`), ca „Gata” pe listă. Produsele intrate din cumpărături se șterg singure (logic) după o durată pe categorie; cele adăugate de mână nu se ating. Durata se poate schimba pe produsul din cămară.

## În afara scopului
- Citirea bonului (`.tasks/015`), potrivirea (`proposeMatch`), cititorul de pe telefon.
- Valori nutriționale la produsele gospodăriei (create din bon): rămân `null` („DE COMPLETAT”).
- Prețuri: nimic nou, nimic inventat.

## Ce am găsit în cod (22 oct. 2026)
- `applyReceipt` (`src/lib/services/receipts.ts`): linia potrivită primește `name = product.name` (pagina `cumparaturi/bon/page.tsx:246`), deci numele de pe bon se pierde; rămâne doar în `receipt_aliases` (normalizat, fără majuscule). Cu listă, linia de pe listă își păstrează numele generic, iar `finalizeShopping` copiază `item.name`.
- Produsele noi: `createProduct(..., category_id: "diverse")`. Bugetul pe categorii folosește `shopping_transaction_items.category_id` (copie la cumpărare).
- `RECEIPT_SCHEMA` (`src/lib/server/read-receipt.ts`) nu are categorie.
- Cămara: doar `finalizeShopping` adaugă (cu `addToPantry`); bonul fără listă nu. `PantryItem` nu are câmp pentru „consumat până la”.
- Sugestii: `home-screen.tsx` (rândurile ~65–71), `whatCanICook` sau rețete rapide; nu ține cont de oră. Catalogul: 24 rețete `mic_dejun`, 127 `pranz`, 89 `cina` (din 186).
- Nutriție: `recipes.nutrition` (jsonb) există, mereu `null`; ecranul rețetei spune „nu sunt disponibile”. Produsele nu au câmp de nutriție. Conversii: `piece_grams`, `grams_per_ml` (`convertForProduct`).

## Etape
| # | Etapa | Stare | Fișiere |
|---|---|---|---|
| 1a | **Numele de pe bon** (împărțită din etapa 1, chestionar 22 oct. 2026): migrația `receipt_name`, `applyReceipt`, `finalizeShopping`, Istoric, Prețuri, Cămara. | gata | `receipts.ts`, `shopping.ts`, `cumparaturi/bon/page.tsx`, `cumparaturi/istoric/page.tsx`, `buget/preturi/page.tsx`, `supabase/migrations/20261022000001_receipt_name.sql`; PR #92 |
| 1b | **Categorii** (restul etapei 1, de mai jos). | în lucru | `read-receipt.ts`, `receipt-json.ts`, `receipt-match.ts`, `receipts.ts`, `budget.ts`, `cumparaturi/bon/page.tsx`, `buget/page.tsx`, `buget/diverse/page.tsx`, `supabase/functions/read-receipt/core.js` |
| 1 | **Numele de pe bon + categorii:** migrație `receipt_name text null` pe `shopping_list_items` și `shopping_transaction_items`; `applyReceipt` și `finalizeShopping` scriu/copiază numele de pe bon, exact cum vine de la citire; lista recurentă îl golește la „Gata”; Istoric, cămară, Prețuri îl arată, cu generic dedesubt. Categoria: `category` în `RECEIPT_SCHEMA` (enum cu id-urile din `categories.ts`), `guessCategory(name)` în `src/lib/domain` (cuvinte → categorie, pentru Tesseract/„Scrie sau dictează”), selector pe „Verifică bonul” la produsele noi; produsul nou se creează în categoria aleasă. Ecran „Diverse”: produsele gospodăriei din „Diverse” cu selector; schimbarea mută și liniile din istoric ale produsului. Textele într-un chestionar. Funcția `read-receipt` pe producție doar cu acordul proprietarului. | de făcut | `receipts.ts`, `shopping.ts`, `read-receipt.ts`, `receipt-json.ts`, `cumparaturi/bon/page.tsx`, `cumparaturi/istoric/page.tsx`, `supabase/migrations/`, `supabase/functions/read-receipt/` |
| 2 | **Cămara din bon + consum automat:** migrație `auto_consume_on date null` pe `pantry_items`; `CONSUME_DAYS` pe categorii (tabelul de mai jos, în `src/data`); `finalizeShopping` și `applyReceipt` (fără listă, după `pantry_on_purchase`; „întreabă” = bifă pe „Verifică bonul”) îl completează; `sweepConsumed(today)` la deschiderea aplicației șterge logic ce a trecut (idempotent pe mai multe telefoane); editarea cantității sau a datei în cămară îl poate schimba/goli. Teste cu data fixată. | de făcut | `shopping.ts`, `receipts.ts`, `pantry.ts`, `kitchen.ts`, `camara/`, `supabase/migrations/` |
| 3 | **Sugestii după oră:** `mealSlotForHour(h)` în `src/lib/domain`, filtrul pe `categories` al rețetei în `home-screen.tsx`; titlul secțiunii după interval. Ora din `Date` locală, injectată în test. | de făcut | `recipes.ts`, `home-screen.tsx`, `e2e/` |
| 4 | **Nutriție:** migrație `nutrition_per_100g jsonb null` + `nutrition_source text null` pe `products`; tabelul USDA → produsele din catalog (agent, cu codul FDC al fiecărui rând; ce nu are corespondent rămâne `null`); `recipeNutrition(recipe, ingredients, products)` (grame prin `convertForProduct`, pe porție, plus lista ingredientelor necalculate); ecranul rețetei: valorile „aproximativ” și sursa. Aprobarea tabelului de proprietar înainte de producție. Probabil două sesiuni (tabelul, apoi calculul + ecranul). | de făcut | `src/data/products/`, `recipes.ts`, `retete/reteta/page.tsx`, `supabase/migrations/`, `supabase/seed.sql` |

### Durate până la „consumat” (aprobate 22 oct. 2026, pe categorii)
| Zile | Categorii |
|---|---|
| 3 | panificatie |
| 5 | fructe, legume, carne, peste |
| 7 | lactate, oua, mezeluri, copii |
| 14 | branzeturi |
| 30 | dulciuri-gustari, bauturi |
| 60 | congelate |
| 90 | cereale-paste, copt, conserve |
| 120 | uleiuri-condimente |
| — | curatenie, igiena, diverse (nealimentare, nu intră în cămară) |

## Întrebări deschise (le pun la etapa respectivă)
- Etapa 1: textele noi (selectorul de categorie, ecranul „Diverse”, eticheta numelui de pe bon).
- Etapa 2: textul notificării „Am scos din cămară N produse probabil consumate” (cu „Anulează”?).
- Etapa 4: cum arată valorile când lipsesc ingrediente (parțial cu avertisment sau deloc).

## Rezumat pe etape
### Etapa 1a: numele de pe bon (22 oct. 2026)
- **Texte** (chestionar, 22 oct. 2026, variantele recomandate): în Istoric, numele de pe bon sus și „Lapte integral · 1 l” dedesubt; în Prețuri, sub data și locul, „pe bon: …”; în Cămară, numele de pe bon.
- **Cum merge:** `applyReceipt` primește `receipt_name` pe linie (null la „Scrie sau dictează”) și îl păstrează doar când diferă de numele produsului; cu listă stă pe linie până la „Gata”, când `finalizeShopping` îl copiază în cumpărătură și în numele din cămară; lista recurentă îl golește. `name` și `product_id` rămân ale produsului generic (rețete, cămară, prețuri). Prețurile găsesc numele prin `transaction_item_id`.
- **Migrația** `20261022000001_receipt_name.sql`: coloane nulabile, 1–200 caractere. Pe producție înainte de integrare (altfel scrierile cu coloana nouă nu se sincronizează): aplicată prin conector cu acordul proprietarului (chestionar, 22 oct. 2026), coloanele verificate, versiunea din istoric aliniată cu repo-ul (`20261022000001`).
- Numele vechi nu rămâne pe listă: la debifare, la duplicarea listei, la un bon nou fără nume distinct (găsit de `verificare`).
- **Teste:** `receipts.test.ts` (+3), `supabase/tests/receipt-aliases.test.ts` (+1), `e2e/bonuri.spec.ts` (Istoric). `npm test`: 593; `npm run test:db`: 62; `npm run test:e2e`: 43; `npm run build` reușit.

### Etapa 1b: categoriile (22 oct. 2026)
- **Texte** (chestionar, 22 oct. 2026, variantele recomandate): pe „Verifică bonul”, la produsul nou, „Categoria”; în Buget, „Mută din Diverse (N)” → „Produse din Diverse”, „Alege categoria potrivită. Se mută și cumpărăturile de până acum, ca bugetul să arate unde s-au dus banii.”, „Am mutat „X” la Lactate.”, „Nu mai ai nimic în Diverse.”
- **Pe server:** `category` pe fiecare linie din `RECEIPT_SCHEMA` (enum cu cele 20 de id-uri din `src/data/categories.ts`), explicată în instrucțiuni („diverse” când nu e sigur). `readReceiptJson` păstrează doar o categorie validă.
- **Fără internet** (Tesseract, „Scrie sau dictează”, sau răspunsul vechi `{ text }`): `guessCategory` caută în catalog tot textul, apoi tot mai scurt de la coadă (păstrând primul cuvânt); nimic = „Diverse”. Proba: „Detergent Ariel” → curățenie, „Piept pui dezosat” → carne, „Cheescake caramel sarat” → nimic (înainte, cu fiecare cuvânt, ieșea pește).
- **Aplicarea:** produsul nou se creează în categoria aleasă (una necunoscută = „Diverse”). **Mutarea din „Diverse”** (`moveOutOfDiverse`): produsul gospodăriei, liniile din liste și cumpărăturile; un produs din catalogul comun nu se schimbă, doar cumpărăturile gospodăriei. Ecranul arată doar produsele gospodăriei și liniile fără produs (`diverseToSort`): bateriile, becurile, hrana pentru animale din catalog sunt în „Diverse” pe bună dreptate (găsit de `verificare`).
- **Teste:** `receipt-json.test.ts` (+1), `read-receipt.test.ts` (fiecare categorie explicată), `budget.test.ts` (+1), `receipts.test.ts` (+3), `e2e/bonuri.spec.ts` (categoria propusă, mutarea din Buget). `npm test`: 598.
- **Producția:** funcția `read-receipt` (cu `core.js` nou) se publică doar cu acordul proprietarului; până atunci serverul nu trimite categoria și telefonul o ghicește după catalog.

## Cum verific la final
Pe telefon, cu cont: un bon Lidl fără listă → Istoric arată „LAPTE ZUZU 1,5% 1L” (legat de „Lapte”), produsele noi au categoriile propuse, alimentele sunt în cămară; data mutată peste 8 zile (test) → lactatele au dispărut, uleiul nu. Dimineața, prima pagină arată rețete de mic dejun. O rețetă din catalog arată kcal/porție „aproximativ”.

## Următorul pas
Proprietarul: un bon pe telefon → Istoric arată numele de pe bon; produsele noi au categoria propusă. Apoi etapa 2 (cămara din bon), într-o sesiune nouă.
