# 005 — Prețuri din bonurile fiscale (OCR pe telefon)

**Stare:** în lucru: etapa 1 făcută (18 oct. 2026, 3 bonuri); decizia proprietarului: continuăm, cu încadrare și verificare. Urmează etapa 2.
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
| 2 | **Citirea textului** (`src/lib/domain/receipt.ts`, logică pură): text OCR → magazin propus, data, linii {denumire, cantitate, preț unitar, total}, totalul bonului și verificarea sumei. Teste pe textele anonimizate de la etapa 1. | de făcut | |
| 3 | **Potrivirea care învață:** migrația `receipt_aliases` (gospodărie, magazin, text normalizat → produs), RLS pe `household_id`, sincronizare, backup; propunerea potrivirii (întâi învățat, apoi căutarea din catalog). `npm run test:db`. | de făcut | |
| 4 | **Ecranele:** „Adaugă bon” (fotografie/galerie, progres), „Verifică bonul” (fiecare linie: produs propus, sumă, „nu e produs”; magazin, dată, listă) și aplicarea: bifare + `actual_price` + linii noi pe lista aleasă, sau cumpărătură fără listă (`shopping_transactions` cu `list_id` null), prețuri `platit`. Textele noi: un singur chestionar. E2E cu text OCR simulat. | de făcut | |
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

## De ce are nevoie de la proprietar
- **Pentru etapa 1:** 8–10 fotografii de bonuri reale, de la lanțuri diferite, puse într-un loc ales de el (nu în repo). Pot conține date personale (cardul de fidelitate, ultimele cifre ale cardului), care se șterg înainte de orice test comis.
- **Pentru etapa 4:** aprobarea textelor noi.
- **Pentru etapa 6:** acordul pentru migrația pe producție.

## Cum verific la final
Pe un telefon real: fotografiez un bon de la Lidl cu 10 produse, confirm liniile în sub 2 minute, iar „Compară magazinele” arată Lidl cu prețurile de pe bon. Al doilea bon de la același magazin propune singur potrivirile învățate. Bugetul crește o singură dată.

## Următorul pas
Etapa 2: `src/lib/domain/receipt.ts`, cu testele pe textele OCR anonimizate ale celor 3 bonuri (fără ID unic, card, casier).
