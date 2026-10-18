# 005 — Prețuri din bonurile fiscale (OCR pe telefon)

**Stare:** în așteptare (proprietarul: verificarea pe Android și iPhone, 18 oct. 2026). Etapele 1–4 și producția (migrația, integrarea) sunt gata.
**Ramura:** câte una pe etapă, `claude/bonuri-<etapa>`, fiecare cu PR-ul ei din `main`.

## Scop
Fotografiezi bonul, aplicația citește liniile, tu le confirmi, iar prețurile reale (magazin, dată, sumă) intră în Cămara. Așa, „Compară magazinele” și estimările au date fără introducere manuală.

Deciziile proprietarului (12 oct. 2026, chestionar):
- **Citirea pe telefon** (OCR local, Tesseract.js). Fotografia nu pleacă de pe telefon; merge și fără internet după prima folosire.
- **Rezultatul e cumpărătură + prețuri.** Cu o listă deschisă aleasă, produsele potrivite se bifează cu prețul de pe bon, iar cele în plus se adaugă. Apoi „Termină cumpărăturile”, ca acum, deci nimic nu se numără de două ori. Fără listă, bonul devine o cumpărătură în istoric. Prețurile intră în istoric, cu magazinul și data.
- **Potrivirea învață din confirmări.** Prima dată confirmi tu („LAPTE ZUZU 1.5% 1L” → Lapte). Aplicația ține minte pentru gospodărie și magazin, iar data viitoare propune singură.
- **Fotografia nu se păstrează.** Rămân doar liniile confirmate.

## În afara scopului
- OCR pe server sau AI; scraping; prețuri de la alte gospodării.
- Variantele comerciale (marcă, gramaj, EAN): bonul se leagă de produsul generic. Textul de pe bon rămâne în potrivire, pentru 0.2.0.
- Stocarea fotografiilor.

