# Remedieri Audit Integritate și Securitate (F05, F04, F06, F10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remedierea vulnerabilităților critice (P1/P2) identificate în auditul tehnic din 31 octombrie 2026: neutralizarea formulelor CSV (F10), prevenirea dublării cheltuielilor la reactivarea listelor (F05), atomicitatea completă Dexie la finalizarea cumpărăturilor (F06) și prevenirea pierderii modificărilor netrimise la deconectare (F04).

**Architecture:** Modificările respectă arhitectura offline-first și separarea strictă a straturilor: domeniu pur fără efecte laterale pentru CSV (`src/lib/domain/budget.ts`), servicii de date cu tranzacții atomice Dexie (`src/lib/services/shopping.ts`, `src/lib/services/queries.ts`) și interfață reactivă cu dialoguri explicite de confirmare (`src/components/app/app-provider.tsx`, `src/app/gospodarie/page.tsx`).

**Tech Stack:** TypeScript, Next.js 16, Dexie.js (IndexedDB offline-first), Vitest, Playwright.

**Spec:** Raportul de audit tehnic din 31 octombrie 2026 (`camarasecurityaudit.md` / `feaaf6fa495d9f2490ef9669f1e699f7eceadabb`), constatările F10, F05, F06 și F04.

## Global Constraints

- Păstrarea tuturor testelor existente verzi (632 teste unitare/servicii).
- Nicio degradare a performanțelor IndexedDB obținute în Etapa 6.
- Toate mesajele pentru utilizatori sunt în limba română firească, clară și concisă.
- Respectarea convențiilor de commit atomice din proiect (`feat(...)`, `fix(...)`, `test(...)`).
- Compatibilitate completă Windows și Linux.

## Review Focus

1. Formula injection în CSV: valori ce încep cu `=`, `+`, `-`, `@` sau spații/caractere de control urmate de acestea trebuie prefixate sigur fără a strica afișarea textului legitim.
2. Integritate buget: o listă cu produse cumpărate care este finalizată și apoi readusă nu trebuie să genereze niciun leu în plus în cheltuieli (10 RON rămâne 10 RON).
3. Eșec parțial la finalizare: dacă o scriere intermediară eșuează în `finalizeShopping`, nicio înregistrare parțială nu trebuie să rămână în `shopping_transactions`, `shopping_transaction_items`, `pantry_items` sau `product_prices`.
4. Pierdere de date la logout: deconectarea în timp ce există intrări în `outbox` sau `photo_uploads` nu trebuie să șteargă baza silențios; trebuie să încerce sincronizarea și să ceară confirmare explicită.
5. Reactivarea unei liste nefinalizate (doar pusă deoparte cu „Pune deoparte”) trebuie să păstreze starea produselor bifate de utilizator.

---

### Task 1: Neutralizare formule CSV în exportul de buget (F10 - P2)

**Files:**
- Modify: `src/lib/domain/budget.ts:180-202`
- Test: `src/lib/domain/budget.test.ts`

- [ ] **Step 1: Scrie testul de regresie pentru neutralizarea formulelor CSV**
  În `src/lib/domain/budget.test.ts`, adaugă un test care verifică neutralizarea valorilor ce încep cu `=`, `+`, `-`, `@` sau caractere albe urmate de acestea în câmpurile denumire, magazin și categorie.
- [ ] **Step 2: Rulează testul și confirmă eșecul**
  Rulează `npx vitest run src/lib/domain/budget.test.ts` pentru a confirma că testul eșuează pe implementarea actuală.
- [ ] **Step 3: Implementează neutralizarea formulelor în `spendToCsv`**
  În `src/lib/domain/budget.ts`, definește funcția `sanitizeFormula` care prefixează cu `'` orice valoare text ce începe cu caractere de formulă spreadsheet (`=`, `+`, `-`, `@`) și integreaz-o în procesarea celulelor CSV înainte de escaparea ghilimelelor.
- [ ] **Step 4: Rulează testul și confirmă trecerea**
  Rulează `npx vitest run src/lib/domain/budget.test.ts` și asigură-te că toate testele trec.
- [ ] **Step 5: Verificare completă și commit**
  Rulează `npm test` și creează commit-ul:
  `git commit -m "fix(security): neutralizare formule spreadsheet in exportul csv de buget (F10)"`

---

### Task 2: Eliminarea dublării cheltuielilor la readucerea listelor finalizate (F05 - P1)

**Files:**
- Modify: `src/lib/services/shopping.ts:45-47`
- Modify: `src/lib/services/queries.ts:43-80`
- Test: `src/lib/services/services.test.ts`

- [ ] **Step 1: Scrie testul de regresie pentru readucerea listei finalizate**
  În `src/lib/services/services.test.ts`, adaugă testul:
  Creează o listă ne-recurentă cu un produs de 10 RON -> bifează -> finalizează cumpărăturile -> bugetul este 10 RON. Apelează `restoreList(ctx, listId)`. Verifică starea bugetului: `status.spent` trebuie să rămână 10 RON (nu 20 RON), iar lista readusă trebuie să aibă produsele pregătite pentru o nouă sesiune (`checked: false, actual_price: null`).
