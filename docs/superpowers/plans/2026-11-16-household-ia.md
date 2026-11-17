# Household IA Implementation Plan
> **For agentic workers:** Use superpowers:executing-plans with scoped parallel independent domains and one final whole-branch reviewer. Track RED/GREEN evidence in progress ledger.

**Goal:** Implement approved household IA and connected daily shopping/pantry/budget flows.
**Architecture:** Preserve domain services and routes; add shared capture UI and read-only transaction projection, compatible nullable SQL fields. Independent file ownership permits scoped agents under dispatching-parallel-agents.
**Tech Stack:** Next.js16 static export, React19, TypeScript, Dexie, Supabase, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-16-household-ia.md

## Global Constraints
Preserve existing records, routes and twelve family categories. No fabricated prices/quantities, no duplicate spend/stock. Warm palette exact spec values, min44px targets, safe bottom100px+inset. Active household name dynamic. No Google auth changes. Migrations before production. User already authorized implementation; no repeated approval gates.

## Review Focus
- Total-only receipt adjustment counted once including negative differences and unknown item amounts.
- Partial/recurring finalization preserves unchecked items and never reimports prior checked stock.
- Free-text and nonfood lines do not silently invent stock quantities or erase records.
- Keyboard/safe area/FAB do not hide final rows or sheet save button.
- Household boundaries, old backups, and old server schema compatibility.

### Task 1: Purchase domain and data compatibility
Owner scoped agent. Files services/shopping.ts, queries.ts, expenses.ts, domain/types.ts,budget.ts, related tests, backup/sync serializers and new SQL migration.
Interfaces: finalizeShopping(ctx,listId,{addToPantry,totalPaid?,retailerId?}); ShoppingTransaction.declared_total?:number|null; ManualExpense optional place_name,retailer_id,source,note. spendRecords projects delta once under synthetic unallocated record without price entries. dailyBudgetAvailable(remaining,today) returns number using inclusive days.
- [x] Write failing service tests for total-only, difference, partial/recurring, repeated finalize, source/place metadata and daily boundary; run targeted Vitest, expected new assertions fail.
- [x] Implement atomic compatible extensions and migrations, preserve old APIs/cases.
- [x] Run targeted tests then full unit suite, expected pass; report evidence and changed paths.

### Task 2: Recipes IA
Owner scoped agent. Files recipe pages/components, kitchen recipe validation, recipe taxonomy and own SQL migration only. Avoid types.ts ownership conflict: request de_post union addition from Task1 owner.
Interfaces: existing addMeal/cookRecipe remain; explicit de_post tag accepted in types/validation/SQL; no automatic diet inference.
- [x] Add meaningful filter mapping tests and run RED.
- [x] Build7category single strip, advanced filters, count, Collection switch, remove no-photo placeholders, consistent Am gătit.
- [x] Verify tests/typecheck in own scope and report.

### Task 3: Pantry and shopping UI
Owner scoped agent. Files pantry/shopping pages, own service pantry-exceptions.ts and tests, ProductSearch optional presentation props. No edits shopping.ts/types.ts/shell/global CSS.
Interfaces: use Task1 finalizeShopping options; shared capture opens through dispatchCapture({mode:'manual'|'scan'|'shopping',listId?}) exported components/capture/events.ts supplied by root. Atomic finish-to-list service owned here.
- [x] Write failing atomic pantry exception tests, run RED.
- [x] Implement distinct fields/swipe accessible alternative/place chips/details and per-item place; Am plătit total/place/finalize uses Task1 service, scanner passes list context; preserve unchecked. Remove duplicate/financial UI.
- [x] Run domain tests/typecheck and report.

### Task 4: Global capture, home and budget integration
Owner root. Files shell.tsx,globals.css,components/capture/*,home screen,budget page/components and new finance projection helpers/tests.
Interfaces: dispatchCapture event consumed by singleton CaptureHost in AppShell; manual and scanner modes share sheet, scanner reuses existing OCR review component. Transaction feed groups actual trips, manuals and pending with stable identities; selectors include authoritative total deltas. DailyBudgetAvailable Task1.
- [x] Add failing projection/daily/interaction tests as needed; run RED.
- [x] Warm global tokens/header/nav/spacing/FAB; build shared sheet with place/category/date/note and scanner reuse.
- [x] Refactor Home to3compact sections and Budget unified transactions/categories/history; wire all actions to shared host.
- [x] Verify focused tests, typecheck and lint.

### Task 5: Verification and review
- [x] Full unit, database checks when available, typecheck/lint/static production build, browser flows at mobile/desktop and dark theme.
- [x] Fresh whole-branch reviewer checks spec coverage and correctness with diff artifact and ledger.
- [x] Fix important findings with regression tests; record any blocked external checks precisely. Commit reviewable implementation; no claim of production deployment without evidence.
