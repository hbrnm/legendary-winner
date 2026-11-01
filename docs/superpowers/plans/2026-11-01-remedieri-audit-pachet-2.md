# Remedieri Audit Pachet 2 (F08, F07, F01, F13) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementarea pachetului 2 de remedieri din auditul tehnic din 31 octombrie: validarea de schemă la importul de backup (F08), operații atomice de modificare a cantităților în cămară (F07), protecția RLS la invitațiile de gospodărie împotriva escaladării rolului prin UPDATE (F01) și navigarea cu săgețile tastaturii în componenta Segmented radio (F13).

**Architecture:** Modificările consolidează securitatea și integritatea sistemului la toate nivelurile: politici SQL / triggers Supabase (`supabase/migrations/20261101000002_invitations_update.sql`), validare strictă per tabel cu Zod la importul de backup (`src/lib/services/backup.ts`), tranzacții atomice Dexie pentru modificarea cantităților (`src/lib/services/kitchen.ts`) și implementarea completă a standardului WAI-ARIA Radio Group (`src/components/ui/fields.tsx`).

**Tech Stack:** TypeScript, Next.js 16, Dexie.js (IndexedDB), PostgreSQL / Supabase SQL, Zod, Vitest.

**Spec:** Raportul de audit tehnic din 31 octombrie 2026 (`camarasecurityaudit.md`), constatările F08, F07, F01 și F13.

## Global Constraints

- Toate testele existente (637 teste) trebuie să rămână verzi.
- Mesajele de eroare și UI sunt în limba română clară și utilă.
- Fiecare sarcină se dezvoltă prin TDD (test reprodus / failing -> implementare -> test passing -> commit atomic).
- Compatibilitate deplină Windows și Linux.

## Review Focus

1. Backup malformat: importul unui fișier JSON de backup care conține date corupte (ex. `scope: null` pe bugete sau tipuri invalide) trebuie respins atomic înainte de a modifica baza de date.
2. Concurență cantități cămară: apeluri concurente `adjustPantry` pe același produs trebuie să se execute serializat în Dexie, fără ca operațiile să se suprascrie reciproc.
3. Escaladare rol invitație: un apel direct de UPDATE pe tabela SQL `household_invitations` nu trebuie să poată modifica `role`, `expires_at`, `email` sau `token`.
4. Navigare tastatură radio: apăsarea tastelor `ArrowRight` / `ArrowDown` și `ArrowLeft` / `ArrowUp` în `Segmented` trebuie să mute selecția și focusul ciclic conform WAI-ARIA, cu `tabIndex={0}` doar pe elementul selectat.

---

### Task 1: Validare de schemă la importul de backup (F08 - P2)

**Files:**
- Modify: `src/lib/services/backup.ts`
- Test: `src/lib/services/backup.test.ts`

- [ ] **Step 1: Scrie testul de regresie pentru backup invalid (F08)**
  În `src/lib/services/backup.test.ts`, adaugă un test care încearcă să importe un backup conținând un rând invalid (ex. un buget cu `scope: null` sau fără `amount`). Confirmă că importul este respins și aruncă `UserError`, iar baza de date rămâne neschimbată.
- [ ] **Step 2: Rulează testul și confirmă eșecul**
  Rulează `npx vitest run src/lib/services/backup.test.ts` pentru a confirma că în prezent importul acceptă rândul corupt.
- [ ] **Step 3: Implementează validarea de schemă per tabel și tranzacția atomică în `backup.ts`**
  În `src/lib/services/backup.ts`:
  - Definește validatori sau folosește schemele Zod existente pentru fiecare tabel sincronizat din `SYNCED_TABLES`.
  - Validează fiecare rând înainte de inserare; dacă un rând este invalid, respinge întregul fișier cu un mesaj de eroare prietenos.
  - Învelește procesul de import într-o tranzacție Dexie comună pentru consistență atomică.
- [ ] **Step 4: Rulează testele și confirmă trecerea**
  Rulează `npx vitest run src/lib/services/backup.test.ts` și asigură-te că toate testele trec.
- [ ] **Step 5: Verificare completă și commit**
  Rulează `npm test` și creează commit-ul:
  `git commit -m "fix(backup): validare de schema si tranzactie atomica la importul copiei de siguranta (F08)"`

---

### Task 2: Actualizări atomice pentru cantități în cămară (F07 - P2)

