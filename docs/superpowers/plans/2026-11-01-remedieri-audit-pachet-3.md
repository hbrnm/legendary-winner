# Remedieri Audit Pachet 3 (F12, F11, F02/F03, F14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalizarea ultimelor remedieri din raportul de audit tehnic din 31 octombrie: mascarea erorilor brute `JSON.parse` în Edge functions pentru protecția confidențialității (F12), limitarea dimensiunii fluxului HTTP primit pentru funcțiile Edge (F11), resetarea cursorilor de sincronizare la adăugarea unei gospodării noi și curățarea datelor locale la revocarea accesului (F02, F03), și actualizarea de securitate a dependenței `zod` (F14).

**Architecture:** 
1. Pentru funcțiile Edge (`src/lib/server/edge-body.ts`, `translate-recipe.ts`, `read-receipt.ts`, `import-recipe.ts`), citirea corpului cererii se realizează pe bucăți (stream) cu contor de octeți și respingere `413 (too_large)` la depășirea limitei chiar și fără antet `Content-Length`. Erorile de parsare JSON sunt mascate cu mesaje fixe pentru a preveni citarea conținutului utilizatorului în jurnale.
2. Pentru sincronizare (`src/lib/sync/engine.ts`, `src/lib/db/database.ts`, `src/components/app/app-provider.tsx`), memorăm gospodăriile cunoscute sincronizate. Când apare o gospodărie nouă, invalidăm cursorii `cursor:*` pentru a forța reconcilierea datelor istorice; când o gospodărie este revocată, eliminăm datele orfane din tabelele locale Dexie.
3. Pentru dependențe, actualizăm `zod` la `>=4.6.6` pentru eliminarea vulnerabilității de Denial of Service (GHSA-mrhx-c7xc-m3w5).

**Tech Stack:** TypeScript, Next.js 16, Supabase Edge Functions (Deno / esbuild), Web Streams API, Dexie.js (IndexedDB), Zod, Vitest.

**Spec:** Raportul de audit tehnic din 31 octombrie 2026 (`camarasecurityaudit.md`), constatările F12, F11, F02, F03, F14.

## Global Constraints

- Toate testele existente (642 teste) trebuie să rămână verzi.
- Mesajele de eroare și jurnalele sunt anonimizate și nu expun date personale sau textul rețetelor/bonurilor.
- Fiecărei sarcini îi corespunde un ciclu TDD strict (reproducere/failing -> fix -> passing -> commit atomic).
- După orice modificare în `src/lib/server/`, se rulează `npm run build:functions` pentru actualizarea fișierelor împachetate `core.js`.
- Compatibilitate deplină Windows și Linux.

## Review Focus

1. Text utilizator în jurnale: o eroare de sintaxă JSON din răspunsul AI nu trebuie să citeze bucăți din rețetă în mesajul erorii logate.
2. Ocolire limite fără Content-Length: o cerere HTTP streamuită cu payload uriaș către funcțiile Edge trebuie întreruptă imediat ce depășește plafonul de octeți, fără a aloca memorie excesivă.
3. Extindere acces gospodărie nouă: când utilizatorul este adăugat într-o gospodărie cu date mai vechi decât cursorul curent, datele din noua gospodărie trebuie descărcate integral.
4. Revocare gospodărie: la reconectare/refresh, datele locale ale unei gospodării din care utilizatorul a fost exclus trebuie eliminate curat din IndexedDB.
5. Compatibilitate patch Zod: actualizarea `zod` nu trebuie să introducă regresii în validarea schemelor de backup, rețete sau formulare.

---

### Task 1: Mascare erori JSON.parse în `translate-recipe` (F12 - P3)

**Files:**
- Modify: `src/lib/server/translate-recipe.ts:160-165`
- Test: `src/lib/server/translate-recipe.test.ts`
- Generated: `supabase/functions/translate-recipe/core.js`

- [x] **Step 1: Scrie testul de regresie pentru confidențialitatea erorii (F12)**
  În `src/lib/server/translate-recipe.test.ts`, adaugă un test în care serviciul AI returnează un JSON invalid care conține un marker confidențial sintetic (ex. `{"recipe": "SECRET_RECIPE_TEXT_XYZ"...`). Interceptează `console.error` și verifică faptul că `SECRET_RECIPE_TEXT_XYZ` NU apare în jurnal.
- [x] **Step 2: Rulează testul și confirmă eșecul**
  Rulează `npx vitest run src/lib/server/translate-recipe.test.ts` și observă că `JSON.parse` include citatul în `SyntaxError: ...`.
- [x] **Step 3: Implementează mascarea erorii în `translate-recipe.ts`**
  În `src/lib/server/translate-recipe.ts`:
  ```ts
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("răspunsul AI nu are forma cerută");
  }
  ```
- [x] **Step 4: Rulează testele și actualizează bundle-ul funcției**
  Rulează `npx vitest run src/lib/server/translate-recipe.test.ts` și `npm run build:functions`. Confirmă că `scripts/build-functions.test.ts` trece.
- [x] **Step 5: Commit**
  `git commit -m "fix(security): mascare eroare json.parse in translate-recipe (F12)"`

