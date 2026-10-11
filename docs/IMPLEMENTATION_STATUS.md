# Starea implementării

Actualizat: 11 octombrie 2026, seara, `main` la `a9b26a3` (auditul 0.1.1).

## Criteriile de acceptanță 1–22
Din „Master prompt”, secțiunea 20 (sesiunea din 11 oct. 2026), cuvânt cu cuvânt. Un criteriu e bifat doar cu dovada lui (testul care îl verifică).

| # | Criteriu | Stare | Dovada |
| --- | --- | --- | --- |
| 1 | Utilizatorul poate crea un cont. | bifat | `e2e-cloud/gospodarie.spec.ts` (3 conturi create din aplicație). Supabase local (`npm run test:e2e:cloud`). Producție (11 oct.): două conturi create din https://appcamara.vercel.app, cu emailul confirmat |
| 2 | Poate crea o gospodărie. | bifat | `e2e-cloud/gospodarie.spec.ts`; `supabase/tests/rls.test.ts` (`create_household`) |
| 3 | Poate adăuga membri. | bifat | `e2e-cloud/gospodarie.spec.ts` (link de invitație acceptat de al doilea cont); `supabase/tests/rls.test.ts` (roluri, invitații). Producție (11 oct.): invitație acceptată de al doilea cont, pe alt telefon; lista creată pe iPhone apare pe Android |
| 4 | Poate crea și utiliza liste de cumpărături. | bifat | `e2e/cumparaturi.spec.ts` (3 teste) |
| 5 | Poate găsi produse românești în catalog. | bifat | `src/lib/services/services.test.ts` („găsește produse românești după sinonime…”); `e2e/cumparaturi.spec.ts`; catalog de 471 de produse aprobat pe 11 oct. 2026 |
| 6 | Poate adăuga produse personalizate. | bifat | `e2e/cumparaturi.spec.ts` („Cozonacul bunicii”); `services.test.ts` („produsele personalizate se adaugă și fără catalog”) |
| 7 | Poate diferenția produsele de supermarket de cele de piață. | bifat | `e2e/cumparaturi.spec.ts` (sursa „Piață”, gruparea pe magazine); `e2e/retete-camara.spec.ts` („prețuri de la piață și comparație”). Limitare găsită la audit: estimarea listei amesteca prețurile de piață cu cele de supermarket; reparată în PR #13 (`pricing.test.ts`), activă după integrare |
| 8 | Poate introduce prețuri reale. | bifat | `e2e/cumparaturi.spec.ts` (prețul plătit); `e2e/scenariu-duminica.spec.ts`; `e2e/retete-camara.spec.ts` |
| 9 | Poate salva și utiliza rețete. | bifat | `services.test.ts` (`saveRecipe`, favorite, „am gătit”); `e2e/retete-camara.spec.ts` (porții, favorite, ingrediente în listă) |
| 10 | Poate planifica mesele. | bifat | `e2e/scenariu-duminica.spec.ts`; `services.test.ts` („planifică, generează lista consolidată…”) |
| 11 | Poate genera liste din rețete. | bifat | `e2e/retete-camara.spec.ts`; `e2e/scenariu-duminica.spec.ts` (lista din plan); `services.test.ts` |
| 12 | Poate vedea costul estimat al rețetelor. | bifat | `e2e/retete-camara.spec.ts` (cost incomplet arătat ca atare); `services.test.ts` („calculează costul cu prețurile cunoscute”). Limitare: ingredientele „la bucată” ale produselor vândute la kg (136 din 885) nu au cost până la `.tasks/004` |
| 13 | Poate configura bugetul. | bifat | `e2e/scenariu-duminica.spec.ts` („Setează bugetul lunar”); `src/lib/domain/budget.test.ts` |
| 14 | Poate urmări cheltuielile reale. | bifat | `e2e/scenariu-duminica.spec.ts` (bugetul arată cheltuiala o singură dată); `services.test.ts` (fără dublă numărare) |
| 15 | Poate administra cămara și frigiderul. | bifat (cu limitare) | `e2e/retete-camara.spec.ts` (adăugare, expirare, scădere, „ce pot găti”); `services.test.ts` (gătitul scade din cămară, locul „congelator”). Frigiderul și congelatorul sunt locuri ale cămării. Limitare: cămara nu scade ingredientele cerute la bucată dacă stocul e în kg (`.tasks/004`) |
| 16 | Poate vedea istoricul cumpărăturilor. | bifat | `e2e/scenariu-duminica.spec.ts` (istoricul păstrează cumpărătura; prețul lipsă se completează) |
| 17 | Poate utiliza aplicația pe telefon. | bifat | Toată suita `e2e/` rulează pe proiectul „telefon”; `e2e/responsive.spec.ts` (fără derulare orizontală la 360 px) |
| 18 | Poate instala aplicația ca PWA. | bifat | `e2e/offline-pwa.spec.ts` („manifestul și service worker-ul permit instalarea”) |
| 19 | Poate folosi lista în condiții de conectivitate slabă. | bifat | `e2e/offline-pwa.spec.ts` (lista fără internet); `e2e-cloud/gospodarie.spec.ts` (modificări fără semnal, păstrate la ambii membri); `src/lib/sync/engine.test.ts` |
| 20 | Datele gospodăriei sunt protejate. | bifat | `supabase/tests/rls.test.ts` (RLS pe fiecare tabel, roluri, fără ștergere fizică); `e2e-cloud/gospodarie.spec.ts` (contul străin nu vede și nu scrie). Producție (11 oct.): fără cont se văd 0 rânduri; un cont străin vede 0 gospodării și 0 liste, dar catalogul comun; `get_advisors` nu mai arată funcții apelabile fără cont |
| 21 | Build-ul de producție funcționează. | bifat | `npm run build` (export static, 18 pagini, `sw.js`) local și în CI. Producție (11 oct.): publicat pe Vercel, https://appcamara.vercel.app, fără „Mod demonstrativ” |
| 22 | Funcționalitățile principale au teste care trec. | bifat | Rularea din 11 oct. 2026, mai jos; CI verde pe `main` |

