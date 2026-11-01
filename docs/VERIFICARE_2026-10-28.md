# Verificarea locală — 28 octombrie 2026

Scop: stabilirea unei baze verificate înaintea cercului restrâns din `.tasks/018-lansare.md`. Acest raport descrie copia locală; nu confirmă versiunea publicată sau starea PR-urilor.

## Mediul și rezultatele

- Windows, Node 24.18.0, npm 11.16.0; CI folosește Ubuntu și Node 22.
- Dependențele instalate cu `npm ci`, din lockfile, fără actualizări de versiuni.
- `npm test -- --reporter=dot`: **627/627**, 47 fișiere.
- `npm run lint`: trecut, inclusiv rularea completă după corecții și adăugarea excluderilor de cache.
- `npm run typecheck`: trecut; build-ul a repetat verificarea TypeScript cu succes.
- `npm run build`: trecut, export static și service worker cu 64 de resurse în precache.
- `npm run test:e2e -- --reporter=dot`: **52/52**, în 2,8 minute, cu serverul static pornit separat. Chromium, profil de telefon Pixel 7 și verificări desktop; acestea nu înlocuiesc proba pe dispozitive fizice.
- Testele Postgres/RLS și E2E cloud: **nerulate**. Setup-ul existent folosește utilitare și binare Linux; nu este pregătit pentru Windows. Nu s-a folosit o bază de date externă.
- Producția, Gemini real și sincronizarea între telefoane: **neverificate în această sesiune**.

## Blocaj reparat

Conversia adreselor de fișiere cu `URL.pathname` producea pe Windows căi precum `D:\D:\projects\...`. Prima rulare a build-ului s-a oprit în `copy-ocr.mjs`, iar prima suită de teste a avut 626 teste trecute și un eșec în verificarea funcțiilor Edge.

Scripturile `copy-ocr.mjs`, `build-sw.mjs`, `serve-static.mjs` și `build-functions.mjs` folosesc acum `fileURLToPath`. Punctul de intrare al scriptului funcțiilor folosește `pathToFileURL`. Cache-urile locale npm și Playwright sunt ignorate de Git. Nu s-au modificat funcțiile produsului, dependențele sau schema bazei de date.

Testul E2E `gospodăria model: cămară, listă, buget, plan` verifica prețul imediat după click, înaintea terminării navigării. Locatorul parțial găsea trei rețete pe pagina veche și eșua cu „strict mode violation”. Testul așteaptă acum URL-ul și titlul rețetei și caută textul exact. Rularea izolată după corecție: **1/1 trecut**. Prima suită a raportat 51 teste trecute și acest eșec; la închidere serverul automat a rămas agățat, deci procesul a fost oprit. Repetarea completă cu serverul pornit separat: **52/52 și închidere normală**. Problema închiderii serverului automat pe Windows nu a fost reparată; pornirea separată este soluția folosită pentru această verificare.

## Dovezi pentru fluxul principal

| Traseu | Dovadă executată |
| --- | --- |
| Bon → listă sau istoric, prețuri, potriviri învățate | `src/lib/services/receipts.test.ts` |
| Bon → cămară, doar alimente, denumirea originală, consum automat | `src/lib/services/receipts.test.ts` |
| Plan → listă → cumpărături → buget, fără dublă numărare | `src/lib/services/services.test.ts` |
| Rețetă → consum din cămară, conversii bucată/kg și lingură/grame | `src/lib/services/services.test.ts` |
| Calcul nutrițional și costuri | `src/lib/domain/recipes.test.ts`, `src/components/recipes/recipe-cost.test.ts` |
| Copia de siguranță și restaurarea fără dubluri | `src/lib/services/backup.test.ts` |
| Bon și potrivirea produselor în interfață, inclusiv OCR real cu orientare EXIF | `e2e/bonuri.spec.ts` |
| Plan → listă → cumpărare → buget → istoric, în interfață | `e2e/scenariu-duminica.spec.ts` |
| Cămară, rețete, nutriție și prețuri, în interfață | `e2e/retete-camara.spec.ts` |
| Offline, instalabilitate și mesajul de versiune nouă | `e2e/offline-pwa.spec.ts` |

Testele unitare și de servicii folosesc date și servicii simulate. Ele nu confirmă serviciile externe reale.

## Concluzie

Baza locală este verificată: 627 teste unitare/de servicii și 52 teste de browser trecute, lint, TypeScript și build curate. Nu s-a identificat un defect de produs în scenariile executate. Aceasta nu confirmă pregătirea producției pentru invitații: rămân pașii de mai jos, în special controlul datelor și verificarea cloud. Următoarea lucrare de produs este ciorna de confidențialitate din 018, pentru aprobarea proprietarului înainte de publicare.

## Înaintea invitațiilor

1. Pagina de confidențialitate și termeni, cu textele aprobate și datele operatorului completate — lucrarea 018. Pagina nu există încă în cod.
2. Ștergerea contului din aplicație și comportamentul datelor gospodăriei: de implementat și verificat. Ieșirea din cont și ștergerile logice ale rândurilor nu echivalează cu ștergerea contului.
3. Verificarea cloud pe un mediu Linux de test: conturi, roluri, RLS și sincronizare; separat, probă reală pe Android/iPhone și citirea unui bon cu serviciul AI.
4. Confirmarea versiunii publicate și a istoricului sursei: acest director nu conține `.git`; PR-urile menționate în fișele de lucru nu pot fi declarate integrate pe baza acestei copii.
5. Pregătirea limitelor și costurilor serviciilor pentru 10–20 de persoane; ghidul din lucrarea 019 rămâne planificat.

Documentele istorice `IMPLEMENTATION_STATUS.md`, `ROADMAP.md` și `CHANGELOG.md` au informații anterioare codului actual. Rezultatele din acest raport nu înlocuiesc dovezile istorice de producție și nu le extind la versiunea locală.
