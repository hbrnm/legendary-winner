# 009 — Importul rețetelor de pe site-uri și din texte

**Stare:** în lucru; etapele 1–3 gata (doar în repo, nu pe producție).
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
| 1 | **Logica:** parsarea JSON-LD `Recipe` (inclusiv `@graph`, `HowToStep`/`HowToSection`, durate ISO 8601) și a textului lipit; citirea ingredientelor (cantitate, unitate, nume) în română și engleză; potrivirea cu catalogul. Teste cu pagini și texte salvate ca fixturi (fără rețea). | gata | (vezi PR) |
| 2 | **Serverul:** funcția Edge `import-recipe` (fetch sigur, extrage JSON-LD, întoarce `RecipeDraft`); teste pentru SSRF, limite, pagini fără rețetă. Migrația `recipes.source_url`. `npm run test:db`. | gata (în repo) | (vezi PR) |
| 3 | **Ecranele:** „Importă rețetă” (link sau text), confirmarea cu ingredientele, salvarea; sursa pe pagina rețetei. E2E în modul demonstrativ (cu serverul simulat). | gata | (vezi PR) |
| 4 | **Textele + partajarea:** chestionarul cu textele noi; `share_target` pe Android. | de făcut | |
| 5 | **Producția:** migrația și funcția Edge cu acordul proprietarului; verificare pe Android și iPhone cu 3–4 site-uri românești reale. | de făcut | |

### Etapa 2 (16 oct. 2026)
- **Logica** în `src/lib/server/import-recipe.ts` (testată cu Vitest, fără rețea): `handleImportRequest` primește `POST {"url"}` cu tokenul omului și întoarce `{draft}` sau `{error}`, cu un cod pentru ecran: `bad_request`, `unauthorized`, `rate_limited`, `invalid_url`, `blocked_address`, `fetch_failed`, `timeout`, `too_large`, `not_html`, `no_recipe`. CORS deschis (tokenul vine în antet, fără cookie-uri).
- **SSRF:** doar `https`, fără port, utilizator sau parolă, cu domeniu; toate adresele DNS (A și AAAA) ale numelui trebuie să fie publice (fără 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 100.64/10, multicast, documentație; la IPv6 doar 2000::/3, fără 6to4, Teredo și documentație). Redirecționările se urmează de mână (max. 3), fiecare verificată din nou. **Limită cunoscută:** `fetch` din Deno rezolvă numele încă o dată, deci un DNS care se schimbă între verificare și descărcare (DNS rebinding) nu e prins; riscul e mic (funcția nu are secrete și nu vede rețeaua internă a proiectului), dar e de știut.
- **Limite:** 10 s pentru tot (și pentru DNS), 5 s pentru limita de cereri, 3 MB pagina (după antet și pe măsură ce sosește), doar `text/html` / `application/xhtml+xml` (sau fără `Content-Type`); codarea din antet sau din `<meta charset>` (site-urile vechi, windows-1250). Pagina nu se păstrează.
- **Limita de cereri:** 20 pe oră de om, în baza de date: `take_recipe_import_quota()` (security definer, doar `authenticated`), chemată prin PostgREST cu tokenul omului, înainte de descărcare. Tabelul `recipe_import_requests` nu se citește prin API; cererile mai vechi de o zi se șterg la următoarea cerere.
- **Migrația** `20261016000001_recipe_import.sql`: `recipes.source_url` (nulabilă, doar `https://`, max. 500), tabelul și funcția de mai sus. Teste: `supabase/tests/recipe-import.test.ts` (5).
- **Deno:** `supabase/functions/import-recipe/index.ts` leagă rețeaua, DNS-ul (`Deno.resolveDns`) și limita; logica e în `core.js`, împachetat cu esbuild (`npm run build:functions`, `esbuild` devDependency la versiunea deja din proiect). Testul `scripts/build-functions.test.ts` cere ca `core.js` să fie la zi. Deno și CLI-ul Supabase nu sunt în mediul cloud: pachetul e verificat doar cu Node (modul ES), iar funcția se încearcă prima dată la etapa 5.
- `source_url` nu e încă în tipul `Recipe` din client (etapa 3); sincronizarea nu validează strict, deci coloana nouă nu strică nimic.

