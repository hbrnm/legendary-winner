# Ritm — uniformizare completă

Obiectiv autorizat: toate ecranele folosesc direcția Ritm aprobată, păstrând funcțiile și datele. Meniul mobil activ rămâne fără fundal, cu text lavandă și pictogramă caisă (ultima ajustare aprobată).

## Implementare
- [x] Formulare, segmente, ferestre și stări comune: suprafețe tonale, raze16/28 px, antete consistente, butoane48 px, focus vizibil.
- [x] Paginile principale și detaliile: Acasă, liste/listă/bon/istoric, rețete/detaliu/editor/import, plan, buget/prețuri/diverse, cămară.
- [x] Administrare și gospodărie: liste grupate, setări, backup, membri/invitații și ferestre aferente.
- [x] Pagini independente: autentificare/înregistrare/resetare, invitație, offline, termeni/confidențialitate.
- [x] Verificare: contrast, tokenuri, teste, lint/typecheck/build, browser la360/393 px și desktop, luminos/întunecat. Fără schimbări la backend sau publicare.

## Reguli vizuale
Carduri de conținut28 px, controale și subsecțiuni16 px, butoane/segmente pastilă, antete32 px bold, foi de editare24 px bold. Culori numai prin tokenurile existente. Stările destructive rămân distincte de accentul caisă. Textele existente și ordinea operațiilor se păstrează.

## Arie de verificare
Pagini accesibile în demo: toate rutele statice; formularele de editare, import text, bon scris/fișier, planificare, prețuri, buget, inventar, administrare și setări. Ramurile care cer cont real (autentificare online, membri/invitații valide) sunt adaptate în sursă și folosesc componente comune; verificarea în demo nu confirmă servicii Supabase live.


## Dovezi și corecții
- Teste unitare: 52 fișiere, 657 teste, toate trec după ultimele ajustări.
- Lint, typecheck și build de producție trec. Fără dependențe noi, schema/autentificarea/sincronizarea nu sunt modificate.
- Audit automat: 21 rute ×2 teme,42 capturi, fără elemente ieșite din viewport; imaginile sunt în `/workspace/camara-ritm/uniform/`. Ruta de autentificare poate redirecționa în demo, deci captura ei tranzitorie nu reprezintă verificarea formularului online.
- Inspectate separat ferestrele de buget și preț la360 px. Câmpurile păstrează text de 16 px și nu depășesc fereastra.
- Revizie independentă: nicio problemă critică/importantă de logică. Semnalat rândul comenzilor săptămânii la360 px; reprodus prin test (marginea butonului la358 px față de limita conținutului340 px), apoi compactat.
- Suprapunerea etichetelor „Supermarket”/„Producător” în selectorul cu 4 opțiuni a fost reprodusă prin test geometric și corectată cu două coloane pe telefoanele sub 480 px, păstrând etichetele lizibile și ținte de minimum 48 px.
- Testul pentru nume lung folosește acum o listă cu un produs, pentru selecție deterministă față de lista implicită goală când ceasul de test este fixat.
- Rularea completă inițială: 66 scenarii trec, 1 test avea configurația nedeterministă menționată. Verificarea finală țintită este consemnată mai jos după încheiere.


## Rezultat final
- Verificarea țintită de 21 de scenarii: 19 trec, două proiecte au reprodus încă eticheta prea lată. Selectorul cu patru opțiuni a fost apoi adaptat la două coloane sub 480 px.
- Ultima rulare: 5/5 scenarii trec, inclusiv selectorul în ambele proiecte, salvarea/compararea unui preț și întregul control al ecranelor la 360 px în ambele teme. Testele comenzilor săptămânii și numelui lung au trecut în rularea țintită anterioară.
- Cumulat, toate cele 71 de scenarii browser unice sunt validate în rulările descrise; nu există o singură rulare finală de 71 de scenarii.
- Ultima suită unitară: 52 fișiere, 657/657 teste. Ultimele lint, typecheck și build: trec. `git diff --check`: trece.
- Nicio problemă confirmată rămasă din revizie. Câmpurile grupate de preț au fost inspectate în browser la 360 px: nu depășesc fereastra, text 16 px; selectorul are acum două coloane.
- Codul este local, necomis/nepublicat. Nu s-au modificat serviciile, conturile, permisiunile sau datele de producție.
