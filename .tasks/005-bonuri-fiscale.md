# 005 — Prețuri din bonurile fiscale (OCR pe telefon)

**Stare:** în lucru: planul e gata; urmează etapa 1, într-o sesiune nouă.
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
| 1 | **Probă de calitate:** OCR pe 8–10 bonuri reale ale proprietarului (Lidl, Kaufland, Mega Image, Profi, Penny, piață, dacă există). Măsurăm câte linii (denumire + sumă) ies corect, pe telefon, și cât durează. Fără cod în `main`; raport în acest fișier. Dacă ies sub ~70% linii corecte, proprietarul decide din nou (chestionar). | de făcut | |
| 2 | **Citirea textului** (`src/lib/domain/receipt.ts`, logică pură): text OCR → magazin propus, data, linii {denumire, cantitate, preț unitar, total}, totalul bonului și verificarea sumei. Teste pe textele anonimizate de la etapa 1. | de făcut | |
| 3 | **Potrivirea care învață:** migrația `receipt_aliases` (gospodărie, magazin, text normalizat → produs), RLS pe `household_id`, sincronizare, backup; propunerea potrivirii (întâi învățat, apoi căutarea din catalog). `npm run test:db`. | de făcut | |
| 4 | **Ecranele:** „Adaugă bon” (fotografie/galerie, progres), „Verifică bonul” (fiecare linie: produs propus, sumă, „nu e produs”; magazin, dată, listă) și aplicarea: bifare + `actual_price` + linii noi pe lista aleasă, sau cumpărătură fără listă (`shopping_transactions` cu `list_id` null), prețuri `platit`. Textele noi: un singur chestionar. E2E cu text OCR simulat. | de făcut | |
| 5 | **Offline și performanță:** fișierele OCR servite din `out/`, cache la prima folosire; telefon fără internet după prima folosire; test pe Android și iPhone reale. | de făcut | |
| 6 | **Producția:** migrația cu acordul proprietarului, apoi integrarea; verificarea pe telefon. | de făcut | |

## De ce are nevoie de la proprietar
- **Pentru etapa 1:** 8–10 fotografii de bonuri reale, de la lanțuri diferite, puse într-un loc ales de el (nu în repo). Pot conține date personale (cardul de fidelitate, ultimele cifre ale cardului), care se șterg înainte de orice test comis.
- **Pentru etapa 4:** aprobarea textelor noi.
- **Pentru etapa 6:** acordul pentru migrația pe producție.

## Cum verific la final
Pe un telefon real: fotografiez un bon de la Lidl cu 10 produse, confirm liniile în sub 2 minute, iar „Compară magazinele” arată Lidl cu prețurile de pe bon. Al doilea bon de la același magazin propune singur potrivirile învățate. Bugetul crește o singură dată.

## Următorul pas
Proprietarul pregătește fotografiile bonurilor; etapa 1 se face într-o sesiune nouă.
