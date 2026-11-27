# Audit de securitate Cămara

**Risc ridicat** pe baza controlului de autorizare din schema de membri. Analiză la 27 noiembrie 2026 pe commitul `41cb95a659c0cdcfaff70476a0a1a500446ff902`. Scor ordinal **3/4** (1 scăzut, 2 mediu, 3 ridicat, 4 critic). Scorul reflectă cea mai gravă constatare confirmată în cod.

## Rezumat

| ID | Severitate | Verdict | Constatare |
| --- | --- | --- | --- |
| SEC-001 | High | confirmed | Restrânge modificarea membrilor la coloana role |
| SEC-002 | High | needs_validation | Leagă validarea destinației importului de conexiunea efectivă |
| SEC-003 | Medium | confirmed | Actualizează lanțul de dependențe de test și lint |
| SEC-004 | Low | confirmed | Tratează erorile de parsare ale serverului static local |
| SEC-005 | Medium | confirmed | Verifică integritatea binarelor descărcate pentru testele cloud |
| SEC-006 | Low | needs_validation | Verifică anteturile de protecție ale aplicației publicate |
| SEC-007 | Low | confirmed | Aplică o limită comună pentru căutarea nutrițională |
| SEC-008 | Informational | rejected | Execuție SQL arbitrară în RPC-ul de finalizare |
| SEC-009 | Informational | rejected | Citire publică a bucketului de fotografii |
| SEC-010 | Medium | confirmed | Șterge fișierele prin API-ul Storage la închiderea contului |

## Acoperire și limite

- Inventar de 561 fișiere urmărite. Analiza a acoperit punctele de intrare React/Next.js, autentificarea Supabase, politicile Postgres și Storage, funcțiile Edge, integrarea Gemini și Open Food Facts, backupul, sincronizarea Dexie, service workerul, scripturile locale, CI și lockfile-ul.
- Browser → Supabase Auth, REST, Realtime și Storage. Politicile RLS separă gospodăriile. Datele offline se păstrează local. Funcțiile Edge procesează URL-uri de rețete, imagini de bon și căutări nutriționale.
- Importurile și răspunsurile AI au fost urmărite până la parserele și validările din aplicație. Scripturile CI și pachetele de dezvoltare au fost evaluate separat de exportul static de producție.
- Sursa, migrațiile și suita locală au fost accesibile. Configurația găzduită, WAF, egress, setările Auth și jurnalele de producție rămân nevalidate. Scanarea de secrete a verificat tipare uzuale în fișierele urmărite din snapshot, cu zero fișiere semnalate. Istoricul Git și secretele de runtime sunt în afara acestei verificări.

## Verificări

- `npm test -- --maxWorkers=2` — 915 teste trecute.
- `npm run test:db` — 76 teste trecute pe PostgreSQL 16 izolat cu shim Supabase. Testele existente pentru membri acoperă rolul, dar nu imutabilitatea cheilor de identitate.
- `npm audit --json` — 11 intrări afectate, 2 critice, 1 ridicată și 8 moderate. Numărul include dependențe afectate prin propagare.
- `npm audit --omit=dev --json` — zero intrări semnalate în arborele npm de producție la data verificării.

## Ordinea remedierilor

1. Restrânge actualizarea membrilor și adaugă regresii pentru imutabilitatea cheilor și permisiunile de rol.
2. Validează politica de ieșire a importului și leagă verificarea adresei de conexiunea efectivă.
3. Actualizează dependențele de test și verifică integritatea binarelor din CI.
4. Corectează ștergerea fotografiilor prin API-ul Storage, apoi tratează serverul local, anteturile și cota comună.

[Detalii tehnice](FINDINGS-DETAIL.md) · [Registru JSON](findings.json)
