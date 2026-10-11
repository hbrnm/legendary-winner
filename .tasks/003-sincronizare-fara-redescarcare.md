# 003 — Sincronizarea nu mai re-descarcă rânduri neschimbate

**Stare:** de făcut (aprobat de proprietar pe 11 oct. 2026: „Repar acum”)
**Ramura:** `claude/sincronizare-cursor` (un PR din `main`)

## Scop
La fiecare sincronizare (o dată pe minut, la revenirea în aplicație, la notificările Realtime), `SyncEngine.pull` cere din nou toate rândurile cu `updated_at >= cursor - 30 s`. Pe producție, asta înseamnă 1067 de rânduri ale catalogului la fiecare rulare, deși nu s-a schimbat nimic. Pe un telefon Android mai lent, sincronizarea s-a oprit o dată după `products`, iar aplicația nu s-a mai încărcat până la o repornire (`.tasks/002`, etapa 5).

Fereastra de 30 de secunde există ca să nu se piardă rândurile confirmate în altă ordine: o tranzacție începută mai devreme poate fi confirmată după ce am citit rânduri mai noi. Reparația trebuie să păstreze această garanție.

## În afara scopului
- Schimbări de schemă, dacă se poate fără. Dacă e nevoie de o coloană nouă (ex. o secvență), se discută întâi cu proprietarul și se face prin migrație nouă.
- Realtime, interfața, catalogul.

## Abordarea propusă (de confirmat în sesiune, după ce citești `src/lib/sync/engine.ts`)
1. **Test care reproduce** în `src/lib/sync/engine.test.ts`, după modelul testelor existente cu `fake-remote.ts`: două `syncNow()` la rând, fără schimbări pe server, cu fereastra implicită (nu `overlapMs: 0`). Testul cere ca a doua tragere să nu mai aducă rânduri (sau să nu le mai scrie în IndexedDB). Trebuie să pice înainte de reparare.
2. **Reparare, varianta recomandată:** fereastra se aplică doar rândurilor încă „recente” la momentul citirii. Ține minte, pe lângă cursor, ora serverului la ultima tragere (de ex. antetul `Date` al răspunsului sau `now()` al serverului). Rândurile cu `updated_at` mai vechi decât ora serverului minus 30 s erau deja stabile; pentru ele, tragerea următoare pornește strict după cursor. Cursorul devine perechea (`updated_at`, `id`), ca rândurile cu același `updated_at` să nu se piardă și să nu se repete.
3. **Completare ieftină:** `applyRemoteRows` nu mai scrie rândurile al căror `updated_at` local e egal cu cel venit de la server (fără modificări în outbox). Așa, chiar și rândurile primite de două ori nu mai declanșează rescrieri și re-randări.
4. **Teste existente:** `engine.test.ts`, inclusiv paginarea, `npm test`, `npm run test:e2e:cloud` (3 utilizatori, offline) și `npm run build`.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | Testul care reproduce (pică) | de făcut | |
| 2 | Repararea în `engine.ts` / `write.ts` / `supabase-remote.ts`; testele trec | de făcut | |
| 3 | `npm test`, `npm run test:e2e:cloud`, `npm run build`; `verificare`; PR | de făcut | |
| 4 | După integrare: în jurnalele Supabase (edge_logs), o sincronizare fără schimbări nu mai aduce rânduri de catalog | de făcut | |

## Cum verific la final
- Testul nou trece, la fel ca toate testele existente.
- Pe producție, după publicare, două sincronizări la rând pe același telefon: a doua nu mai primește rânduri de catalog. Verificarea se face cu `query_logs` pe `edge_logs` sau cu dimensiunea răspunsurilor.

## Următorul pas
Etapa 1, într-o sesiune nouă: citește `src/lib/sync/engine.ts` și `engine.test.ts`, apoi scrie testul care reproduce.
