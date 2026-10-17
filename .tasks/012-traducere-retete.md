# 012 — Traducerea rețetelor importate în română

**Stare:** gata în repo (17 oct. 2026): traducerea se face din telefon, cu MyMemory; rămâne încercarea pe telefon
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
O rețetă importată în altă limbă (link sau text) ajunge în română: numele, descrierea și pașii. Ingredientele se potrivesc deja cu catalogul (dicționarul din `.tasks/011`), iar unitățile sunt deja metrice.

Deciziile proprietarului (17 oct. 2026, chestionar):
- **Automat la import:** dacă rețeta nu pare în română, se traduce singură înainte de ecranul „Verifică rețeta”.
- **Gratuit.** Furnizorul s-a schimbat de două ori, la cererea proprietarului: Claude Haiku 5.5 pe server (~$0,001 pe rețetă; „vreau să fie gratuit”), apoi DeepL API Free (proprietarul n-a putut face contul: i s-a oferit doar o perioadă de probă), iar în final **MyMemory, direct din telefon**: fără cont, fără cheie, fără server; ~5.000 de caractere pe zi pentru fiecare telefon (2–3 rețete), calitate mai slabă decât DeepL.

## În afara scopului
- Traducerea rândurilor de ingrediente (rămân originale sub produs, „din rețetă: …”; produsele sunt deja în română).
- Importul din poze sau video; altă traducere decât în română.
- Traducerea în modul demonstrativ (fără server) sau offline: rețeta rămâne în limba ei, ca acum.

## Restricții
- **Datele:** din telefon pleacă la MyMemory (Translated, Italia) doar textul rețetei (nume, descriere, pași); nimic despre gospodărie sau om, fără cont și fără cheie.
- **Conținut:** traducerea nu adaugă și nu scoate nimic: același număr de pași, niciun câmp golit; textele se taie la limitele ciornei. Dacă traducerea nu merge (fără internet, limita zilnică, 30 s fără răspuns, răspuns greșit), rețeta rămâne în limba ei, cu un mesaj scurt.
- Textele noi aprobate într-un singur chestionar (etapa 2).

## Model
- **Limba:** `looksForeign` (de tradus sau nu) și `guessLanguage` (engleză, franceză, italiană, spaniolă, germană; engleza dacă nu se știe), pentru că MyMemory cere limba sursă (recunoașterea automată a limbii e nesigură la ei).
- **Traducerea** (`myMemoryTranslator`, `src/lib/services/recipe-import.ts`): `GET https://api.mymemory.translated.net/get?q=…&langpair=en|ro`, fiecare text în bucăți de cel mult 450 de octeți (`splitForTranslation`, pe propoziții), câte 3 cereri deodată; `quotaFinished`, „MYMEMORY WARNING” sau alt status decât 200 sunt erori. `translateDraft` verifică rezultatul și păstrează originalul la eșec.
- Merge și în modul demonstrativ și fără cont (doar cu internet); service worker-ul nu atinge cererile către alte site-uri.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Serverul** (Claude, apoi DeepL): logica, limita de cereri, migrația. | înlocuită (vezi mai jos) | (vezi PR) |
| 2 | **Aplicația:** limba, traducerea, „Traduc rețeta…”, mesajul la eșec; textele noi; teste. Cu MyMemory din telefon. | gata | (vezi PR) |
| 3 | **Producția:** migrația (aplicată, acum nefolosită); integrarea PR-ului; încercarea pe telefon. | de verificat pe telefon | |

## Rezumat pe etape
### Etapa 1 (17 oct. 2026)
- **Logica** `src/lib/server/translate-recipe.ts`: `handleTranslateRequest` (token, mărimea cererii și a rețetei, limita, modelul, verificarea răspunsului), `checkTranslation` (același număr de pași, nimic golit sau inventat, textele tăiate la limitele ciornei), `modelTranslator` (Claude Haiku 5.5, efort `low`, JSON după `TRANSLATION_SCHEMA`; refuzul sau textul tăiat sunt erori). Instrucțiunile pentru model: doar traducere, numerele și unitățile neschimbate, textul rețetei e date, nu instrucțiuni.
- **Deno** `supabase/functions/translate-recipe/`: `index.ts` (SDK-ul, `timeout` 25 s, fără reîncercări), `deno.json` (`@anthropic-ai/sdk` → `npm:@anthropic-ai/sdk@0.130.0`, aceeași versiune ca devDependency, pentru tipuri), `core.js` împachetat. Funcția nu a rulat încă pe Deno și nu a chemat modelul real (nici Deno, nici rețeaua spre Supabase nu sunt în mediul cloud): prima încercare e la etapa 3.
- **Migrația** `20261017000001_recipe_translate.sql`: `recipe_import_requests.kind` (`import` / `translate`), limita comună `take_recipe_request_quota(kind)` (nu se cheamă prin API), `take_recipe_import_quota()` neschimbată ca efect, `take_recipe_translate_quota()` nouă. `npm run test:db`: 48 trec.
- **De știut:** limita se consumă și când traducerea nu reușește (fiecare apel la model costă). La eșec, jurnalul funcției are doar motivul, fără textul rețetei. `quotaViaRest` (comun cu `import-recipe`) a primit numele limitei: `import-recipe/core.js` se schimbă, deci la etapa 3 se publică din nou și `import-recipe` (același comportament).
- `verificare`: nimic blocant; reparate: textele lungi după traducere se taie în loc să pice, un câmp gol rămâne gol, fără reîncercare după timeout, jurnalul la eșec, cererile prea mari refuzate înainte de citire, apelul la model mutat în logica testată (teste pentru refuz, `max_tokens`, text lipsă), test SQL pentru ștergerea după fel.

