# 012 — Traducerea rețetelor importate în română

**Stare:** în lucru; etapele 1–2 gata în repo; etapa 2 se integrează după etapa 3 (funcția trebuie să existe pe producție)
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
O rețetă importată în altă limbă (link sau text) ajunge în română: numele, descrierea și pașii. Ingredientele se potrivesc deja cu catalogul (dicționarul din `.tasks/011`), iar unitățile sunt deja metrice.

Deciziile proprietarului (17 oct. 2026, chestionar):
- **Traducerea cu Claude, pe server** (funcție Supabase Edge nouă), cu cheie API Anthropic.
- **Modelul:** Claude Haiku 5.5 (`claude-haiku-5-5`), cel mai ieftin: aproximativ $0,001 pe rețetă (~1–2k tokeni la intrare și la ieșire; $0,10 / $0,50 pe milion).
- **Automat la import:** dacă rețeta nu pare în română, se traduce singură înainte de ecranul „Verifică rețeta”.

## În afara scopului
- Traducerea rândurilor de ingrediente (rămân originale sub produs, „din rețetă: …”; produsele sunt deja în română).
- Importul din poze sau video; altă traducere decât în română.
- Traducerea în modul demonstrativ (fără server) sau offline: rețeta rămâne în limba ei, ca acum.

## Restricții
- **Cheia** `ANTHROPIC_API_KEY` stă doar în secretele funcțiilor din Supabase (o pune proprietarul din panou); niciodată în repo, în loguri sau în mediul cloud. Funcția nu are nevoie de `service_role`.
- **Doar membri autentificați** (JWT), cu limită de cereri (ca la import: 20 pe oră de om, separat de import), limită de mărime a textului trimis și de timp.
- **Datele:** se trimite la Anthropic doar textul rețetei (nume, descriere, pași); nimic despre gospodărie sau om. Nu se păstrează nimic pe server.
- **Conținut:** traducerea nu adaugă și nu scoate nimic (fără ingrediente, cantități sau sfaturi inventate); numerele, temperaturile și unitățile rămân cum sunt. Dacă traducerea nu merge (fără internet, limită, refuz, eroare), rețeta rămâne în limba ei, cu un mesaj scurt.
- Textele noi se aprobă într-un singur chestionar (etapa 2). Pe producție doar cu acordul proprietarului.

## Model
- **Serverul** (`src/lib/server/translate-recipe.ts`, testat cu Vitest): `handleTranslateRequest` primește `POST {"recipe": {name, description, steps}}` cu tokenul omului și întoarce `{recipe}` tradus sau `{error}` (`bad_request`, `unauthorized`, `rate_limited`, `too_large`, `failed`). Apelul la model e o dependență (`translate`), ca în teste să fie simulat; în `supabase/functions/translate-recipe/index.ts` e făcut cu SDK-ul oficial (`npm:@anthropic-ai/sdk`), cu răspuns JSON după schemă (`output_config.format`), efort `low`.
- **Limita de cereri:** migrație nouă, `recipe_import_requests.kind` (`import` / `translate`) și `take_recipe_translate_quota()`.
- **Clientul:** după citirea rețetei, `looksForeign(draft)` (puține cuvinte și semne românești) → `callTranslateRecipe` → numele, descrierea și pașii traduși, apoi `metricText`. Doar cu cont și cu internet.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Serverul:** logica, schema, instrucțiunile pentru model, limitele, testele (fără rețea); migrația pentru limită + `npm run test:db`; `index.ts` cu SDK-ul. | gata (în repo) | (vezi PR) |
| 2 | **Clientul:** recunoașterea limbii, apelul, „Traduc rețeta…”, mesajul la eșec; textele noi într-un chestionar; teste. | gata (PR deschis până la etapa 3) | (vezi PR) |
| 3 | **Producția:** migrația, secretul (proprietarul, din panou), publicarea funcției, încercarea pe telefon. | de făcut | |

