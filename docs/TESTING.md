# Testare

Reguli (din `CLAUDE.md`): orice comportament nou vine cu test; testele nu depind de data de azi, de rețea sau de ordinea rulării; data se fixează în test.

## Nivelurile
| Comandă | Ce acoperă | De ce are nevoie |
| --- | --- | --- |
| `npm test` | logica de domeniu (`src/lib/domain/*.test.ts`), catalogul (`src/data/catalog.test.ts`, inclusiv `seed.sql` la zi), sincronizarea cu un server simulat (`src/lib/sync/engine.test.ts`), serviciile pe IndexedDB simulat (`src/lib/services/services.test.ts`) | nimic |
| `npm run test:db` | migrația, RLS și funcțiile RPC, pe Postgres real (`supabase/tests/rls.test.ts`) | Postgres 15–17 instalat local, sau `TEST_DATABASE_URL` |
| `npm run test:e2e` | aplicația construită (`out/`), în mod demonstrativ, pe telefon (Pixel 7) și desktop | `npm run build` înainte; Chromium (Playwright) |
| `npm run test:e2e:cloud` | conturi, gospodărie, invitație, listă comună între 2 membri, lucru fără semnal, izolarea unei a 3-a gospodării, ieșirea din cont | Postgres local; descarcă o dată Supabase Auth și PostgREST în `.local-supabase/` |

Un singur fișier: `npx vitest run <cale>`, `npx playwright test e2e/<fișier>`.

## Testele E2E (demonstrativ)
- `cumparaturi.spec.ts`: adăugare rapidă, cantități, preț, total, sursă piață; duplicare, arhivare, ștergere cu anulare; lista recurentă.
- `offline-pwa.spec.ts`: manifestul și service worker-ul; lista merge fără internet.
- `responsive.spec.ts`: fără derulare orizontală la lățimile de test; navigația principală.
- `retete-camara.spec.ts`: porții, cost incomplet, alergeni, favorite; cămara (expirare, „ce pot găti”); prețuri de la piață.
- `scenariu-duminica.spec.ts`: de la planul săptămânii la buget.

## Supabase local, fără Docker
`node scripts/local-supabase.mjs` pornește Postgres, Supabase Auth v2.169, PostgREST 12.2.3 și un proxy pe portul 54321, cu aceleași căi ca Supabase (`/auth/v1`, `/rest/v1`). Proxy-ul face și CORS-ul (ca Kong în Supabase). Realtime nu e inclus; aplicația sincronizează și la scriere, periodic și la cerere. `scripts/build-cloud-e2e.sh` construiește aplicația conectată la el, în `out-cloud/`.

## Înainte de push
`npm test` și `npm run build`; la schimbări de schemă și `npm run test:db`; la schimbări de ecran și `npm run test:e2e`. CI-ul (`.github/workflows/ci.yml`) le rulează pe toate.
