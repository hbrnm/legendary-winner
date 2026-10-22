# 016 — Bonul cu numele lui, categorii, cămara din bon, sugestii după oră, nutriție

**Stare:** în așteptare (etapele 1–3 integrate; etapa 4: tabelul de nutriție aprobat; urmează calculul și ecranul, într-o sesiune nouă)
**Ramuri:** câte una pe etapă, din `main` (`claude/016-...`).

## Scop
Lista proprietarului (22 oct. 2026), cu deciziile din chestionar (variantele recomandate):
1. **Numele de pe bon:** bonul se salvează cu denumirea de pe bon, chiar dacă linia e legată de un produs generic din catalog. Istoricul, cămara și prețurile arată numele de pe bon; legătura cu produsul generic rămâne (rețete, cămară, compararea prețurilor). Fiecare magazin își păstrează numele lui.
2. **Categorii:** produsele noi de pe bon nu mai merg toate la „Diverse”. Gemini propune categoria (din cele 20 fixe); fără internet, aplicația o propune după cuvinte; omul o poate schimba pe „Verifică bonul”. Un ecran pentru mutarea produselor deja ajunse la „Diverse”.
3. **Nutriție:** calculată din ingrediente; fiecare produs din catalog primește valorile la 100 g din CIQUAL (ANSES, Franța, licență liberă; decizia din 22 oct. 2026, în locul USDA); pe rețetă: kcal, proteine, glucide, grăsimi pe porție, „aproximativ”. Când un ingredient nu se poate calcula, se spune ce lipsește. Tabelul se aprobă de proprietar înainte de producție.
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
| 1b | **Categorii** (restul etapei 1, de mai jos). | gata (PR #93) | `read-receipt.ts`, `receipt-json.ts`, `receipt-match.ts`, `receipts.ts`, `budget.ts`, `cumparaturi/bon/page.tsx`, `buget/page.tsx`, `buget/diverse/page.tsx`, `supabase/functions/read-receipt/core.js` |
| 1 | **Numele de pe bon + categorii:** migrație `receipt_name text null` pe `shopping_list_items` și `shopping_transaction_items`; `applyReceipt` și `finalizeShopping` scriu/copiază numele de pe bon, exact cum vine de la citire; lista recurentă îl golește la „Gata”; Istoric, cămară, Prețuri îl arată, cu generic dedesubt. Categoria: `category` în `RECEIPT_SCHEMA` (enum cu id-urile din `categories.ts`), `guessCategory(name)` în `src/lib/domain` (cuvinte → categorie, pentru Tesseract/„Scrie sau dictează”), selector pe „Verifică bonul” la produsele noi; produsul nou se creează în categoria aleasă. Ecran „Diverse”: produsele gospodăriei din „Diverse” cu selector; schimbarea mută și liniile din istoric ale produsului. Textele într-un chestionar. Funcția `read-receipt` pe producție doar cu acordul proprietarului. | de făcut | `receipts.ts`, `shopping.ts`, `read-receipt.ts`, `receipt-json.ts`, `cumparaturi/bon/page.tsx`, `cumparaturi/istoric/page.tsx`, `supabase/migrations/`, `supabase/functions/read-receipt/` |
| 2 | **Cămara din bon + consum automat** (PR #94): migrație `auto_consume_on date null` pe `pantry_items`; `CONSUME_DAYS` pe categorii (tabelul de mai jos, în `src/data`); `finalizeShopping` și `applyReceipt` (fără listă, după `pantry_on_purchase`; „întreabă” = bifă pe „Verifică bonul”) îl completează; `sweepConsumed(today)` la deschiderea aplicației șterge logic ce a trecut (idempotent pe mai multe telefoane); editarea cantității sau a datei în cămară îl poate schimba/goli. Teste cu data fixată. | de făcut | `shopping.ts`, `receipts.ts`, `pantry.ts`, `kitchen.ts`, `camara/`, `supabase/migrations/` |
| 3 | **Sugestii după oră** (PR deschis): `mealSlotForHour(h)` în `src/lib/domain`, filtrul pe `categories` al rețetei în `home-screen.tsx`; titlul secțiunii după interval. Ora din `Date` locală, injectată în test. | de făcut | `recipes.ts`, `home-screen.tsx`, `e2e/` |
| 4 | **Nutriție:** migrație `nutrition_per_100g jsonb null` + `nutrition_source text null` pe `products`; tabelul CIQUAL → produsele din catalog (agent, cu codul CIQUAL al fiecărui rând; ce nu are corespondent rămâne `null`, „DE COMPLETAT”); `recipeNutrition(recipe, ingredients, products)` (grame prin `convertForProduct`, pe porție, plus lista ingredientelor necalculate); ecranul rețetei: valorile „aproximativ” și sursa. Aprobarea tabelului de proprietar înainte de producție. Probabil două sesiuni (tabelul, apoi calculul + ecranul). | în lucru (tabelul gata, aprobat) | `src/data/products/`, `recipes.ts`, `retete/reteta/page.tsx`, `supabase/migrations/`, `supabase/seed.sql` |

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
- ~~Etapa 4: cum arată valorile când lipsesc ingrediente~~ — parțial, cu avertisment (chestionar, 22 oct. 2026): valorile din ce se poate calcula, „aproximativ”, plus „Fără: …”; „după gust” și opționalele nu contează ca lipsă (textele exacte, în chestionarul etapei).

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
- **Teste:** `receipt-json.test.ts` (+1), `read-receipt.test.ts` (fiecare categorie explicată), `budget.test.ts` (+1), `receipts.test.ts` (+3), `e2e/bonuri.spec.ts` (categoria propusă, mutarea din Buget). `npm test`: 598; `npm run test:e2e`: 43; `npm run build` reușit.
- **Producția** (acordul proprietarului, chestionar, 22 oct. 2026): PR #93 integrat; funcția `read-receipt` versiunea 11, `index.ts` identic cu repo-ul, `core.js` ca în repo fără tabelele nefolosite de funcție (unitățile importului de rețete, formatul banilor), ca la versiunea 10. Prima citire cu categoria se vede la încercarea pe telefon.

### Etapa 2: cămara din bon (22 oct. 2026)
- **Texte** (chestionar, 22 oct. 2026): în cămară, la editare, „Consumat până pe” cu „Apoi îl scot singur din cămară. Golește data ca să rămână.”; mesajul „Am scos din cămară N produse, probabil consumate.” („un produs, probabil consumat”). Pe „Verifică bonul”, fără listă și cu setarea „întreabă”, comutatorul deja aprobat de la „Gata”: „Pune alimentele în cămară”.
- **Cum merge:** `addPurchaseToPantry` (comun pentru „Gata” și bonul fără listă) pune `auto_consume_on` = ziua cumpărării + zilele categoriei (`src/data/consume-days.ts`); categoriile fără durată (nealimentare) nu o primesc. `sweepConsumed` șterge logic, la deschiderea ecranelor (`ConsumedSweeper` în `AppShell`), ce a ajuns la ziua lui; produsele adăugate de mână nu au zi, deci rămân. Coloana se trimite doar când are valoare (rândurile manuale nu o ating).
- **După `verificare`:** cu cont, ștergerea rulează doar după o sincronizare reușită în pornirea curentă (un telefon rămas offline nu șterge un produs prelungit pe alt telefon), o dată pe zi și gospodărie; „Consumat până pe” acceptă doar zile de mâine încolo.
- **Migrația** `20261022000002_pantry_auto_consume.sql`: pe producție înainte de integrare; aplicată prin conector cu acordul proprietarului (chestionar, 22 oct. 2026), coloana verificată, versiunea aliniată. Altfel, alimentele puse în cămară din cumpărături sunt refuzate la sincronizare.
- **Teste:** `receipts.test.ts` (+3: bonul fără listă în cămară cu zilele, „Gata” cu pâinea în 3 zile, ieșirea în ziua lui), `supabase/tests/receipt-aliases.test.ts` (+1), `e2e/bonuri.spec.ts` (mesajul cu cămara, câmpul în cămară). `npm test`: 601; `npm run test:db`: 63; `npm run test:e2e`: 43; `npm run build` reușit.

### Etapa 3: sugestii după oră (22 oct. 2026)
- **Texte** (chestionar, 22 oct. 2026): titlul secțiunii „Pentru micul dejun” / „Pentru prânz” / „Pentru cină” (în loc de „Rețete sugerate”).
- **Cum merge:** `mealForHour` (05–10, 11–16, 17–04) și `recipesForMeal` (fără rețete potrivite, toate); pe prima pagină, „ce pot găti” și rețetele rapide se aleg doar dintre rețetele mesei. Ora vine din `now()` (ora telefonului); datele se recalculează când se schimbă masa.
- **După `verificare`:** cu sub trei rețete rapide pentru masa curentă, sugestiile se aleg din toate rețetele mesei (secțiunea nu rămâne goală).
- **Teste:** `recipes.test.ts` (+2), `e2e/retete-camara.spec.ts` (la 09:00, „Pentru micul dejun” cu trei rețete). `npm test`: 603; `npm run test:e2e`: 44 (gospodăria model, 50/50 la repetare); `npm run build` reușit.

### Etapa 4: nutriția — sursa (22 oct. 2026)
- **Sursa** (chestionar, 22 oct. 2026): proprietarul vrea surse cât mai apropiate de România. USDA = medii pentru alimentele din SUA (apropiate la alimentele de bază, departe la cele prelucrate: pâine, telemea, mezeluri). Nu există o bază românească publică, descărcabilă, cu licență liberă (tabelele românești sunt în cărți, cu drepturi de autor). Ales: **CIQUAL** (ANSES, Franța, licență liberă, ~3.000 de alimente europene); ce nu are corespondent rămâne „DE COMPLETAT”. Dacă proprietarul aduce un tabel românesc cu drept de folosire, are prioritate.
- **Rețeaua:** proprietarul a deschis domeniile CIQUAL și USDA (22 oct. 2026) și a cerut ambele surse: CIQUAL întâi, USDA unde CIQUAL nu are alimentul sau nu are toate cele patru valori.
- **Tabelul** (`src/data/nutrition.ts`, `NutritionSeed` în `seed-types.ts`): CIQUAL 2025 (`Table Ciqual 2025_ENG_2025_11_03.xlsx`) și USDA SR Legacy (2018-04, CSV). Agenții (4 loturi) au ales doar codul fiecărui produs, așa cum se cumpără; valorile le-a luat un script direct din fișiere (numele din sursă verificat pe cod). Glucidele asimilabile (USDA: minus fibre), „urme”/„< x” = 0. La 12 produse CIQUAL nu avea energia sau o valoare: alt rând complet (CIQUAL) sau USDA. Rezultat: 385 din 424 cu valori (358 CIQUAL, 27 USDA; 104 „aproape”, cu numele alimentului din sursă în comentariu), 39 DE COMPLETAT (7 nealimentare din „copii”).
- **Limită cunoscută:** valorile sunt pentru partea care se mănâncă; la carnea cu os (pulpe, pui întreg, ciolan) calculul iese puțin mai mare.
- **Pagina de aprobare:** https://claude.ai/artifact/BXfPdd8qXHMwcQbXWv8Wv6 (privată). **Aprobat așa de proprietar** (chestionar, 22 oct. 2026), cu rândurile „aproape”.
- **Test:** `catalog.test.ts` (+1: doar produse alimentare din catalog, valori plauzibile). `npm test`: 604; `npm run build` reușit.
- **De întrebat la calcul (găsit de `verificare`):** `ceai-plante` și `ceai-tei` au valorile infuziei gata făcute (0,8 kcal), `ceai-negru` pe ale frunzei uscate (232 kcal); de adus pe aceeași bază sau lăsate DE COMPLETAT (rețetele cu ceai îl măsoară de obicei în plicuri).

## Cum verific la final
Pe telefon, cu cont: un bon Lidl fără listă → Istoric arată „LAPTE ZUZU 1,5% 1L” (legat de „Lapte”), produsele noi au categoriile propuse, alimentele sunt în cămară; data mutată peste 8 zile (test) → lactatele au dispărut, uleiul nu. Dimineața, prima pagină arată rețete de mic dejun. O rețetă din catalog arată kcal/porție „aproximativ”.

## Următorul pas
Într-o sesiune nouă, restul etapei 4: migrația `nutrition_per_100g` + `nutrition_source` pe `products`, catalogul și seed-ul, `recipeNutrition`, ecranul rețetei (parțial, cu „Fără: …”; textele într-un chestionar).
