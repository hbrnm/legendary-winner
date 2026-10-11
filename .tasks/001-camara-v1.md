# 001 — Cămara v1 (cumpărături, rețete, plan, buget, cămară)

**Stare:** în așteptare (proprietarul: criteriile 1–22)
**Ramura:** `claude/camara-v1` (pornită din `claude/configurare-camara`, care are `CLAUDE.md` și agenții)

## Scop
Aplicație completă pentru gospodăriile din România, după „Master prompt” (în conversația din 11 oct. 2026). Fluxul: plan → rețete → listă → cumpărături reale → buget → analiză. Mobil întâi, PWA, offline.

Decizii (11 oct. 2026):
- Proprietarul a cerut autonomie tehnică: fără întrebări pentru alegeri tehnice.
- **Gospodării cu membri și roluri** (owner/admin/member). Asta înlocuiește „un singur cont comun” din `CLAUDE.md`. `CLAUDE.md` NU e încă actualizat (vezi „De făcut”).
- Fără prețuri inventate: prețurile vin doar de la gospodărie (plătite, văzute, promoții).
- Fără resurse externe create în contul proprietarului (proiect Supabase, Vercel). Aplicația are integrarea completă și un **mod demonstrativ** local când lipsesc variabilele Supabase.

## În afara scopului (deocamdată)
- Notificări push trimise de server (cer chei VAPID). Există doar notificări locale, când aplicația e deschisă.
- Importul automat din cataloagele magazinelor (scraping interzis). Există import CSV controlat și introducere manuală.
- Fotografii reale pentru rețete. Există o ilustrație pe categorie și câmpul `image_url`.
- Valori nutriționale (nu se inventează; câmpul e `null`).

## Arhitectura, pe scurt
- **Next.js 16 static export** (`output: "export"`, `trailingSlash`), fără server propriu. Detaliile rețetelor și listelor se dau prin `?id=`.
- **Local-first:** datele stau în IndexedDB (Dexie, `src/lib/db`). Orice scriere trece prin `src/lib/db/write.ts`: rândul local plus o intrare în `outbox`.
- **Sincronizare** (`src/lib/sync/engine.ts`):
  - push în ordine (insert = upsert, update = doar câmpurile schimbate);
  - pull după `updated_at`, setat de server;
  - modificările netrimise se reaplică peste ce vine de la server;
  - ce refuză serverul se notează în `sync_errors` și se readuce la versiunea serverului.
- **Supabase**: migrația `supabase/migrations/20261011000001_schema.sql` (tabele, RLS pe `household_id`, funcții `create_household`, `accept_invitation`, `invitation_preview`, `transfer_ownership`, `household_member_list`). Ștergerile sunt logice (`deleted_at`). Catalogul global are `household_id NULL` și îl scriu doar `app_admins`.
- **Fără dublă numărare:** tura de cumpărături are un id determinist (`stableId(listă, tură)`). Cheltuiala reală = tranzacții finalizate + produse bifate din liste deschise (`spendRecords`).
- **Catalog**: `src/data` (471 de produse, 86 de rețete, 20 de categorii, 13 magazine). `npm run seed:sql` generează `supabase/seed.sql`, iar un test verifică că e la zi.
- **Logica pură** stă în `src/lib/domain`, serviciile în `src/lib/services`, ecranele în `src/app/*`, iar `AppProvider` în `src/components/app`.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | Nucleu de logică + teste | gata | 5c2cbea |
| 2 | Schema, RLS, catalog, seed | gata | c309d0d |
| 3 | Stocare locală, sincronizare, servicii | gata | 9deeb4f |
| 4 | Interfața completă + PWA | gata | 28e46ad |
| 5 | E2E (demo și cloud), Supabase local fără Docker, texte | gata | a7a169c + commit-ul „fix: E2E cloud” |
| 6 | Documentație, CLAUDE.md, CI, raport final | gata, în afară de criteriile 1–22 (așteaptă proprietarul) | vezi `git log` |

## Rezumat pe etape
### Etapele 1–4 (11 oct.)
Dovada, la ultima rulare:
- `npm test`: 97/97 trec (înainte de fișierul nou `text.test.ts`; după el, logica de domeniu: 66/66).
- `npm run test:db`: 24/24 trec (RLS și funcții, pe Postgres 16 local).
- `npm run build`: reușit (18 pagini statice; `sw.js` cu 56 de fișiere).
- `npx tsc --noEmit` și `npx eslint src`: curate.