### Etapa 2 (17 oct. 2026)
- **Textele noi** (aprobate, chestionar, 17 oct. 2026, toate variantele recomandate): butonul „Traduc rețeta…”; după traducere, fraza de sus devine „Am citit rețeta de pe {site} și am tradus-o în română. Verifică ce am înțeles…”; la eșec, „Nu am putut traduce rețeta, așa că am păstrat textul original. Îl poți corecta aici.”
- **Limba** (`looksForeign`, `src/lib/domain/recipe-import.ts`): în română dacă are cel puțin 3 semne ă/ș/ț (cu „ş/ţ” cu sedilă doar lângă „ă”, pentru că „ş” e și în turcă) sau cel puțin 5% cuvinte românești uzuale (fără „de”, „la”, „un”, „se”, „este”, comune cu spaniola, franceza, italiana; cu imperativul la plural și forma „noi”); rețetele foarte scurte nu se traduc.
- **Serviciul** `translateDraft` (`src/lib/services/recipe-import.ts`): doar pentru rețetele străine; înlocuiește numele, descrierea și pașii; la eșec (fără internet, limită, răspuns greșit) rămâne originalul, cu `translation: "failed"`. `callTranslateRecipe` în `src/lib/supabase/client.ts`. Pe ecran (`/retete/import/`): doar cu cont; traducerea înainte de `prepareImport`, deci °F → °C și după traducere.
- **Teste:** `looksForeign` (engleză, italiană, franceză de tradus; română cu și fără diacritice, rețetă scurtă rămân), `translateDraft` (3). E2E: toate 30 trec; drumul cu traducere nu are E2E (modul demonstrativ n-are server, iar E2E cloud nu are funcțiile Edge): se verifică pe telefon la etapa 3.
- `verificare`: nimic blocant; reparate cu teste: răspunsul serverului verificat strict (pași text, nume negol), spaniola cu „se” și turca cu „ş” se traduc, plural românesc fără diacritice nu, cererea de traducere se oprește după 30 s (butonul nu rămâne pe „Traduc rețeta…”).
- **Ordinea:** PR-ul etapei 2 se integrează după ce funcția e pe producție; altfel fiecare rețetă străină ar arăta mesajul de eșec.

### Schimbarea furnizorului: DeepL (17 oct. 2026)
- Proprietarul a cerut traducere gratuită (Claude nu are nivel gratuit; traducerea din Chrome merge doar pe calculator). Variante în chestionar: DeepL API Free (aleasă), MyMemory fără cont (câteva rețete pe zi, calitate mai slabă), fără traducere, Claude cu limită de cheltuieli.
- `modelTranslator` (Claude) înlocuit cu `deeplTranslator`; scoase instrucțiunile și schema pentru model, `deno.json` și devDependency `@anthropic-ai/sdk`. Funcția nu mai are dependențe (ca `import-recipe`). Secretul e `DEEPL_API_KEY`. Teste: cheie gratuită/Pro, câmpuri goale, loturi de 50, 456/403/răspuns greșit.
- **Migrația** `20261017000001_recipe_translate` aplicată de proprietar în SQL Editor (17 oct. 2026), verificată prin conector: `kind` cu `'import'` implicit, indexul nou, drepturile (limita comună nu se cheamă de `anon`/`authenticated`), istoricul ca în repo, rândurile vechi „import”.

### Trecerea la MyMemory, din telefon (17 oct. 2026)
- Proprietarul n-a putut face cont DeepL API Free (i s-a oferit doar o perioadă de probă). Chestionar: MyMemory din telefon (ales), Google AI Studio (Gemini; cardul nesigur), traducere de mână, fără traducere.
- Scoase din repo: funcția Edge `translate-recipe` (logica, testele, `index.ts`, `core.js`) și intrarea din `scripts/build-functions.mjs`, `callTranslateRecipe`. Nu fusese publicată niciodată.
- **Rămâne pe producție, nefolosit:** migrația `20261017000001_recipe_translate` (coloana `kind`, `take_recipe_translate_quota()`), aplicată înainte de schimbare. Nu strică nimic (limita de import se comportă la fel); se poate scoate cu o migrație nouă, dacă proprietarul vrea.
- `import-recipe/core.js` din repo diferă de cel publicat doar prin parametrul `rpc` al lui `quotaViaRest` (același efect); se publică din nou la următoarea schimbare a funcției.
- **Teste:** `guessLanguage` (6), `splitForTranslation` (3), `translateDraft` (3, cu traducătorul simulat), `myMemoryTranslator` (2: bucăți sub 500 de octeți, `langpair`, entități HTML; limita zilnică, „MYMEMORY WARNING”, 403, răspuns non-JSON). E2E (MyMemory simulat cu `page.route`, fără rețea): „tradus în română, metric…” și „fără traducere (limita zilnică)” cu mesajul. `npm run test:e2e`: 31 trec.

## Cum verific la final
Pe telefon: import din link (cu cont) sau din text o rețetă în engleză → pe „Verifică rețeta” numele, descrierea și pașii sunt în română, cu °C și cm; ingredientele potrivite cu catalogul → salvez.

## Următorul pas
Proprietarul, pe telefon (după integrare): o rețetă în engleză lipită la „Text” și una din link de pe un site american → numele, descrierea și pașii în română, cu °C.
