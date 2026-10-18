# 007 — Variante comerciale (marcă, ambalaj, cod de bare)

**Stare:** în lucru: etapele 1–3 gata în repo (18 oct. 2026); urmează etapa 4 (ecranele).
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
Lângă produsul generic din catalog („Șuncă presată”) apare **varianta** pe care o cumperi de fapt: marca, denumirea comercială, ambalajul și, opțional, codul de bare (ex. „Sissi, Șuncă de pui, 300 g”). Prețul plătit se leagă de variantă, deci aplicația știe prețul pe kg, compară mărcile între ele și transformă „1 pachet” în grame fără valori inventate. E primul punct din ROADMAP 0.2.0 ([AUDIT_0.1.1.md](../docs/AUDIT_0.1.1.md), secțiunea 4).

Deciziile proprietarului (12 oct. 2026, chestionar):
- **Cine adaugă variante:** orice membru, pentru gospodăria lui (le văd doar membrii ei); `app_admins`, în catalogul global (`household_id NULL`), pentru toți. La fel ca produsele de acum.
- **Unde se alege varianta, în prima versiune:** pe linia din listă (opțional) și la preț. Prețul plătit se salvează pe variantă; în Buget → Prețuri apare prețul pe kg pe mărci. Cămara rămâne pe produsul generic.
- **Codul de bare:** câmp scris de mână la variantă; scanarea cu camera, într-o etapă ulterioară (mai jos, „După prima versiune”).
- **Sursele:** doar ce introduce gospodăria sau un admin. Nimic inventat, nimic preluat. Open Food Facts, eventual mai târziu, cu o decizie separată.

## În afara scopului
- Scanarea codului de bare și Open Food Facts (după prima versiune, fiecare cu decizia lui).
- Variante în cămară, în rețete și în planul de mese.
- Prețuri de promoție cu perioadă (`valid_from` / `valid_to`).
- Oferta pe magazin (`product_retailer_mappings` legat de variantă): tabelul rămâne cum e, nefolosit.
- Bonurile fiscale (`.tasks/005`): potrivirea pe variante vine după ce lucrarea aceasta e pe producție.

## Restricții
- Datele existente rămân valide: `variant_id` lipsă înseamnă produsul generic, ca acum. Migrația doar adaugă (tabel nou și coloane nulabile).
- Gramajul, marca și codul de bare vin doar de la om; câmpurile goale rămân `null`.
- RLS după modelul catalogului: citire `can_read(household_id)`, scriere `can_write(household_id)`, deci globalul îl scriu doar `app_admins`. Referințele verificate cu `check_household_refs` (varianta unei gospodării nu se folosește în alta). Ștergere logică.
- Textele noi se aprobă într-un singur chestionar (etapa 4).

