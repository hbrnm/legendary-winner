# 009 — Importul rețetelor de pe site-uri și din texte

**Stare:** plan; începe după `.tasks/008` (fotografiile), într-o sesiune nouă.
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
Gospodăria își aduce în Cămara o rețetă găsită pe un site sau pe o rețea socială, fără s-o rescrie: lipește linkul sau textul, verifică ce a înțeles aplicația și salvează rețeta ca rețetă a gospodăriei.

Deciziile proprietarului (12 oct. 2026, chestionar):
- **Prima versiune:** link de site + text lipit. Linkul merge la site-urile care au rețeta în format standard (schema.org `Recipe`, JSON-LD); pentru rețele sociale (Instagram, TikTok, Facebook) se lipește descrierea, iar aplicația o împarte în ingrediente și pași, de corectat de mână.
- **Ingredientele care nu se potrivesc cu catalogul:** le alege omul pe ecranul de confirmare (caută produsul sau creează unul al gospodăriei). Cele potrivite automat sunt deja bifate.
- **Ordinea:** după `.tasks/008` (etapele 3–6).

## În afara scopului
- Citirea automată a Instagram / TikTok / Facebook după link (cer autentificare, termenii le interzic); doar textul lipit.
- Importul din poze sau din video (OCR, transcriere).
- Importul mai multor rețete deodată, sincronizarea cu site-ul sursă, propunerea rețetelor importate pentru catalogul global.
- Valorile nutriționale de pe site (rămân `null`, ca peste tot).

## Restricții
- Rețeta importată e a gospodăriei (`household_id` obligatoriu), privată; se notează sursa (URL-ul paginii), afișată pe rețetă. Nu se publică nimic mai departe.
- Serverul: o funcție Supabase Edge (`import-recipe`), prima din proiect. Primește doar URL-uri `https://`, refuză adrese private/locale (SSRF), limită de timp și de mărime a paginii, doar pentru membri autentificați (JWT), cu limită de cereri. Nu păstrează paginile. Pe producție doar cu acordul proprietarului.
- Fără chei secrete noi în repo; funcția nu are nevoie de `service_role`.
- Pe telefon: merge și offline pentru textul lipit (parsarea e în client); linkul cere internet, cu mesaj clar.
- Prețurile nu vin din import. Cantitățile și unitățile se păstrează doar dacă se pot citi sigur; altfel rămân `null` (cantitate „după gust”).
- Textele noi se aprobă într-un singur chestionar (etapa 4).

## Model
- **Logica pură** (`src/lib/domain/recipe-import.ts`): din JSON-LD `Recipe` sau din text → `RecipeDraft` (nume, descriere, porții, timpi, ingrediente ca text, pași, imagine ignorată, `source_url`). Ingredientele text → `{ quantity, unit, name, note }` („500 g carne tocată”, „2 linguri ulei”, „sare după gust”), apoi potrivire cu produsele prin căutarea existentă (`normalize`, sinonime).
- **`recipes.source_url`** (coloană nouă, nulabilă, https, max. 500) pentru a arăta de unde vine rețeta.
- **Ecranul de import:** câmp pentru link sau text → ecran de confirmare cu rețeta propusă; fiecare ingredient potrivit (bifat) sau de ales; „Salvează” scrie prin `saveRecipe` (validarea existentă).
- **Partajarea de pe telefon:** pe Android, `share_target` în manifest (Cămara apare la „Partajează”); pe iPhone, Safari nu-l suportă, deci se lipește linkul.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Logica:** parsarea JSON-LD `Recipe` (inclusiv `@graph`, `HowToStep`/`HowToSection`, durate ISO 8601) și a textului lipit; citirea ingredientelor (cantitate, unitate, nume) în română și engleză; potrivirea cu catalogul. Teste cu pagini și texte salvate ca fixturi (fără rețea). | de făcut | |
| 2 | **Serverul:** funcția Edge `import-recipe` (fetch sigur, extrage JSON-LD, întoarce `RecipeDraft`); teste pentru SSRF, limite, pagini fără rețetă. Migrația `recipes.source_url`. `npm run test:db`. | de făcut | |
| 3 | **Ecranele:** „Importă rețetă” (link sau text), confirmarea cu ingredientele, salvarea; sursa pe pagina rețetei. E2E în modul demonstrativ (cu serverul simulat). | de făcut | |
| 4 | **Textele + partajarea:** chestionarul cu textele noi; `share_target` pe Android. | de făcut | |
| 5 | **Producția:** migrația și funcția Edge cu acordul proprietarului; verificare pe Android și iPhone cu 3–4 site-uri românești reale. | de făcut | |

## De ce are nevoie de la proprietar
- **Etapa 4:** aprobarea textelor noi.
- **Etapa 5:** acordul pentru migrație și pentru funcția Edge pe producție.

## Cum verific la final
Pe telefon: lipesc linkul unei rețete de pe un site românesc → văd numele, porțiile, ingredientele (majoritatea potrivite automat) și pașii → aleg produsele lipsă → salvez; rețeta apare la „Rețetele mele”, cu sursa. Lipesc descrierea unei rețete de pe Instagram → o corectez → o salvez.

## Următorul pas
Etapa 1 (logica), după ce `.tasks/008` e gata.
