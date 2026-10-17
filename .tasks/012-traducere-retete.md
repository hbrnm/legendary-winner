# 012 — Traducerea rețetelor importate în română

**Stare:** în lucru (etapa 1)
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
| 1 | **Serverul:** logica, schema, instrucțiunile pentru model, limitele, testele (fără rețea); migrația pentru limită + `npm run test:db`; `index.ts` cu SDK-ul. | în lucru | |
| 2 | **Clientul:** recunoașterea limbii, apelul, „Traduc rețeta…”, mesajul la eșec; textele noi într-un chestionar; teste. | de făcut | |
| 3 | **Producția:** migrația, secretul (proprietarul, din panou), publicarea funcției, încercarea pe telefon. | de făcut | |

## Cum verific la final
Pe telefon, cu cont: import din link o rețetă de pe un site american → pe „Verifică rețeta” numele, descrierea și pașii sunt în română, cu °C și cm; ingredientele potrivite cu catalogul → salvez.

## Următorul pas
Etapa 1.
