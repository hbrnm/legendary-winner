# 003 — Sincronizarea nu mai re-descarcă rânduri neschimbate

**Stare:** încheiat (11 oct. 2026). Aprobat de proprietar: „Repar acum”; migrația pe producție și integrarea PR #9 aprobate în chestionar.
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

## Cauza confirmată
Triggerul `touch_updated_at` pune `clock_timestamp()` și la seed, deci tot catalogul are `updated_at` în câteva secunde. Cursorul (cel mai nou `updated_at`) rămâne în acel grup, iar fereastra de 30 s îl prinde întreg la fiecare tragere.

## Decizia (proprietarul, 11 oct. 2026, chestionar)
Ora serverului vine dintr-o funcție nouă, `server_now()` (migrația `20261011000003_server_now.sql`, doar pentru `authenticated`). Variantele respinse: antetul `Date` (CORS neverificabil), ceasul telefonului (poate pierde rânduri).

## Cum funcționează
- La fiecare tragere: `stable = server_now() - 30 s`, cerut înaintea primei pagini.
- Cursorul pe tabel (`meta cursor:<tabel>`): `{ updated_at, id, stable }` ale ultimului rând citit. Cursorul vechi (doar text) e citit ca înainte, o singură dată.
- Dacă `updated_at` al cursorului < `stable` de la tragerea trecută: pornim strict după (`updated_at`, `id`). Altfel re-citim de la `stable` (inclusiv).
- Paginarea folosește tot perechea (`updated_at`, `id`); dispare saltul de 1 ms, care putea pierde rânduri cu aceeași oră.
- Ipoteza: între scrierea unui rând (`clock_timestamp()` în trigger) și confirmarea tranzacției trec sub 30 s. Un import mare de catalog într-o singură tranzacție lungă trebuie împărțit.
- Dacă `server_now()` lipsește (`PGRST202`), tragerea folosește vechea fereastră de 30 s de la cursor: sincronizarea nu se oprește.
- `applyRemoteRows` nu mai rescrie rândurile cu același `updated_at` și fără modificări în outbox.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | Testul care reproduce (pică) | făcut | c95909f |
| 2 | Repararea în `engine.ts` / `write.ts` / `supabase-remote.ts` + migrația `server_now()`; testele trec | făcut | #9 |
| 3 | `npm test` (111), `npm run test:db` (27), `npm run test:e2e:cloud` (1), `npm run build`; `verificare`; PR | făcut | #9 |
| 4 | Aplicarea migrației `20261011000003_server_now.sql` pe producție (cere acordul proprietarului), apoi publicarea; după integrare: în jurnalele Supabase (edge_logs), o sincronizare fără schimbări nu mai aduce rânduri de catalog | făcut | vezi „Rezultat pe producție” |

## Cum verific la final
- Testul nou trece, la fel ca toate testele existente.
- Pe producție, după publicare, două sincronizări la rând pe același telefon: a doua nu mai primește rânduri de catalog. Verificarea se face cu `query_logs` pe `edge_logs` sau cu dimensiunea răspunsurilor.

## Rezultat pe producție (edge_logs, 11 oct. 2026)
- Migrația aplicată la 18:02. Versiunea din `supabase_migrations.schema_migrations` a fost aliniată apoi cu fișierul din repo: `20261011000003` (înainte `20261011180250`, cu aprobarea proprietarului). `anon` nu are drept pe `server_now()`, `authenticated` are.
- **Înainte** (iPhone, 17:49–18:05, versiunea veche): la fiecare sincronizare, `product_categories` 20 + `retailers` 1 + `products` 101 + `product_aliases` 295 = **417 rânduri de catalog**, de fiecare dată aceleași.
- **După** (18:06–18:09, 6 sincronizări cu versiunea nouă): fiecare începe cu `rpc/server_now` (200), apoi catalogul se cere „strict după cursor” (`or=(updated_at.gt…,and(updated_at.eq…,id.gt…))`) și răspunsul are `content_range */*`, adică **0 rânduri**. La fel toate celelalte tabele, în afară de un rând nou din `shopping_list_items`.

## Următorul pas
Nimic pentru această sarcină.