---

### Task 2: Limitarea dimensiunii fluxului HTTP în Edge Functions (F11 - P2)

**Files:**
- Create: `src/lib/server/edge-body.ts`
- Modify: `src/lib/server/translate-recipe.ts:173-180`
- Modify: `src/lib/server/read-receipt.ts:178-185`
- Modify: `src/lib/server/import-recipe.ts:301-306`
- Test: `src/lib/server/edge-body.test.ts`
- Generated: `supabase/functions/*/core.js`

- [x] **Step 1: Scrie testele unitare pentru `readJsonBody`**
  Creează `src/lib/server/edge-body.test.ts` cu teste pentru:
  - Corp valid sub limită -> returnează `{ ok: true, data }`.
  - Content-Length depășit -> respinge imediat cu `{ ok: false, status: 413, error: "too_large" }`.
  - Stream fără Content-Length dar cu octeți peste limită -> întrerupe stream-ul și returnează `{ ok: false, status: 413, error: "too_large" }`.
  - JSON invalid -> returnează `{ ok: false, status: 400, error: "bad_request" }`.
- [x] **Step 2: Implementează `readJsonBody` în `src/lib/server/edge-body.ts`**
  Implementează citirea pe bucăți din `req.body` (`ReadableStream<Uint8Array>`), decodarea cu `TextDecoder` și parsarea în siguranță cu plafon maxim de octeți.
- [x] **Step 3: Integrează `readJsonBody` în cele 3 handlere Edge**
  Înlocuiește citirea `req.json()` cu `readJsonBody(req, limits.maxBody)` în `translate-recipe.ts`, `read-receipt.ts` și `import-recipe.ts`.
- [x] **Step 4: Rulează toate testele de server și actualizează bundle-urile**
  Rulează `npx vitest run src/lib/server/` și `npm run build:functions`. Asigură-te că `scripts/build-functions.test.ts` trece.
- [x] **Step 5: Commit**
  `git commit -m "fix(security): limitare flux octeti in functiile edge fara content-length (F11)"`

---

### Task 3: Resetare cursori sincronizare și curățare date la schimbarea apartenenței (F02, F03 - P2)

**Files:**
- Modify: `src/lib/db/database.ts`
- Modify: `src/lib/sync/engine.ts`
- Modify: `src/components/app/app-provider.tsx`
- Test: `src/lib/sync/membership.test.ts`

- [ ] **Step 1: Scrie testul de regresie pentru cursori și reconciliere apartenență (F02 & F03)**
  Creează `src/lib/sync/membership.test.ts`:
  - Test F02: Când apare o gospodărie nouă în lista utilizatorului, cursorii de pull sunt resetați pentru a asigura importul complet al istoricului noii gospodării.
  - Test F03: Când un utilizator este revocat dintr-o gospodărie (nu mai apare în `household_members`), rândurile locale aparținând acelei gospodării sunt șterse din tabelele sincronizate Dexie.
- [ ] **Step 2: Rulează testul și confirmă eșecul**
  Confirmă că în prezent cursorii nu sunt invalidați și rândurile orfane rămân în baza de date locală.
- [ ] **Step 3: Implementează `resetPullCursors` și `purgeHouseholdData`**
  - În `src/lib/db/database.ts`:
    - Adaugă `resetPullCursors(db: CamaraDB): Promise<void>`.
    - Adaugă `purgeHouseholdData(db: CamaraDB, householdId: string): Promise<void>`.
  - În `src/components/app/app-provider.tsx`:
    - La `loadHouseholds` / `refreshHouseholds`, compară lista nouă de ID-uri cu cea anterior sincronizată:
      - Dacă există ID-uri noi -> apelează `resetPullCursors(db)`.
      - Dacă există ID-uri revocate -> apelează `purgeHouseholdData(db, revokedId)`.
      - Actualizează `synced_households` în meta.
- [ ] **Step 4: Rulează testul și confirmă trecerea**
  Rulează `npx vitest run src/lib/sync/membership.test.ts` și asigură-te că toate testele trec.
- [ ] **Step 5: Commit**
  `git commit -m "fix(sync): resetare cursori la gospodarie noua si curatare date la revocare (F02, F03)"`

---

### Task 4: Actualizare de securitate `zod` (F14 - P3)

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Verifică versiunea de patch Zod disponibilă**
  Verifică dacă versiunea `4.6.6` rezolvă GHSA-mrhx-c7xc-m3w5.
- [ ] **Step 2: Actualizează dependența `zod` în mod controlat**
  Rulează `npm install zod@^4.6.6 --save-exact` sau actualizează la ultima versiune compatibilă de patch, fără `--force`.
- [ ] **Step 3: Verifică `npm audit`**
  Confirmă că vulnerabilitatea Zod nu mai apare în `npm audit`.
- [ ] **Step 4: Rulează verificarea completă a suitei de teste**
  Rulează `npm test`, `npm run lint`, `npm run typecheck` și `npm run build`.
- [ ] **Step 5: Commit**
  `git commit -m "fix(security): actualizare zod pentru eliminare vulnerabilitate colectii nesupravegheate (F14)"`