### Etapa 3 (16 oct. 2026)
- **`/retete/import/`:** „Link” sau „Text” → „Citește rețeta” → același formular ca la „Rețetă nouă”, cu titlul „Verifică rețeta”. Butonul „Importă” e lângă „Rețetă nouă”, în lista de rețete. Linkul merge doar cu cont (în modul demonstrativ nu există server): în locul lui apare un mesaj, iar textul lipit merge oricum, și offline.
- **Formularul** (`src/components/recipes/recipe-editor.tsx`, mutat din pagina de editare): ingredientele potrivite au sub nume rândul din rețetă și butonul „Schimbă”. Cele nepotrivite apar „De ales”, cu variantele propuse (doar alimente), căutarea în catalog sau „Creează produsul” (produs al gospodăriei, doar categorii de alimente). Un număr fără unitate („1 ceapă”) înseamnă bucăți. Salvarea cere produs pentru fiecare ingredient. La modificarea unei rețete, sursa rămâne cea de la import.
- **Serviciul** `src/lib/services/recipe-import.ts`: `prepareImport` (citire + potrivire), `draftFromPastedText`, `draftFromLink` (codurile serverului → mesaje). Cererea către funcție: `callImportRecipe` în `src/lib/supabase/client.ts`, cu tokenul sesiunii.
- **Pagina rețetei:** „Sursa: exemplu.ro”, legătură în altă filă (`noopener noreferrer nofollow`).
- **Teste:** `recipe-import.test.ts` (servicii, 5), `e2e/import-retete.spec.ts` (text → ingredient de ales → produs nou → salvare; linkul fără cont), `/retete/import/` în testul de lățime (360 px). Nu am făcut test de componentă pentru păstrarea sursei la modificare: în proiect nu există încă testele de componentă cu aplicația simulată, iar modul demonstrativ nu poate importa din link. Se verifică la etapa 5, pe producție.
- **Textele noi (de aprobat la etapa 4):** „Importă”, „Importă rețetă”, „De unde iei rețeta”, „Link” / „Text”, „Linkul rețetei” (+ indiciul despre Instagram/TikTok/Facebook), „Textul rețetei” (+ indiciul), „Importul din link merge când ești conectat cu cont…”, „Citește rețeta” / „Citesc rețeta…”, „Verifică rețeta”, „Am citit rețeta de pe {site}. Verifică ce am înțeles…”, „din rețetă: …”, „Schimbă”, „De ales:”, „Un ingredient nu are încă produsul ales.” / „{n} ingrediente…”, „Caută produsul în catalog”, „Nu e în catalog? Creează produsul”, „Adaugă produsul”, „Alege categoria”, „Alege produsul pentru fiecare ingredient sau scoate-l din rețetă.”, „Sursa:”, „Adresa sursei nu e validă.”, mesajul pentru textul fără rețetă și mesajele de eroare din `IMPORT_ERROR_MESSAGES`.

## De ce are nevoie de la proprietar
- **Etapa 4:** aprobarea textelor noi.
- **Etapa 5:** acordul pentru migrație și pentru funcția Edge pe producție.

## Cum verific la final
Pe telefon: lipesc linkul unei rețete de pe un site românesc → văd numele, porțiile, ingredientele (majoritatea potrivite automat) și pașii → aleg produsele lipsă → salvez; rețeta apare la „Rețetele mele”, cu sursa. Lipesc descrierea unei rețete de pe Instagram → o corectez → o salvez.

## Următorul pas
Etapa 4: chestionarul cu textele noi (lista de la etapa 3) și `share_target` pe Android.