- [ ] **Step 2: Rulează testul și confirmă reproducerea defectului F05**
  Rulează `npx vitest run src/lib/services/services.test.ts` și observă eșecul (bugetul sare la 20 RON).
- [ ] **Step 3: Implementează remedierea în `restoreList` și `spendRecords`**
  1. În `src/lib/services/shopping.ts`: în `restoreList`, dacă lista restaurată a fost deja finalizată (`list.cycle > 0`), debifează articolele și resetează `actual_price: null` pentru noul ciclu de cumpărături.
  2. În `src/lib/services/queries.ts`: în `spendRecords`, protecție adițională în adâncime: verifică dacă `checked_at` al produsului din lista deschisă este mai vechi decât ultima tranzacție finalizată a acelei liste; dacă da, nu îl include în `pending`.
- [ ] **Step 4: Rulează testele și confirmă rezolvarea**
  Rulează `npx vitest run src/lib/services/services.test.ts` și confirmă că noul test și toate testele existente trec.
- [ ] **Step 5: Verificare și commit**
  Rulează `npm test` și creează commit-ul:
  `git commit -m "fix(shopping): prevenire dublare cheltuieli la reactivarea listelor finalizate (F05)"`

---

### Task 3: Tranzacție atomică Dexie la finalizarea cumpărăturilor (F06 - P1)

**Files:**
- Modify: `src/lib/services/shopping.ts:290-380`
- Test: `src/lib/services/services.test.ts` (sau test dedicat `shopping-atomic.test.ts`)

- [ ] **Step 1: Scrie testul de atomicitate pentru `finalizeShopping`**
  Creează un test în care o eroare este simulată în timpul finalizării (de exemplu prin injectarea unei erori sau mock pe o scriere intermediară). Verifică faptul că tranzacția este abortată complet: nu rămân rânduri orfane în `shopping_transactions`, `shopping_transaction_items`, `product_prices` sau `pantry_items`.
- [ ] **Step 2: Implementează tranzacția atomică unificată în `finalizeShopping`**
  În `src/lib/services/shopping.ts`:
  Pre-calculează toate valorile și id-urile stabile înainte de blocul de scriere.
  Încapsulează toate scrierile (`shopping_transactions`, `shopping_transaction_items`, `product_prices`, `pantry_items`, `shopping_lists`, `shopping_list_items`) într-un singur apel:
  `await ctx.db.transaction('rw', [ctx.db.shopping_transactions, ctx.db.shopping_transaction_items, ctx.db.product_prices, ctx.db.pantry_items, ctx.db.shopping_lists, ctx.db.shopping_list_items, ctx.db.outbox], async () => { ... })`.
- [ ] **Step 3: Rulează testele de servicii și verifică atomicitatea**
  Rulează `npx vitest run src/lib/services/` și verifică atât scenariile normale, cât și cele de rollback.
- [ ] **Step 4: Verificare completă și commit**
  Rulează `npm test` și creează commit-ul:
  `git commit -m "fix(db): tranzactie atomica dexie pentru finalizarea cumparaturilor (F06)"`

---

### Task 4: Protecție la deconectare împotriva pierderii modificărilor netrimise (F04 - P1)

**Files:**
- Modify: `src/components/app/app-provider.tsx:25-48, :250-267`
- Modify: `src/app/gospodarie/page.tsx:535-545, :680-685`
- Test: `src/components/app/app-provider.test.tsx` (sau test de unitate pentru `getUnsyncedCount`)

- [ ] **Step 1: Expune verificarea modificărilor netrimise în `app-provider.tsx`**
  În `src/components/app/app-provider.tsx`:
  - Adaugă funcția `getUnsyncedCount(db: CamaraDB): Promise<{ outbox: number; photos: number; total: number }>`.
  - Actualizează `signOut`: acceptă `options?: { force?: boolean }`.
  - Înainte de deconectare, încearcă `engineRef.current?.syncNow()`. Dacă rămân date nesincronizate și `!options?.force`, returnează `{ success: false, unsynced: total }` (sau aruncă eroare controlată), fără a șterge baza Dexie.
- [ ] **Step 2: Scrie test de unitate pentru verificarea cozii nesincronizate**
  Verifică faptul că `signOut` nu șterge baza dacă există intrări în outbox și nu s-a cerut `force: true`.
- [ ] **Step 3: Adaugă confirmarea în UI în `src/app/gospodarie/page.tsx`**
  Dacă utilizatorul apasă „Ieși din cont” și există modificări nesincronizate, afișează un `ConfirmSheet` explicit:
  „Ai {N} modificări care nu au fost încă trimise la server (fără conexiune la internet). Dacă te deconectezi acum, aceste date vor fi șterse de pe acest dispozitiv.”
  Opțiuni: „Ieși oricum” (apelează `signOut({ force: true })`) și „Rămâi în cont” (anulează).
- [ ] **Step 4: Verificare completă**
  Rulează `npm test`, `npm run lint`, `npm run typecheck` și `npm run build`.
- [ ] **Step 5: Commit**
  `git commit -m "feat(auth): protectie la deconectare impotriva pierderii modificarilor nesincronizate (F04)"`