Criteriile 1, 3, 20 și 21 au fost reverificate pe producție pe 11 oct. 2026 (`.tasks/002-publicare.md`, etapa 5).

## Ce e dovedit de teste (rularea din 11 oct. 2026, seara, pe `a9b26a3`)
`npm test` 111/111 · `npm run test:db` 27/27 (Postgres 16 local) · `npm run test:e2e` 20/20 · `npm run test:e2e:cloud` 1/1 (în CI; local lipsește Docker/binarele) · `npm run build`, `tsc --noEmit`, `eslint` curate · CI verde pe `main`.

| Ce | Testul |
| --- | --- |
| Adăugare rapidă cu cantitate, preț, total, sursă piață | `e2e/cumparaturi.spec.ts` |
| Duplicare, arhivare, ștergere cu anulare; liste recurente | `e2e/cumparaturi.spec.ts` |
| PWA instalabilă; lista merge fără internet | `e2e/offline-pwa.spec.ts` |
| Fără derulare orizontală pe telefon; navigația principală | `e2e/responsive.spec.ts` |
| Rețete: porții, cost incomplet, alergeni, favorite, ingrediente în listă | `e2e/retete-camara.spec.ts` |
| Cămara: expirare, „ce pot găti”, doar ingredientele lipsă | `e2e/retete-camara.spec.ts` |
| Prețuri de la piață și comparație | `e2e/retete-camara.spec.ts` |
| Plan → listă → cumpărături → buget | `e2e/scenariu-duminica.spec.ts` |
| Cont, gospodărie, invitație, listă comună între 2 membri | `e2e-cloud/gospodarie.spec.ts` |
| Modificări fără semnal păstrate la ambii membri după revenire | `e2e-cloud/gospodarie.spec.ts` |
| Gospodăriile sunt izolate; ieșirea din cont șterge datele de pe dispozitiv | `e2e-cloud/gospodarie.spec.ts`, `supabase/tests/rls.test.ts` |
| RLS: roluri, invitații (unică folosință, pe email, previzualizare), catalog global doar pentru administratori, fără ștergere fizică, `updated_at` de pe server | `supabase/tests/rls.test.ts` |
| O tură de cumpărături se înregistrează o singură dată (fără dublă numărare) | `supabase/tests/rls.test.ts`, `src/lib/services/services.test.ts` |
| Sincronizare: modificări offline, câmpuri diferite fără pierderi, ultima modificare câștigă pe același câmp, ștergeri, refuzurile serverului, paginare, a doua tragere fără schimbări aduce 0 rânduri, rânduri cu aceeași oră, rânduri confirmate târziu, fără rescrieri inutile; tragere întreruptă reluată (PR #12) | `src/lib/sync/engine.test.ts`; pe producție: 0 rânduri de catalog la o sincronizare fără schimbări (`.tasks/003`) |
| Logica: unități, cantități, căutare, prețuri, rețete, listă, buget, cămară, date, bani, import CSV | `src/lib/domain/*.test.ts` |
| Catalogul e valid și `seed.sql` e la zi | `src/data/catalog.test.ts` |
| Copia de siguranță: descărcare și readucere, fără dubluri | `src/lib/services/backup.test.ts`, `e2e/copie-siguranta.spec.ts` |

## Ce nu e făcut
Vezi [ROADMAP.md](ROADMAP.md): notificări push de pe server, fotografii, valori nutriționale, prețuri din cataloagele magazinelor.

## Ce așteaptă proprietarul
Supabase și Vercel sunt publicate (https://appcamara.vercel.app). Rămân:
- Integrarea PR-urilor 0.1.1 (#12 test sincronizare, #13 prețuri după context, #14 numărul produselor fără preț în Buget, plus acest PR de documentație). Integrarea în `main` publică pe producție.
- Aprobarea greutăților pe bucată și a migrației din `.tasks/004-greutate-pe-bucata.md`.
- Observațiile editoriale din [AUDIT_0.1.1.md](AUDIT_0.1.1.md) (nimic nu s-a schimbat în rețete fără aprobare).