## Model
- **`product_variants`** (nou): `household_id` (NULL = global), `product_id`, `brand_id` (→ `brands`, tabelul există și e gol), `name` (denumirea comercială), `net_quantity` + `net_unit` (ex. 300 g; nulabile), `ean` (nulabil, unic pe gospodărie/global, ca la `products`).
- **`variant_id`** (nulabil) pe `shopping_list_items`, `shopping_transaction_items` și `product_prices`.
- **Prețul pe kg:** un preț pe variantă cu `quantity`/`unit` în bucăți sau pachete se convertește prin `net_quantity`; un preț deja în grame se folosește direct.
- **Estimarea:** o linie cu variantă folosește întâi prețurile variantei, apoi pe ale produsului generic (ordinea de acum: magazin, sursă, promoție, vechime). O linie fără variantă folosește toate prețurile produsului, ca acum.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Logica** (`src/lib/domain/variants.ts`, pură): tipul `ProductVariant`; prețul pe kg al unei variante; conversia pachet/bucată ↔ g prin `net_quantity`; estimarea care preferă prețurile variantei (în `pricing.ts`); comparația pe mărci. Teste cu date fixe. | gata | (vezi PR) |
| 2 | **Baza de date:** migrația `product_variants` + `variant_id` pe cele 3 tabele, indexuri, RLS, `check_household_refs`, `touch_updated_at`, `keep_household_id`. Teste RLS în `supabase/tests/` (membru, alt membru, admin global, referință din altă gospodărie). `npm run test:db`. Documentația schemei. | gata (PR #57) | |
| 3 | **Local și sincronizare:** versiune nouă Dexie, `product_variants` în `SYNCED_TABLES`, copia de siguranță (export/import), serviciile (adaugă/editează/șterge variantă; `variant_id` la linia din listă, la finalizare și la prețuri). Teste unitare și `e2e-cloud`. | gata (testul `e2e-cloud` trece la etapa 4: are nevoie de ecrane) | (vezi PR) |
| 4 | **Ecranele:** în fișa produsului din listă, „Marca și ambalajul” (opțional) cu „Variantă nouă” (marcă, denumire, gramaj, cod de bare); în Buget → Prețuri, prețul pe kg pe mărci și alegerea variantei la un preț nou; adminul adaugă variante globale în `/admin`. Textele: un chestionar. E2E, capturi doar pentru ecranele noi. | de făcut | |
| 5 | **Producția:** migrația cu acordul proprietarului, apoi integrarea; verificare pe telefon. | de făcut | |

## Rezumat pe etape
### Etapa 1 (18 oct. 2026)
- **Tipuri** (`types.ts`): `ProductVariant` (`product_id`, `brand_id`, `name`, `net_quantity`, `net_unit`, `ean`); `variant_id` opțional pe `ProductPrice`, `ShoppingListItem`, `ShoppingTransactionItem` (lipsă = produsul generic, deci rândurile vechi rămân valide).
- **Conversia** `convertWithVariant` (`units.ts`): unitățile de ambalaj (`PACKAGE_UNITS`: buc, pachet, borcan, sticlă, cutie, conservă, pungă, plic, caserolă) se transformă prin conținutul net (g, kg, ml, l). Fără gramaj, sau aceeași unitate fără variantă cerută, rămâne conversia de acum (1 pachet = 1 pachet). Variantele șterse nu dau gramajul.
- **Estimarea** (`pricing.ts`): `buildPriceIndex(prețuri, factori, variante)`; `PriceOptions.variant_id`: prețurile variantei au întâietate, apoi toate prețurile produsului, în ordinea de acum (magazin, sursă, promoție, vechime). Presupunere: „apoi ale produsului generic” = toate prețurile produsului (și ale altor mărci), ca la o linie fără variantă. `UnitPrice.variant_id` spune de unde e prețul. `lineEstimate` și `compareRetailers` trimit varianta liniei.
- **Mărcile** (`variants.ts`): `basePrice` (lei/kg sau lei/l; lichidele pe litru), `compareVariants` (cel mai recent preț obișnuit al fiecărei variante, promoția doar dacă nu e altul; prețurile fără variantă ca rând „generic”; cel mai ieftin primul; din orice magazin), `variantLabel` („Sissi, Șuncă de pui, 300 g”), `variantsOf`.
- **Teste:** `variants.test.ts` (14), inclusiv exemplul din „Cum verific”: 21 lei / pachet de 300 g → 70 lei/kg, iar linia cu varianta e estimată la 21 lei. `npm test`: 482 trec; `npm run build` reușit.
- `verificare`: nimic blocant; reparate: 1 buc rămâne 1 buc la produsele cu greutate pe bucată, variantele șterse ignorate.

### Etapa 2 (18 oct. 2026)
- Migrația `20261018000001_product_variants.sql`: tabelul `product_variants` (conținutul net: ambele sau niciunul, doar g/kg/ml/l; `ean` unic pe gospodărie/global), triggerele obișnuite, RLS ca la catalog, fără `DELETE` nici ca drept, în Realtime; `variant_id` pe cele 3 tabele, în `check_household_refs`; `check_variant_product` cere ca varianta să fie a produsului de pe rând.
- `supabase/tests/product-variants.test.ts` (8). `npm run test:db`: 55 trec. `DATABASE_SCHEMA.md` la zi. **Producția nu e atinsă.**

### Etapa 3 (18 oct. 2026)
- Dexie versiunea 3 (`product_variants: "&id, household_id, product_id"`); tabelul în `SYNCED_TABLES` (după `products`), `CATALOG_TABLES` și `OPTIONAL_TABLES` (tragerea îl sare până e migrația pe server). `net_quantity` vine numeric. Copia de siguranță le ia singură (legăturile `*_id` se mută în altă gospodărie).
- Servicii (`catalog.ts`): `createVariant` (marca după nume, refolosită sau adăugată; varianta globală doar la produs global; cod de bare unic), `updateVariant`, `deleteVariant`, `variantField` (varianta trebuie să fie a produsului).
- `variant_id` în `addItem` (se unește doar cu linia aceleiași variante), `updateItem` (la alt produs, varianta se scoate), `finalizeShopping`, `setTransactionItemAmount`, `recordPrice`; `priceIndex` cu variante.
- **Ordinea pentru producție:** rândurile fără variantă nu trimit deloc `variant_id`, deci etapa 3 se poate integra înainte de migrație. Ecranele (etapa 4) se integrează doar după migrația pe producție (etapa 5).
- Mesajele noi din servicii (de aprobat la etapa 4, în același chestionar): „Scrie și cantitatea, și unitatea ambalajului (de exemplu 300 g).”, „Codul de bare e deja la altă variantă.”, „Produsul nu e în catalogul comun.”, „Varianta nu mai există.”, „Varianta aleasă nu mai există la acest produs.”, „Marca poate avea cel mult 80 de caractere.”, „Numele de pe ambalaj nu poate fi gol.”
- Teste: `src/lib/services/variants.test.ts` (9), inclusiv „Cum verific” cap-coadă în baza locală. `npm test`: 491.
- `verificare`: reparat (blocant pentru producție): `updateItem` cu `variant_id: null` pe o linie fără variantă nu mai trimite câmpul.

## După prima versiune (decizii separate)
- **Scanarea codului de bare** cu camera telefonului (bibliotecă nouă, teste pe Android și iPhone reale).
- **Open Food Facts** după cod de bare: propune numele și gramajul, tu confirmi (licență ODbL, cu atribuire; cere acces la rețea).
- **Variante în cămară** (ce marcă ai acasă) și potrivirea bonurilor fiscale pe variante.

## De ce are nevoie de la proprietar
- **Etapa 4:** aprobarea textelor noi.
- **Etapa 5:** acordul pentru migrația pe producție.

## Cum verific la final
Pe telefon: adaugi „Sissi, Șuncă de pui, 300 g” la linia de șuncă din listă, plătești 21 lei, termini cumpărăturile. În Buget → Prețuri, la Șuncă presată, apare 70,00 lei/kg pentru Sissi. Data viitoare, linia cu aceeași variantă e estimată la 21 lei.

## Următorul pas
Etapa 4: ecranele și chestionarul cu textele.
