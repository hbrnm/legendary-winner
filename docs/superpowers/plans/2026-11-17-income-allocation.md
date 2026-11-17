# Income Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save editable monthly income sources separately from the chosen family spending allowance, and repair budget saving on small screens.

**Architecture:** Add optional `income_sources: {name: string; amount: number}[]` to the existing monthly family budget. Keep `amount` as the spending allowance. Use existing local writes, household RLS, outbox and backup; derive income totals without counting income as spending.

**Tech Stack:** Existing Next.js, React, Dexie, Zod, PostgreSQL, Supabase.

**Spec:** docs/superpowers/specs/2026-11-17-income-allocation-design.md (approved in conversation).

## Global Constraints

- Veniturile nu sunt tranzacții și nu se adaugă la cheltuieli.
- Plafonul pentru cheltuieli rămâne ales separat.
- Surse lunare recurente, nu un registru al încasărilor pe date.
- Preserve existing budgets, access controls and offline data.

## Review Focus

- Empty/invalid/very large amounts: reject visibly without losing drafts.
- Allocation above income: show shortfall, allow explicit saving.
- Existing users: retain allowance and category budgets on adoption.
- Older server missing new column: retain outbox instead of deleting income.
- Small screen with keyboard: save footer remains visible and actionable.

### Task 1: Budget editing regression

**Files:** e2e/budget-edit.spec.ts, src/components/ui/sheet.tsx, src/app/buget/page.tsx.
**Interfaces:** Existing Sheet footer and saveForm budget update.
- [ ] Reproduce saving with a 360px-wide device and 360px visual viewport; inspect enabled state and visible button bounds.
- [ ] Fix only the demonstrated cause; verify saving and persistence after reload, plus existing sheet tests.

### Task 2: Income persistence and synchronization

**Files:** src/lib/domain/types.ts, src/lib/domain/income.ts, src/lib/services/money.ts, src/lib/services/backup.ts, src/lib/sync/engine.ts, supabase/migrations/*_budget_income_sources.sql; related tests.
**Interfaces:** `BudgetIncomeSource {name:string; amount:number}`, `incomeSummary(sources,allocated): {total:number; unallocated:number}`; optional Budget.income_sources.
- [ ] Failing tests: 3000+2000=5000, allowance4000 -> unallocated1000; allowance6000 -> -1000; decimals sum exactly; old budgets remain valid.
- [ ] Failing service tests: create/edit/preserve/clear sources; invalid names and sums rejected; reject income on category or weekly budget; backup roundtrip and cross-household rejection.
- [ ] Add shared Zod source validation (max30 sources, names1–60, positive amounts <=9,999,999, cents only), optional JSONB column with server validation and same household RLS.
- [ ] Extend missing-column queue protection and test recovery; verify sources on second device and backup validation.
- [ ] Run targeted unit, sync and database tests, then commit.

### Task 3: Income and allocation UI

**Files:** src/components/budget/income-panel.tsx, src/app/buget/page.tsx, e2e/income-allocation.spec.ts.
**Interfaces:** IncomePanel receives selected monthly family Budget; edits via existing createBudget/updateBudget and useAction.
- [ ] Failing browser flow: create salary3000 + salary2000, choose4000 allowance; save and reload -> total5000, unallocated1000, Home allowance4000.
- [ ] Add income panel with explicit total, chosen allowance and unallocated/shortfall; separate source labels and amounts, add/remove/edit, save together. Preserve old monthly total budget id by upgrading its scope to family when first adopting income.
- [ ] Verify changing sources leaves allowance untouched; removing source recomputes total; allocation above income saves with shortfall; invalid source drafts retain input.
- [ ] Run lint, types, full unit suite, static build and relevant browser tests. Commit.

### Task 4: Release

- [ ] Inspect SQL/RLS/advisories, verify migration locally before applying additive migration to production.
- [ ] Create PR, wait all CI checks, integrate reviewed exact commit, verify production Vercel SHA and alias.
- [ ] Report implemented behavior and verification with any material limitation.
