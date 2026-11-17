# Lotul 1 — acțiuni contextuale, Acasă, Cămară și Rețete

Implementare locală pe branch-ul `work`, fără commit, push sau publicare. Modificările anterioare Modern Web Guidance au fost păstrate. Planul de referință: `docs/superpowers/plans/2026-11-17-contextual-actions.md`.

## Rezultat

- Un singur CaptureHost alege acțiunile după rută. Acasă are meniul rapid; Rețete are creare/import; Cămară deschide direct formularul; Buget are cheltuială/venit. Pe Cumpărături există temporar adăugarea în listă și crearea listei, inclusiv pe pagina unei liste.
- Camera este declanșată sincron de un input deja montat. Fișierul selectat intră direct în citire, o singură dată; rezultatul poate fi reîncadrat. Unmount-ul cititorului ignoră rezultatele întârziate. O sesiune nouă resetează draftul manual și fotografia anterioară.
- Acasă afișează o singură masă din intervalul curent, preferând masa planificată. Au dispărut butoanele Cheltuială/Scanează bon din cardul bugetului și scurtătura redundantă + Listă. Istoric este în antetul secțiunii, în afara zonei acoperite de FAB. Cele trei blocuri încap la 390 × 844 în ambele teme cu datele demonstrative.
- Cămară are adăugare într-un singur formular: autocomplete, cantitate/unitate și locație; expirarea și observațiile sunt opționale. Editorul produselor existente păstrează datele sale, inclusiv consumul automat. Autocomplete-ul formularului nu mai suprapune bara flotantă de cantități peste câmpurile următoare.
- Rețete are acțiunile în FAB, un singur contor vizibil și filtrul strict Gata de gătit lângă Toate. Filtrul de acoperire parțială rămâne separat. Cantitățile insuficiente/necunoscute și unitățile incompatibile nu confirmă disponibilitatea; ingredientele opționale și excepțiile existente sare/piper/apă sunt respectate. Miniaturile existente și prioritatea imaginilor din etapa anterioară sunt păstrate.
- Lista activă este aleasă determinist și reținută local pe utilizator/mod/gospodărie. Lista deschisă explicit și lista nou creată devin selecția comună. Adăugarea în pagina unei liste folosește ID-ul acelei liste. Datele vechi sunt mascate la schimbarea gospodăriei; serviciul addItem refuză liste străine, șterse sau arhivate înainte de scriere.

## Decizii și delimitări

1. Am folosit checkout-ul cloud deja izolat și branch-ul `work`, păstrând toate modificările existente. Nu am creat alt worktree. Dacă este necesară o separare a commit-urilor, trebuie delimitate întâi modificările anterioare din aceleași fișiere.
2. Am lăsat restructurarea completă a Bugetului și meniul avansat de Cumpărături pentru lotul 2. Formularele vechi nu au fost eliminate înainte să aibă înlocuitori. IncomePanel a primit doar deschiderea externă și restaurarea focusului; extragerea editorilor de venituri/plafon rămâne pentru lotul 2.
3. Formularul de Cămară afișează opțiuni pentru câmpurile existente în PantryItem. Nu am introdus brand/preț fără model de stocare; dacă acestea sunt dorite în stoc, necesită o cerință separată.
4. Preferința listei este locală, nu sincronizată între dispozitive. Datele listelor/articolelor folosesc în continuare serviciile și outbox-ul existente.
5. Nicio integrare, ștergere a checkout-ului sau commit automat: ar amesteca modificările necomise anterioare. Codul este disponibil pentru revizie în workspace.
6. Camera nativă și tastatura unui Android/iPhone fizic nu pot fi validate prin Chromium desktop. Testele de browser verifică inputul cu capture, filechooser-ul, orientarea EXIF, citirea și fluxul de verificare, fără a pretinde validare pe dispozitiv real.

## Verificare

- Baseline: 777 teste unitare trecute înainte de lot.
- Final: `npm test -- --maxWorkers=2` — **83 fișiere, 794 teste trecute**.
- `npm run lint`, `npm run typecheck`, `git diff --check` — trecute, fără erori sau avertismente ESLint finale.
- `npm run build` — export static și service worker generate cu succes după ultimele corecții de cod.
- Rularea E2E completă, telefon și desktop: **93 scenarii executate, 90 trecute inițial și 3 eșecuri investigate**. Două au reprodus închiderea incorectă a formularului manual după salvare; al treilea a fost selectorul ambiguu din noul test de destinație listă.
- După corectare, cele 12 scenarii din contextual-actions, household-ia și family-budget au fost reverificate: **11 trecute**, iar testul listei a mai expus o presupunere nejustificată despre primul rezultat al căutării fuzzy. Aserțiunea a fost limitată corect la obiectivul testului: un articol în B și zero în A. Retestarea acelui scenariu: **1 trecut**. Niciun eșec cunoscut nu a rămas nerezolvat; nu a fost repetată întreaga suită de 93 după aceste corecții, ci scenariile afectate.
- Citire reală OCR, worker și fallback, recitire offline, fotografii, export/import de backup, buget, navigare și layout pe desktop/mobil: acoperite de suitele executate.
- Revizie independentă: au fost remediate destinația greșită în lista detaliată, creare pe aceeași rută, resetarea draftului la cameră și validarea gospodăriei/listei; restaurarea focusului pentru handoff-ul către venituri a fost de asemenea corectată. Nu există observații de review amânate.
- Nerulate: Supabase local/cloud E2E și verificare pe dispozitive fizice. Nu au fost necesare dependențe noi sau migrații de bază de date.

## Următorul lot

Lotul 2: Cumpărături cu deschidere directă și dropdown, copiere din istoric, editorii de Buget/Venituri controlați și eliminarea cardurilor/butoanelor redundante. Importurile TXT/CSV/PDF rămân lotul 3.
