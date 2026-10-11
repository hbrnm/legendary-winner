# Arhitectura

## Pe scurt
- **Next.js 16, export static** (`output: "export"`, `trailingSlash: true`). Nu există server propriu: aplicația e un set de fișiere statice, servite de Vercel sau de orice CDN. Paginile de detaliu primesc id-ul prin `?id=` (ex. `/retete/reteta/?id=…`).
- **Local-first.** Toate datele stau în IndexedDB (Dexie). Ecranele citesc doar din baza locală, deci merg și fără internet.
- **Supabase** (Postgres + Auth + Realtime) e sursa comună a gospodăriei. Accesul e controlat de RLS; în aplicație ajung doar URL-ul și cheia publică (anon).
- **PWA**: `src/sw/sw.template.js` devine `out/sw.js` (`scripts/build-sw.mjs`), cu toate fișierele build-ului în cache; `src/app/manifest.ts` e manifestul.

## Straturile
| Dosar | Rol |
| --- | --- |
| `src/app/*` | ecranele (acasă, cumpărături, istoric, rețete, plan, buget, prețuri, cămară, gospodărie, autentificare, invitație, administrare, offline) |
| `src/components/app` | `AppProvider` (sesiune, gospodăria activă, pornirea sincronizării), `Shell` (cadrul paginilor), hook-uri |
| `src/components/*` | componente de ecran și de interfață (`ui/`) |
| `src/lib/domain` | logică pură, fără I/O: unități, cantități, căutare, adăugare rapidă, prețuri, rețete, listă, buget, cămară, date, bani, import CSV |
| `src/lib/db` | baza locală (`database.ts`), id-uri (`ids.ts`), scrieri (`write.ts`) |
| `src/lib/sync` | motorul de sincronizare și adaptoarele (`supabase-remote.ts`, `fake-remote.ts` pentru teste) |
| `src/lib/services` | operațiile aplicației (liste, finalizare, rețete, plan, cămară, buget, prețuri, gospodărie, copie de siguranță) |
| `src/data` | catalogul inițial: 471 de produse, 86 de rețete, 20 de categorii, 13 magazine |
| `supabase/` | migrația, `seed.sql` generat, testele RLS |

## Scrierea și sincronizarea
1. Orice scriere trece prin `src/lib/db/write.ts`: modifică rândul local și adaugă o intrare în `outbox`, în aceeași tranzacție.
2. `SyncEngine.syncNow()` (`src/lib/sync/engine.ts`):
   - **push** în ordinea din `outbox`: `insert` = upsert, `update` = doar câmpurile schimbate;
   - **pull** pe fiecare tabel, după cursorul compus (`updated_at`, `id`) al ultimului rând citit, salvat în `meta` (`cursor:<tabel>`). Înaintea primei pagini se cere ora serverului (`server_now()`, migrația `20261011000003`). Rândurile mai vechi decât această oră minus 30 s erau deja confirmate și nu se mai cer. Rândurile încă „recente” (cursorul după ora stabilă de la tragerea trecută) se citesc din nou, pentru tranzacțiile confirmate în altă ordine. Paginile (500 de rânduri) continuă strict după perechea (`updated_at`, `id`), deci rândurile cu aceeași oră nu se pierd și nu se repetă. Cursorul se salvează la sfârșitul tabelului: o tragere întreruptă se reia de la cursorul vechi. Fără `server_now()` (`PGRST202`), se re-citesc 30 s înapoi de la cursor;
   - `applyRemoteRows` nu rescrie rândurile cu același `updated_at` și fără modificări în outbox;
   - modificările locale încă netrimise se reaplică peste ce vine de la server;
   - ce refuză serverul (RLS, constrângeri) se notează în `sync_errors`, iar rândul revine la versiunea serverului.
3. Sincronizarea pornește: la deschidere, la fiecare scriere locală (după 400 ms), la revenirea internetului, la revenirea în aplicație, la fiecare minut și la notificările Realtime.
4. Apelurile simultane se comasează într-o singură rulare în plus.

## Reguli de date
- **Ștergeri logice** (`deleted_at`): ștergerea ajunge la toate dispozitivele.
- **Fără dublă numărare**: tura de cumpărături are un id determinist (`stableId(listă, tură)`), deci două telefoane care finalizează aceeași tură scriu același rând. Cheltuiala reală = tranzacțiile finalizate + produsele bifate din listele încă deschise (`spendRecords`).
- **Prețuri**: doar de la gospodărie; un produs fără preț e numărat separat („fără preț”), nu estimat. Estimarea unei linii de listă (`latestUnitPrice`, `src/lib/domain/pricing.ts`, după PR #13) ia întâi prețul obișnuit din magazinul liniei, apoi din aceeași sursă (marcat „alt magazin”), apoi promoțiile (marcate); alte surse nu se folosesc. Rețetele folosesc cel mai recent preț din orice sursă (estimare generală). Un preț mai vechi de 90 de zile e marcat „preț vechi”.
- **Catalog global** (`household_id NULL`): îl scriu doar administratorii aplicației (`app_admins`); gospodăriile își pot adăuga produse și rețete proprii.

## Moduri
- **Demonstrativ** (lipsesc `NEXT_PUBLIC_SUPABASE_*`): o gospodărie locală, fără conturi, fără sincronizare.
- **Cloud**: cont, gospodării, invitații, sincronizare. La ieșirea din cont, baza locală a utilizatorului se șterge de pe dispozitiv.

## Surse de date
- **Catalogul** (`src/data`) e scris de noi: produse, rețete, categorii, locuri de depozitare și numele lanțurilor de magazine. Fără prețuri și fără valori nutriționale.
- **Prețurile** le introduce gospodăria: prețul plătit la bifare sau la finalizare, prețuri văzute, promoții. Aplicația nu citește cataloagele sau prețurile magazinelor (fără scraping).
- **Importul CSV** (ecranul „Administrare”, `src/lib/domain/csv-import.ts`) adaugă produse în catalog, controlat de un administrator: arată întâi ce se importă, iar produsele existente nu se dublează.