## Rezumat pe etape
### Etapa 1 (17 oct. 2026)
- **Logica** `src/lib/server/translate-recipe.ts`: `handleTranslateRequest` (token, mărimea cererii și a rețetei, limita, modelul, verificarea răspunsului), `checkTranslation` (același număr de pași, nimic golit sau inventat, textele tăiate la limitele ciornei), `modelTranslator` (Claude Haiku 5.5, efort `low`, JSON după `TRANSLATION_SCHEMA`; refuzul sau textul tăiat sunt erori). Instrucțiunile pentru model: doar traducere, numerele și unitățile neschimbate, textul rețetei e date, nu instrucțiuni.
- **Deno** `supabase/functions/translate-recipe/`: `index.ts` (SDK-ul, `timeout` 25 s, fără reîncercări), `deno.json` (`@anthropic-ai/sdk` → `npm:@anthropic-ai/sdk@0.130.0`, aceeași versiune ca devDependency, pentru tipuri), `core.js` împachetat. Funcția nu a rulat încă pe Deno și nu a chemat modelul real (nici Deno, nici rețeaua spre Supabase nu sunt în mediul cloud): prima încercare e la etapa 3.
- **Migrația** `20261017000001_recipe_translate.sql`: `recipe_import_requests.kind` (`import` / `translate`), limita comună `take_recipe_request_quota(kind)` (nu se cheamă prin API), `take_recipe_import_quota()` neschimbată ca efect, `take_recipe_translate_quota()` nouă. `npm run test:db`: 48 trec.
- **De știut:** limita se consumă și când traducerea nu reușește (fiecare apel la model costă). La eșec, jurnalul funcției are doar motivul, fără textul rețetei. `quotaViaRest` (comun cu `import-recipe`) a primit numele limitei: `import-recipe/core.js` se schimbă, deci la etapa 3 se publică din nou și `import-recipe` (același comportament).
- `verificare`: nimic blocant; reparate: textele lungi după traducere se taie în loc să pice, un câmp gol rămâne gol, fără reîncercare după timeout, jurnalul la eșec, cererile prea mari refuzate înainte de citire, apelul la model mutat în logica testată (teste pentru refuz, `max_tokens`, text lipsă), test SQL pentru ștergerea după fel.

### Etapa 2 (17 oct. 2026)
- **Textele noi** (aprobate, chestionar, 17 oct. 2026, toate variantele recomandate): butonul „Traduc rețeta…”; după traducere, fraza de sus devine „Am citit rețeta de pe {site} și am tradus-o în română. Verifică ce am înțeles…”; la eșec, „Nu am putut traduce rețeta, așa că am păstrat textul original. Îl poți corecta aici.”
- **Limba** (`looksForeign`, `src/lib/domain/recipe-import.ts`): în română dacă are cel puțin 3 semne ă/ș/ț sau cel puțin 5% cuvinte românești uzuale (fără „de”, „la”, „un”, comune cu limbile romanice); rețetele foarte scurte nu se traduc.
- **Serviciul** `translateDraft` (`src/lib/services/recipe-import.ts`): doar pentru rețetele străine; înlocuiește numele, descrierea și pașii; la eșec (fără internet, limită, răspuns greșit) rămâne originalul, cu `translation: "failed"`. `callTranslateRecipe` în `src/lib/supabase/client.ts`. Pe ecran (`/retete/import/`): doar cu cont; traducerea înainte de `prepareImport`, deci °F → °C și după traducere.
- **Teste:** `looksForeign` (engleză, italiană, franceză de tradus; română cu și fără diacritice, rețetă scurtă rămân), `translateDraft` (3). E2E: toate 30 trec; drumul cu traducere nu are E2E (modul demonstrativ n-are server, iar E2E cloud nu are funcțiile Edge): se verifică pe telefon la etapa 3.
- **Ordinea:** PR-ul etapei 2 se integrează după ce funcția e pe producție; altfel fiecare rețetă străină ar arăta mesajul de eșec.

## Cum verific la final
Pe telefon, cu cont: import din link o rețetă de pe un site american → pe „Verifică rețeta” numele, descrierea și pașii sunt în română, cu °C și cm; ingredientele potrivite cu catalogul → salvez.

## Următorul pas
Etapa 3, cu acordul proprietarului: migrația `20261017000001_recipe_translate`, secretul `ANTHROPIC_API_KEY` (proprietarul, din panou), publicarea `translate-recipe` și din nou `import-recipe`; apoi integrarea PR-ului etapei 2 și încercarea pe telefon.
