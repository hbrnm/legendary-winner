# CLAUDE.md

Reguli de lucru pentru Cămara (cumpărături, rețete, plan de mese, buget
și cămară pentru gospodăriile din România, folosită de pe telefon, PWA
offline; Next.js, TypeScript, Dexie, Supabase, Vercel).

## 1. Principii
1. Gândește înainte de cod: spune presupunerile; dacă e neclar, întreabă.
2. Simplitate: minimul de cod care rezolvă problema.
3. Modificări chirurgicale: atinge doar ce cere sarcina.
4. Rezultat verificabil: un test care reproduce problema, apoi trece.

Deciziile de produs (ce intră și în ce ordine, textele, furnizorii,
orice schimbare pe producție) se prezintă ca chestionar cu variante,
cea recomandată prima, marcată „(Recomandat)”.

## 2. Proiect
- Structură: `src/app/` paginile (App Router, export static);
  `src/components/` componentele (`app/` are `AppProvider`);
  `src/data/` catalogul (produse, rețete, categorii, magazine);
  `src/lib/domain` logica pură; `src/lib/db` baza locală (Dexie) și
  scrierile cu `outbox`; `src/lib/sync` sincronizarea cu Supabase;
  `src/lib/services` serviciile aplicației; `supabase/migrations/`
  schimbările de bază de date, `supabase/seed.sql` (generat cu
  `npm run seed:sql`), `supabase/tests/` testele RLS; `e2e/` testele
  end-to-end în mod demonstrativ; `e2e-cloud/` cele cu Supabase local
  (`scripts/local-supabase.mjs`); testele unitare stau lângă cod
  (`*.test.ts(x)`); `.tasks/` lucrările mari; `docs/` planuri.
- Teste: `npm test` (Vitest); un fișier: `npx vitest run <cale>`.
  `npm run test:db` (RLS și funcții, pe Postgres local sau
  `TEST_DATABASE_URL`); `npm run test:e2e` (Playwright, pe `out/`,
  după `npm run build`); `npm run test:e2e:cloud` (Supabase local).
  Orice comportament nou vine cu test.
  Testele nu depind de data de azi, de rețea sau de ordinea
  rulării; data se fixează în test; în `npm test` Supabase se simulează.
  Înainte de push: `npm test` și `npm run build`; la schimbări de
  schemă și `npm run test:db`; la schimbări de ecran și `npm run test:e2e`.
- Convenții: ramuri `claude/nume-scurt`; commit-uri cu prefix
  (`feat:`, `fix:`, `test:`, `docs:`); PR-ul spune ce s-a schimbat
  și dovada verificării (comanda și rezultatul).
- Date și securitate: fiecare om are contul lui; datele sunt ale
  gospodăriei, cu membri și roluri (owner/admin/member; decizia
  proprietarului, 11 oct. 2026). Un membru citește și scrie doar datele
  gospodăriilor lui (RLS pe `household_id`, pe fiecare tabel). Catalogul
  global (`household_id NULL`) îl scriu doar `app_admins`. Ștergerile sunt
  logice (`deleted_at`). Parolele și emailurile nu ajung în cod,
  loguri sau URL-uri. În cod intră doar URL-ul Supabase și anon key;
  `service_role` și orice cheie secretă stau doar în setările Vercel /
  Supabase, niciodată în repo sau în variabilele mediului cloud.
  Schimbările de bază de date doar prin migrații noi în repo.
- Conținut de specialitate: prețurile vin doar de la gospodărie
  (plătite, văzute, promoții); nu se inventează prețuri, promoții sau
  valori nutriționale (rămân `null`); scrie „DE COMPLETAT: …”. Textele
  rețetelor și ale catalogului din `src/data` sunt scrise de agenți și
  au nevoie de aprobarea proprietarului înainte de producție.
- UI: mobil întâi, de la 360 px lățime, o coloană, zone de atins de
  minimum 44 px. Culorile doar din tokenii CSS din
  `src/app/globals.css` (fără culori scrise direct în componente);
  mod luminos și întunecat.
- Texte: română, cald, cu „tu”. Mesajul de eroare spune ce s-a
  întâmplat și ce faci acum, fără termeni tehnici
  („Nu am putut salva. Verifică internetul și încearcă din nou.”).
  Textele noi le aprobă proprietarul proiectului, într-un chestionar.

## 3. Orchestrator + agenți
Orchestratorul (sesiunea principală) înțelege cererea, face planul,
pune întrebările, scrie codul sensibil, verifică și face PR-ul.
Agenții nu pot pune întrebări; primesc sarcini precise.

| Agent | Model | Când |
| --- | --- | --- |
| `explorare` | Haiku | căutări care ar cere multe citiri de fișiere |
| `testare` | Sonnet | rulează teste + build, întoarce doar ce a picat |
| `executie` | Sonnet | sarcină precisă, cu fișierul-model de urmat |
| `verificare` | Sonnet | citește diff-ul o dată pe PR, înainte de push |

Nu se deleagă niciodată (rămân la orchestrator):
- chestionarele și textele noi;
- baza de date: migrații, SQL, RLS, autentificarea;
- configurarea build-ului, dependențele noi, workflow-urile CI;
- commit, push, PR, merge.

Cer acordul explicit, de fiecare dată: comenzi pe baza de date de
producție, ștergeri, schimbări de domeniu sau de plan plătit.

Economie:
- un PR pe etapă, din `main`, integrat imediat ce e verde;
- la începutul sesiunii, `npm test` pe `main`; dacă pică, întâi
  un PR separat de reparare;
- `verificare` o singură dată pe PR (a doua doar după o problemă blocantă);
- capturi de ecran doar pentru ecrane noi, decupate pe zona schimbată;
- textele unei etape aprobate într-un singur chestionar;
- fără urmărirea PR-ului: previzualizarea Vercel durează sub un minut;
- modificările mici le face orchestratorul direct;
- lucrările mari în `.tasks/NNN-nume.md`, cu commit + push după
  fiecare etapă; fiecare etapă mare într-o sesiune nouă.