## Restricții
- Nu se inventează: liniile necitite rămân de completat de om; nimic nu se salvează fără confirmare.
- Dependență nouă: `tesseract.js` (Apache-2.0, 7.0.0). Motiv: singura bibliotecă OCR matură care rulează în browser, cu limba română. Fișierele (worker, core WASM, `ron.traineddata`) se servesc din aplicație, nu de pe CDN, ca să meargă offline și fotografia să nu atingă alte servere.
- PWA: fișierele OCR (câțiva MB) **nu** intră în cache-ul de la instalare; se descarcă și se păstrează la prima folosire.
- Fotografia, textul brut și bonurile reale nu ajung în loguri sau în repo. Testele folosesc doar text de bon anonimizat, din bonurile proprietarului.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Probă de calitate:** OCR pe 8–10 bonuri reale ale proprietarului (Lidl, Kaufland, Mega Image, Profi, Penny, piață, dacă există). Măsurăm câte linii (denumire + sumă) ies corect, pe telefon, și cât durează. Fără cod în `main`; raport în acest fișier. Dacă ies sub ~70% linii corecte, proprietarul decide din nou (chestionar). | gata (3 bonuri; raportul mai jos) | |
| 2 | **Citirea textului** (`src/lib/domain/receipt.ts`, logică pură): text OCR → magazin propus, data, linii {denumire, cantitate, preț unitar, total}, totalul bonului și verificarea sumei. Teste pe textele anonimizate de la etapa 1. | gata | (vezi PR) |
| 3 | **Potrivirea care învață:** migrația `receipt_aliases` (gospodărie, magazin, text normalizat → produs), RLS pe `household_id`, sincronizare, backup; propunerea potrivirii (întâi învățat, apoi căutarea din catalog). `npm run test:db`. | gata (PR #62); migrația pe producție, verificată (18 oct. 2026) | |
| 4 | **Ecranele:** „Adaugă bon” (fotografie/galerie, progres), „Verifică bonul” (fiecare linie: produs propus, sumă, „nu e produs”; magazin, dată, listă) și aplicarea: bifare + `actual_price` + linii noi pe lista aleasă, sau cumpărătură fără listă (`shopping_transactions` cu `list_id` null), prețuri `platit`. Textele noi: un singur chestionar. E2E cu text OCR simulat. | gata | (vezi PR) |
| 5 | **Offline și performanță:** fișierele OCR servite din `out/`, cache la prima folosire; telefon fără internet după prima folosire; test pe Android și iPhone reale. | de făcut | |
| 6 | **Producția:** migrația cu acordul proprietarului, apoi integrarea; verificarea pe telefon. | de făcut | |

## Rezumat pe etape
### Etapa 1: proba de calitate (18 oct. 2026)
- **Bonurile:** 3, fotografiate de proprietar cu telefonul: Lidl (11 produse, hârtie gri-albăstruie, ștearsă), Kaufland (18 produse), East Trading House, standul din Kaufland (3 produse la kg). Pozele și textele brute nu sunt în repo (stau doar în sesiune).
- **Motorul:** tesseract.js 7.0.0, limba `ron` (`4.0.0_best_int`), ca în plan. Rulat pe server (Node), nu pe telefon.
- **Pregătirea imaginii** contează decisiv: pe poza întreagă (fundal, umbre, bonul o fâșie îngustă) încrederea e sub 45% și aproape nimic nu se poate folosi. Cu decuparea la bon (pe telefon: încadrarea făcută de om), gri, contrast și mărire la 1800 px lățime: 69% încredere la Kaufland și East Trading, 38% la Lidl. Pragul alb-negru fix (150) a stricat rezultatul; nu se folosește.
- **Rezultate** (o linie e corectă dacă numele se recunoaște și suma e exactă):

| Bon | Produse | Direct, de pe rândul produsului | Cu calculul cantitate × preț unitar | Totalul bonului |
|---|---|---|---|---|
| Kaufland | 18 | 5 (28%) | 17 (94%) | corect (110,67) |
| East Trading | 3 | 3 (100%) | 3 (100%) | „Total” greșit, „Numerar” corect (29,23) |
| Lidl | 11 | 0 | ~4 (36%) | ilizibil |
| **Total** | **32** | **8 (25%)** | **24 (75%)** | |

- **Ce am învățat pentru etapa 2:** rândul „1,000 BUC x 3,49” (sau „1,986 KG x 9,99”) iese corect mult mai des decât suma din dreapta, unde litera TVA se lipește de cifre („3,49C”, „1,898”, „35C”). Deci suma liniei = cantitate × preț unitar, iar suma din dreapta servește doar la verificare. Greșeli tipice: G citit 6 sau 8 („500G” → „5006”), 9 citit 3 sau 8, % citit 4. Reducerile („DISCOUNT”, „Reducere Lidl Plus”) ies doar pe jumătate (3 din 6 la Kaufland). Lidl pe hârtie ștearsă rămâne slab și cu pregătire: acolo omul completează.
- **Durata:** 1,5–5 s pe bon pe server; pe telefon probabil de 2–4 ori mai mult. Nemăsurat pe telefon (etapa 5).
- **Limite:** 3 bonuri în loc de 8–10, de la 2 lanțuri; fără Mega Image, Profi, Penny, piață.
- **Decizia proprietarului** (chestionar, 18 oct. 2026): „Continuăm, cu încadrare și verificare”. Pe ecran omul încadrează bonul, iar liniile nesigure (suma din dreapta nu se potrivește cu cantitate × preț, nume necitit) apar „de verificat”. Omul confirmă fiecare linie, ca în plan.

### Etapa 2: citirea textului (18 oct. 2026)
- `parseReceipt` (`src/lib/domain/receipt.ts`, logică pură): magazinul (din primul rând, cu id-ul din catalog: lidl, kaufland, mega-image, profi, penny, carrefour, auchan, selgros, metro, la-doi-pasi, annabella, diana; altfel numele firmei), data, liniile {denumire, cantitate, unitate buc/kg, preț unitar, sumă, suma tipărită, reducere, „sigur”/„de verificat”}, totalul și verificarea lui.
- **Regulile, din probă:** suma = cantitate × preț de pe rândul „1,000 BUC x 3,49”; suma din dreapta doar confirmă. La formatul „totul pe un rând” („0.185 KG X 69.00= 12.77 B”) se ia suma de după „=”. Reducerile („DISCOUNT”, „REDUCERE”) scad din linia de deasupra; rândurile de promoție fără sumă („3 la preț de 2”, „Reducere Lidl Plus”) se sar. Dacă o singură linie e greșită și cealaltă sumă a ei închide exact totalul, se ia aceea.
- **Nimic inventat:** cantitate necitită → fără sumă (nu presupunem 1 bucată); nume necitit → gol; reducere necitită → linia și totalul neconfirmate; „255” fără virgulă pe un rând de reducere = 2,55, dar linia rămâne de verificat. „Sigur” doar când două cifre independente se potrivesc (cantitate × preț și suma tipărită) sau când totalul bonului confirmă toate liniile; o sumă aleasă ca să închidă totalul rămâne de verificat. „1,500 BUC” nu se rotunjește. „TOTAL”/„SUBTOTAL” contează doar la începutul rândului („Iaurt Total 0%” e produs); data se ia întâi de după „DATA” și se verifică (31/02 nu trece).
- **Pe bonurile reale:** Kaufland: 18 linii, 16 sume exacte, 4 „sigure”; East Trading: 3 sume exacte, 1 „sigură”; Lidl: magazinul recunoscut, toate liniile „de verificat”. Fixture-urile `src/lib/domain/__fixtures__/bon-*.txt` sunt textele OCR anonimizate: fără ID unic, card, casier, serie, coduri de bare, număr de comandă și ora cumpărăturii. Rămân data și firma (cu codul fiscal, public).
- **Teste:** `receipt.test.ts` (13). `npm test`: 511.
- `verificare`: nimic blocant; reparate toate cele 5 observații (sigur fără confirmare, „Total” în nume, corecția din total marcată sigur, data, bucăți fracționare), plus numărul comenzii și ora scoase din fixture-uri.

### Etapa 3: potrivirea care învață (18 oct. 2026)
- **Migrația** `20261018000002_receipt_aliases.sql`: `receipt_aliases` (gospodărie, magazin sau null, textul liniei normalizat, produs), un singur produs pe gospodărie + magazin + text, RLS `is_member`, fără `DELETE`, în Realtime; `check_household_refs` pe produs și magazin. Pe server ajunge doar textul liniei confirmate, normalizat; fotografia și textul brut al bonului nu. `supabase/tests/receipt-aliases.test.ts` (4); `npm run test:db`: 59.
- **Local:** Dexie versiunea 4; tabelul în `SYNCED_TABLES` și `OPTIONAL_TABLES` (până la migrație, tragerea îl sare); copia de siguranță îl ia, cu id determinist și în altă gospodărie.
- **Potrivirea** (`src/lib/domain/receipt-match.ts`, `src/lib/services/receipts.ts`): `receiptKey` (fără diacritice, majuscule, semne); `proposeMatch`: întâi ce a învățat gospodăria (același magazin, apoi oricare), apoi căutarea în catalog, încercând și fără câte un cuvânt (abrevieri și resturi OCR: „KLC”, „410G”). `learnReceiptAlias`: id determinist, deci același text învățat pe două telefoane e un singur rând; o confirmare nouă schimbă produsul.
- **Teste:** `receipts.test.ts` (4: catalog pe textele reale, învățat, refuzuri, copia de siguranță). `npm test`: 515; `npm run test:e2e:cloud`: 2.

### Etapa 4: ecranele (18 oct. 2026)
- **Textele** aprobate de proprietar (chestionar, 18 oct. 2026, „Aprob toate”). Decizia: prima dată aplicația propune produsul din catalog, marcat „de verificat”; apoi propune ce ai confirmat.
- **Intrări:** „Adaugă un bon fiscal” pe Cumpărături și „Adaugă bon” în meniul listei (cu lista aleasă).
- **`/cumparaturi/bon/`:** fotografia (cameră sau galerie) → încadrarea (propusă automat de `detectReceipt`, corectată trăgând două colțuri; poza încape în 70% din ecran, colțurile de 44 px fără derulare orizontală) → citirea pe telefon (progres; „Pregătesc cititorul…” prima dată) → „Verifică bonul” (magazinul și data citite, „Unde pun produsele”, pe fiecare linie produsul propus, suma plătită după reducere, „de verificat”, „Nu e un produs”; suma produselor față de totalul de pe bon) → „Salvează bonul”.
- **Aplicarea** (`applyReceipt`): cu listă, produsele nebifate se bifează cu prețul și cantitatea de pe bon, iar celelalte se adaugă bifate; „Gata” le înregistrează ca de obicei, o singură dată. Fără listă: cumpărătură în istoric (`list_id` null), cu prețuri `platit` la data bonului. Potrivirile confirmate se învață.
- **OCR în browser** (`src/lib/ocr/read-receipt.ts`): tesseract.js 7.0.0 (Apache-2.0) cu `ron` (MIT), din fișierele copiate la build în `public/ocr/7.0.0/` (`scripts/copy-ocr.mjs`, 13 MB, nu sunt în repo). Pregătirea: decupare, gri, contrast întins 1–99%, accentuare 3×3, 1800 px lățime. Fotografia rămâne doar în memorie.
- **Offline (începutul etapei 5):** service worker-ul nu le pune în cache la instalare, ci la prima citire, în cache-ul `ocr-fisiere`, păstrat între versiuni (calea are versiunea).
- **Încercarea reală în Chromium** (fără text simulat, pe fotografiile proprietarului): Kaufland cu încadrarea trasă: 17 linii, 12 din 18 sume plătite exacte, ~10–13 s; East Trading cu încadrarea propusă: 3 linii, 2 exacte (prima „de verificat”), ~4 s; Lidl pe hârtie ștearsă: slab (5 linii, 2 exacte). Încadrarea propusă a nimerit la Lidl și East Trading; la Kaufland (masă de lemn deschisă) a ales lemnul, deci acolo omul trage colțurile.
- **Parserul, întărit după încercarea reală:** suma stricată după „=” nu mai pierde rândul (rămâne cantitate × preț, de verificat); rândurile de plată și dată („N NUMERAR LEI”, „DATA … ORA”) opresc produsele; „REDULERE” e reducere; „100 BUC” fără virgulă rămâne necitit.
- `verificare`: o problemă aproape blocantă reparată cu test: un produs bifat deja în magazin primea un rând nou, iar „Gata” îl număra de două ori; acum primește doar prețul de pe bon. Reparate și: imaginea eliberată după citire, gestul anulat la încadrare, o dată din viitor nu se preia, `npm run dev` copiază fișierele OCR.
- **Migrația `receipt_aliases`** rulată de proprietar în SQL Editor (18 oct. 2026), verificată prin conector: RLS cu „citire”/„adăugare”/„modificare”, fără `anon` și fără `DELETE`, triggerele, indexul unic, Realtime, istoricul ca în repo.
- **Teste:** `receipt-crop.test.ts` (5), `read-receipt.test.ts` (1), `receipts.test.ts` (4 noi pentru aplicare), `receipt.test.ts` (+2), `e2e/bonuri.spec.ts` (text OCR simulat: bonul pe listă, al doilea bon propune ce a învățat, fără listă în istoric). `npm test`: 528; `npm run test:e2e`: 33.

## De ce are nevoie de la proprietar
- **Pentru etapa 1:** 8–10 fotografii de bonuri reale, de la lanțuri diferite, puse într-un loc ales de el (nu în repo). Pot conține date personale (cardul de fidelitate, ultimele cifre ale cardului), care se șterg înainte de orice test comis.
- **Pentru etapa 4:** aprobarea textelor noi.
- **Pentru etapa 6:** acordul pentru migrația pe producție.

## Cum verific la final
Pe un telefon real: fotografiez un bon de la Lidl cu 10 produse, confirm liniile în sub 2 minute, iar „Compară magazinele” arată Lidl cu prețurile de pe bon. Al doilea bon de la același magazin propune singur potrivirile învățate. Bugetul crește o singură dată.

## Următorul pas
Proprietarul, pe telefon (Android și iPhone), după integrare: un bon de la Lidl cu 10 produse, confirmat în sub 2 minute, a doua oară fără internet.