### Etapa 5 (11 oct., neterminată)
- `e2e/` (Playwright, mod demonstrativ, pe `out/`) are 15 teste. Ultima rulare completă: 13 au trecut, apoi am corectat cele 2 care picau (selectori) și au trecut separat. NU am mai rulat toată suita după ultimele modificări de texte și de aspect (planul compact, cămara, `count()`).
- `scripts/local-supabase.mjs` pornește un Supabase minimal fără Docker: Postgres + Supabase Auth v2.169 + PostgREST 12.2.3 + proxy pe portul 54321. Binarele se descarcă în `.local-supabase/`, ignorat de git. Testul prin API a trecut: conturi, gospodărie, invitație, listă comună, RLS refuză contul străin, catalog de 471 de produse.
- `e2e-cloud/gospodarie.spec.ts` (3 utilizatori, sincronizare offline, izolare) **pică**. Cauza e găsită, dar **repararea nu e aplicată**:
  - în `src/components/app/app-provider.tsx`, în `handle(session)`, `let currentUser: string | null = null;` face ca prima sesiune `null` să fie ignorată;
  - aplicația rămâne în „Se încarcă” și nu trimite la `/autentificare/`;
  - fix: `let currentUser: string | null | undefined = undefined;`.

### Etapa 5, încheiere (11 oct., sesiunea a doua)
Fix-ul `currentUser = undefined` era deja în a7a169c. E2E-ul cloud mai pica din alte cauze, reparate:
- `scripts/local-supabase.mjs`: CORS-ul îl face proxy-ul (GoTrue refuza antetul `apikey` la preflight, iar browserul arăta „Nu ai conexiune la internet”); procesele rămase de la rularea anterioară se opresc la pornire.
- `src/components/shopping/product-search.tsx`: Enter apăsat înainte să se încarce catalogul se ține minte și alege produsul după încărcare (înainte adăuga textul ca produs nou, dublură a celui din catalog).
- `e2e-cloud`: linkul de invitație trece prin butonul „Continuă”; `syncNow` așteaptă o tragere reală de pe server; `quickAdd` așteaptă produsul din catalog.
- `e2e/scenariu-duminica`: textul corectat („Un produs cumpărat nu are preț”).

Dovada: `npm run test:e2e:cloud` 1/1, de 6 ori la rând; `npx playwright test` 15/15, de 2 ori; `npm test` 99/99; `npm run test:db` 24/24; `npm run build`, `tsc --noEmit`, `eslint` curate.

### Etapa 6 (11 oct., sesiunea a doua)
- `CLAUDE.md` la zi: gospodării cu roluri, structura, comenzile de test, conținutul din `src/data` cere aprobare.
- Documentație: `README.md`, `CHANGELOG.md`, `.env.example`, iar în `docs/`: ARCHITECTURE, DATABASE_SCHEMA, API_DOCUMENTATION, DEPLOYMENT, ENVIRONMENT_VARIABLES, TESTING, ROADMAP, IMPLEMENTATION_STATUS.
- `IMPLEMENTATION_STATUS.md`: criteriile 1–22 nu sunt în repo (erau doar în conversație) → „DE COMPLETAT”; am listat ce dovedesc testele.
- CI: `.github/workflows/ci.yml` (lint, typecheck, test, test:db cu serviciu Postgres, build, E2E demonstrativ și cloud). `eslint` ignoră `out-cloud/` și `.local-supabase/`.

- CI verde pe GitHub (rularea 38142113179): toți pașii, inclusiv E2E cloud. Prima rulare a picat la 3 teste E2E: pe mașina mai lentă, Enter apăsat înainte de încărcarea catalogului era ignorat. Acum e ținut minte și aplicat după încărcare; local, 90/90 sub încărcare (8 workeri, fiecare test de 3 ori).


## De făcut (în ordine)
2. Proprietarul trimite criteriile 1–22 → se bifează în `docs/IMPLEMENTATION_STATUS.md`, doar cu dovadă.
3. ~~Proprietarul aprobă textele din `src/data`~~: aprobate toate (86 de rețete, catalogul cu 20 de categorii și 471 de produse, magazinele și locurile din cămară), 11 oct. 2026, „Aprob tot”. Pagina de aprobare (https://claude.ai/artifact/733eG5T4GHE5H4Ri8qBo2o) le arată pe toate aprobate. Textele noi sau schimbate de acum încolo cer din nou aprobare.
4. ~~PR spre `main`~~: integrat (#1, 11 oct.). Importul copiei de siguranță: PR #2.

## Cum verific la final
`npm test && npm run test:db && npm run build && npx playwright test && npm run test:e2e:cloud` trec, iar IMPLEMENTATION_STATUS.md bifează doar criteriile dovedite de aceste teste.

## Următorul pas
Proprietarul trimite criteriile 1–22; se bifează în `docs/IMPLEMENTATION_STATUS.md` doar cu dovadă.
