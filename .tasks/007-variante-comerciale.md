# 007 — Variante comerciale (marcă, ambalaj, cod de bare)

**Stare:** planul e gata; urmează etapa 1, într-o sesiune nouă.
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
| 1 | **Logica** (`src/lib/domain/variants.ts`, pură): tipul `ProductVariant`; prețul pe kg al unei variante; conversia pachet/bucată ↔ g prin `net_quantity`; estimarea care preferă prețurile variantei (în `pricing.ts`); comparația pe mărci. Teste cu date fixe. | de făcut | |
| 2 | **Baza de date:** migrația `product_variants` + `variant_id` pe cele 3 tabele, indexuri, RLS, `check_household_refs`, `touch_updated_at`, `keep_household_id`. Teste RLS în `supabase/tests/` (membru, alt membru, admin global, referință din altă gospodărie). `npm run test:db`. Documentația schemei. | de făcut | |
| 3 | **Local și sincronizare:** versiune nouă Dexie, `product_variants` în `SYNCED_TABLES`, copia de siguranță (export/import), serviciile (adaugă/editează/șterge variantă; `variant_id` la linia din listă, la finalizare și la prețuri). Teste unitare și `e2e-cloud`. | de făcut | |
| 4 | **Ecranele:** în fișa produsului din listă, „Marca și ambalajul” (opțional) cu „Variantă nouă” (marcă, denumire, gramaj, cod de bare); în Buget → Prețuri, prețul pe kg pe mărci și alegerea variantei la un preț nou; adminul adaugă variante globale în `/admin`. Textele: un chestionar. E2E, capturi doar pentru ecranele noi. | de făcut | |
| 5 | **Producția:** migrația cu acordul proprietarului, apoi integrarea; verificare pe telefon. | de făcut | |

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
Etapa 1, într-o sesiune nouă.