**Files:**
- Modify: `src/lib/services/kitchen.ts:233-237`
- Test: `src/lib/services/kitchen.test.ts` (sau `src/lib/services/services.test.ts`)

- [ ] **Step 1: Scrie testul de concurență pentru `adjustPantry`**
  Creează un test în care se apelează simultan `adjustPantry` de mai multe ori (ex. 3 apeluri `adjustPantry(ctx, id, 1)` peste cantitatea inițială 1). Verifică dacă cantitatea finală este 4 (nu 2).
- [ ] **Step 2: Rulează testul și confirmă pierderea de operații**
  Rulează testul și observă că fără tranzacție atomică, actualizările concurente se pierd.
- [ ] **Step 3: Implementează tranzacția atomică în `adjustPantry`**
  În `src/lib/services/kitchen.ts`:
  Învelește citirea și scrierea cantității într-o tranzacție Dexie pe `[ctx.db.pantry_items, ctx.db.outbox]`. Dexie va serializa execuția pe tabel și va asigura că fiecare citire preia valoarea deja comisă a operației anterioare.
- [ ] **Step 4: Rulează testul și confirmă trecerea**
  Rulează testul și confirmă că rezultatul este corect (cantitatea reflectă toate modificările).
- [ ] **Step 5: Verificare completă și commit**
  Rulează `npm test` și creează commit-ul:
  `git commit -m "fix(pantry): tranzactie atomica dexie pentru actualizarea cantitatilor concurente (F07)"`

---

### Task 3: Securizare UPDATE pe invitații în Supabase SQL (F01 - P2)

**Files:**
- Create: `supabase/migrations/20261101000002_invitations_update.sql`
- Test: `supabase/tests/rls.test.ts`

- [ ] **Step 1: Scrie testul SQL / RLS pentru prevenirea escaladării rolului prin UPDATE**
  În `supabase/tests/rls.test.ts`, adaugă o verificare în care un administrator încearcă să execute UPDATE pe o invitație pentru a-i modifica `role = 'admin'` sau `expires_at`. Verifică dacă operația este respinsă de PostgreSQL.
- [ ] **Step 2: Creează migrația SQL `20261101000002_invitations_update.sql`**
  - Actualizează politica RLS `"administratorii revocă"` pentru a cere `with check (public.is_household_admin(household_id) and accepted_at is null and revoked_at is not null)`.
  - Adaugă un trigger `before update on public.household_invitations` care interzice modificarea coloanelor `id`, `household_id`, `token`, `role`, `email`, `created_by`, `created_at`, `expires_at`, `accepted_at`.
- [ ] **Step 3: Rulează testul RLS**
  Rulează testul de verificare a politicii pentru a valida că securizarea funcționează corect.
- [ ] **Step 4: Commit**
  `git commit -m "feat(sql): migratie securizare update invitatii impotriva escaladarii rolului (F01)"`

---

### Task 4: Navigare cu săgețile tastaturii în Segmented (F13 - P3)

**Files:**
- Modify: `src/components/ui/fields.tsx:118-135`
- Test: `src/components/ui/segmented.test.tsx`

- [ ] **Step 1: Scrie testul de accesibilitate tastatură pentru `Segmented`**
  Creează un test unitar React care verifică comportamentul WAI-ARIA radio group:
  - Butonul selectat are `tabIndex={0}`, cele neselectate au `tabIndex={-1}`.
  - La apăsarea `ArrowRight` / `ArrowDown`, selecția trece la următoarea opțiune (cu wrap la prima).
  - La apăsarea `ArrowLeft` / `ArrowUp`, selecția trece la opțiunea anterioară (cu wrap la ultima).
- [ ] **Step 2: Rulează testul și confirmă eșecul**
  Rulează testul pe componenta actuală și confirmă că tastele săgeți nu sunt gestionate.
- [ ] **Step 3: Implementează navigarea WAI-ARIA în `Segmented`**
  În `src/components/ui/fields.tsx`:
  - Calculează `tabIndex={value === o.value ? 0 : -1}`.
  - Adaugă handler `onKeyDown` pentru navigare cu săgeți (`ArrowRight`, `ArrowLeft`, `ArrowDown`, `ArrowUp`).
- [ ] **Step 4: Rulează testul și confirmă trecerea**
  Rulează testul și asigură-te că trece.
- [ ] **Step 5: Verificare completă a suitei și commit**
  Rulează `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` și creează commit-ul:
  `git commit -m "fix(a11y): navigare tastatura wai-aria radio in componenta segmented (F13)"`
