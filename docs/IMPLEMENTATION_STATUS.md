# Starea implementării

Actualizat: 11 octombrie 2026, ramura `claude/camara-v1`.

## Criteriile de acceptanță 1–22
DE COMPLETAT: lista criteriilor din „Master prompt” (conversația din 11 oct. 2026) nu e în repo. Proprietarul o adaugă aici; fiecare criteriu se bifează doar cu dovada de mai jos (testul care îl acoperă) sau rămâne nebifat.

| # | Criteriu | Stare | Dovada |
| --- | --- | --- | --- |
| 1–22 | DE COMPLETAT | nebifat | |

## Ce e dovedit de teste (rularea din 11 oct. 2026)
`npm test` 99/99 · `npm run test:db` 24/24 · `npx playwright test` 15/15 · `npm run test:e2e:cloud` 1/1 (de 6 ori la rând) · `npm run build`, `tsc --noEmit`, `eslint` curate.

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
| Sincronizare: modificări offline, câmpuri diferite fără pierderi, ultima modificare câștigă pe același câmp, ștergeri, refuzurile serverului, paginare | `src/lib/sync/engine.test.ts` |
| Logica: unități, cantități, căutare, prețuri, rețete, listă, buget, cămară, date, bani, import CSV | `src/lib/domain/*.test.ts` |
| Catalogul e valid și `seed.sql` e la zi | `src/data/catalog.test.ts` |

## Ce nu e făcut
Vezi [ROADMAP.md](ROADMAP.md): notificări push de pe server, fotografii, valori nutriționale, prețuri din cataloagele magazinelor.

## Ce așteaptă proprietarul
- Lista criteriilor 1–22, ca să fie bifate aici.
- Proiectul Supabase și cel Vercel ([DEPLOYMENT.md](DEPLOYMENT.md)).
