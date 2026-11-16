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
- [ ] Scrie teste RED: familie 100 cumpărături + 800 școală = 900; vechiul total = 100; școală = 800; transport = 0; manualele nu intră în media ieșirilor; perioade/ștergeri/export corecte.
- [ ] Scrie teste RED pentru creare/editare/ștergere, outbox, acces la altă gospodărie, sume zero/negative/zecimale excesive, date inexistente/viitoare, backup și import repetat.
- [ ] Implementează tipurile, tabela Dexie v5, serviciile și proiecția fără a modifica `spendRecords` folosit de istoric/bonuri.
- [ ] Extinde schema bugetelor și backup-ul; pune `manual_expenses` în sincronizare și tabele opționale; păstrează în coadă scopurile noi dacă serverul nu este pregătit.
- [ ] Scrie testele RLS și migrația pentru tabela nouă, scopurile suplimentare, triggere și grant-uri identice cu modelul gospodăriei. Rulează `npm run test:db` doar pe Postgres temporar.
- [ ] Rulează testele focalizate, apoi `npm test`; verifică upgrade Dexie și cursa bifare/finalizare.

## Task 2: Interfață și integrarea rapoartelor
**Files:** `src/app/buget/page.tsx`; `src/components/budget/expenses.tsx`; `src/components/app/app-provider.tsx`; `src/components/home/home-screen.tsx`; `src/app/cumparaturi/lista/page.tsx`; `e2e/family-budget.spec.ts`.
**Interfaces:** cele din Task 1; `useApp().familyBudgetEnabled: boolean` este true în demo sau după confirmarea tabelei pe server. Componenta `ManualExpenses({month:string})` încarcă manualele gospodăriei pentru luna aleasă, oferă adăugare/editare/ștergere și confirmă ștergerea.
- [ ] Adaugă formularul „Cheltuială nouă”: „Descriere”, „Suma (lei)”, „Data plății”, „Categoria”; listează plățile lunii, cu modificare și ștergere confirmată.
- [ ] Adaugă scopurile „Toate cheltuielile familiei” și „O categorie de cheltuieli”; păstrează scopurile pentru produse/magazine. Noul buget implicit este al familiei când funcția este disponibilă.
- [ ] Folosește totalul combinat în rapoarte/grafice/export; împarte implicit pe categoriile familiei, cu acces separat la categoriile produselor și magazine. Estimarea coșului nu se scade din bugetul școlii.
- [ ] Folosește bugetul familiei pe Acasă și lângă lista de cumpărături când este ales ca principal; calculează folosind totalul combinat.
- [ ] Rulează testul browser pentru școală, haine, transport, buget de categorie, totaluri, persistență, editare/ștergere, export și viewport 360px. Rulează testele existente afectate, apoi suita E2E.

## Task 3: Validare și livrare locală
- [ ] Revizuire independentă unică; corectează problemele relevante cu teste de regresie.
- [ ] `npm test`, `npm run typecheck`, verificări RLS și E2E; build standard sau raportarea limitei mediului și build alternativ fără schimbări persistente de configurație.
- [ ] Documentează migrația necesară și comportamentul bugetelor existente. Commit și patch local pentru revizuire. Push/PR rămân în așteptarea aprobării explicite cerute de verificarea automată anterioară.
