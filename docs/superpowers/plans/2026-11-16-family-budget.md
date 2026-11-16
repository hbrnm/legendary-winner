# Family Budget Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Implement the approved manual-entry version; do not publish or run production DB commands without explicit approval.

**Goal:** Bugete pentru familia întreagă, cu plăți manuale și cumpărături fără dublare.
**Architecture:** `manual_expenses` sincronizat prin Dexie/outbox/Supabase; proiecție comună `SpendRecord` pentru calcule, păstrând distincția față de cumpărături.
**Tech Stack:** Next.js static, React, Dexie, Supabase/Postgres, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-11-16-family-budget-design.md` (aprobarea variantei manuale în conversație).

## Global Constraints
Categorii fixe aprobate, RON, manual, offline, RLS pe gospodărie, ștergeri logice, fără producție sau dependențe noi în proiect. Bugetele vechi nu își schimbă sensul.

## Review Focus
- Combinarea cumpărăturilor bifate/finalizate cu manualele nu dublează cheltuiala.
- Plățile manuale nu modifică media unei ieșiri sau împărțirea pe magazine.
- Datele altor gospodării, datele invalide și sumele incorecte sunt respinse.
- Migrația absentă nu pierde date și nu blochează sincronizarea veche.
- Exportul și backup-ul păstrează cheltuielile și categoriile noilor bugete.

## Task 1: Domeniu, stocare, servicii, migrație
**Files:** `src/lib/domain/expense-categories.ts`, `types.ts`, `budget.ts`; `src/lib/db/database.ts`; `src/lib/services/expenses.ts`, `money.ts`, `queries.ts`, `backup.ts`; `src/lib/sync/engine.ts`, `supabase-remote.ts`; migrație nouă și teste în `supabase/tests/`.
**Interfaces:** `ExpenseCategoryId` și `EXPENSE_CATEGORIES` ({id,name}); `ManualExpense` ({id,household_id,description,amount,category_id,spent_on,created_at,updated_at,deleted_at}); `SpendRecord` extinde forma unei linii de cumpărături cu `manual_expense_id?`, `expense_category_id?`.
`createExpense(ctx,input): Promise<string>`, `updateExpense(ctx,id,patch): Promise<void>`, `deleteExpense(ctx,id): Promise<void>`; input {description:string,amount:number,category_id:ExpenseCategoryId,spent_on:string}.
`householdSpendRecords(db,householdId): Promise<SpendRecord[]>`; `byExpenseCategory(records,productCategories): Breakdown[]`; scopurile noi `{kind:"familie"}` și `{kind:"cheltuiala",category_id:ExpenseCategoryId}`.
- [x] Baseline `npm test`: 671 trecute; ramură separată `claude/family-budget` din `origin/main`.
- [x] Scrie teste RED: familie 100 cumpărături + 800 școală = 900; vechiul total = 100; școală = 800; transport = 0; manualele nu intră în media ieșirilor; perioade/ștergeri/export corecte.
- [x] Scrie teste RED pentru creare/editare/ștergere, outbox, acces la altă gospodărie, sume zero/negative/zecimale excesive, date inexistente/viitoare, backup și import repetat.
- [x] Implementează tipurile, tabela Dexie v5, serviciile și proiecția fără a modifica `spendRecords` folosit de istoric/bonuri.
- [x] Extinde schema bugetelor și backup-ul; pune `manual_expenses` în sincronizare și tabele opționale; păstrează în coadă scopurile noi dacă serverul nu este pregătit.
- [x] Scrie testele RLS și migrația pentru tabela nouă, scopurile suplimentare, triggere și grant-uri identice cu modelul gospodăriei. Rulează `npm run test:db` doar pe Postgres temporar.
- [x] Rulează testele focalizate, apoi `npm test`; verifică upgrade Dexie și cursa bifare/finalizare.

## Task 2: Interfață și integrarea rapoartelor
**Files:** `src/app/buget/page.tsx`; `src/components/budget/expenses.tsx`; `src/components/app/app-provider.tsx`; `src/components/home/home-screen.tsx`; `src/app/cumparaturi/lista/page.tsx`; `e2e/family-budget.spec.ts`.
**Interfaces:** cele din Task 1; `useApp().familyBudgetEnabled: boolean` este true în demo sau după confirmarea tabelei pe server. Componenta `ManualExpenses({month:string})` încarcă manualele gospodăriei pentru luna aleasă, oferă adăugare/editare/ștergere și confirmă ștergerea.
- [x] Adaugă formularul „Cheltuială nouă”: „Descriere”, „Suma (lei)”, „Data plății”, „Categoria”; listează plățile lunii, cu modificare și ștergere confirmată.
- [x] Adaugă scopurile „Toate cheltuielile familiei” și „O categorie de cheltuieli”; păstrează scopurile pentru produse/magazine. Noul buget implicit este al familiei când funcția este disponibilă.
- [x] Folosește totalul combinat în rapoarte/grafice/export; împarte implicit pe categoriile familiei, cu acces separat la categoriile produselor și magazine. Estimarea coșului nu se scade din bugetul școlii.
- [x] Folosește bugetul familiei pe Acasă și lângă lista de cumpărături când este ales ca principal; calculează folosind totalul combinat.
- [x] Rulează testul browser pentru școală, haine, transport, buget de categorie, totaluri, persistență, editare/ștergere, export și viewport 360px. Rulează testele existente afectate, apoi suita E2E.

## Task 3: Validare și livrare locală
- [x] Revizuire independentă unică; corectează problemele relevante cu teste de regresie.
- [x] `npm test`, `npm run typecheck`, verificări RLS și E2E; build standard sau raportarea limitei mediului și build alternativ fără schimbări persistente de configurație.
- [x] Documentează migrația necesară și comportamentul bugetelor existente. Commit și patch local pentru revizuire. Push/PR rămân în așteptarea aprobării explicite cerute de verificarea automată anterioară.

## Rezultatul verificărilor
- `npm test`: 694/694; `npm run typecheck`: trecut; ESLint pe fișierele modificate: trecut.
- `npm run test:e2e`: 72/72; scenariul nou verifică școală, haine, transport, totalul, bugetul de categorie, indicatorul de pe Acasă, editarea, ștergerea confirmată, lunile anterioare, persistența, CSV și lățimea de 360px.
- Teste noi RLS `manual-expenses.test.ts`: 4/4 pe Postgres temporar local. Suita DB completă are 14 teste trecute și 55 omise deoarece patru suite existente eșuează la pregătire: `rls`, `product-variants`, `receipt-aliases`, `recipe-photos`. Triggerul vechi al invitațiilor blochează `accept_invitation`; problema este reprodusă și fără migrația nouă. Nu este o regresie a funcției de buget și nu a fost modificată în această ramură.
- Migrația nouă a fost verificată RED pe schema veche, apoi GREEN cu noua schemă. Sincronizarea a fost verificată și prin test de regresie care eșuează când protecția față de un server nemigrat este eliminată.
- Build-ul standard Turbopack este blocat de mediul local (`EPERM` la portul intern). Exportul static prin Webpack, cu același loader Tailwind pentru precompilarea CSS, a trecut. CSS-ul și configurația sursă au fost restaurate; nu intră modificări de build în acest pachet.
- Revizuire independentă: fără probleme substanțiale; formularul nou a fost inspectat vizual la360px.
- Producția nu a fost modificată. Push și PR rămân în așteptarea acordului explicit pentru publicarea sursei în repository-ul public, cerut de respingerea automată anterioară.

## Pregătirea publicării aprobate
Utilizatorul a aprobat explicit publicarea în producție, apoi publicarea sursei din ramura `claude/family-budget` în repository-ul public și integrarea PR-ului. PR: https://github.com/hbrnm/legendary-winner/pull/117.

Pentru a elimina blocajele verificării de lansare au fost adăugate migrațiile `20261116000002_invitation_acceptance.sql` și `20261116000003_delete_account_alias.sql`, cu test de regresie pentru acceptare. Cele trei eșecuri ascunse anterior (RPC de trigger pentru anon/authenticated și aliasul funcției de ștergere) au fost reproduse înaintea corecțiilor. După corecții: 70/70 teste DB, fără teste omise. Revizuire independentă focalizată: fără probleme. Accesul Vercel/Supabase pentru aplicarea în producție trebuie confirmat prin conexiunile autorizate.
