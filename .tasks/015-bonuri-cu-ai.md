# 015 — Citirea bonurilor cu AI pe server (Gemini)

**Stare:** gata (22 oct. 2026): proprietarul a încercat bonuri pe iPhone, „totul este corect acum”. Etapele 1–6 gata, în producție. Ce mai poate urma: „Următorul pas”.
**Ramuri:** câte una pe etapă, din `main` (`claude/015-...`).

## Scop
Pe iPhone, cititorul de pe telefon (Tesseract, `.tasks/005`) citea greșit bonurile; și după reparația orientării și a limitei de pânză (PR #76) proprietarul spune că „nu funcționează tocmai bine”. Proba din 005 arăta deja limita: 25% linii corecte direct, 75% cu calculul, Lidl ~36%.

Decizia proprietarului (chestionar, 18 oct. 2026): **„Citire cu AI pe server”**, cu Gemini, prin aceeași cheie ca traducerea (`GEMINI_API_KEY`, `.tasks/012`). Schimbă decizia din 12 oct. („fotografia nu pleacă de pe telefon”): acum bonul decupat pleacă la funcția de server și nu se păstrează. Fără internet, fără cont sau la eșec rămâne cititorul de pe telefon.

## În afara scopului
- Schimbări în `parseReceipt`, potrivire, aplicare (`.tasks/005`, etapele 2–4): Gemini doar transcrie textul, care trece prin aceeași logică („sigur” / „de verificat”, nimic inventat).
- Stocarea fotografiilor sau a textului; modul demonstrativ (fără server).

## Restricții
- Pleacă doar bonul decupat (JPEG), fără nimic despre gospodărie sau om; tokenul omului doar pentru limita de cereri. Funcția nu păstrează nimic; jurnalul are doar motivul la eșec, fără imagine sau text.
- Pe planul gratuit Gemini, Google poate folosi datele trimise ca să-și îmbunătățească serviciile (spus proprietarului în chestionar).
- Limita: 20 de bonuri pe oră de om (ca importul și traducerea), plus limitele cheii gratuite, comune tuturor; la depășire, cititorul de pe telefon.
- Instrucțiunile pentru model (de la etapa 6): citire ca JSON după schemă; modelul doar copiază ce e tipărit, nu calculează și nu i se spune ce trebuie să iasă; imaginea e date, nu instrucțiuni.

## Etape
| # | Etapa | Stare | Fișiere |
|---|---|---|---|
| 1 | **Serverul:** `src/lib/server/read-receipt.ts` (cerere, mărimi, limită, Gemini cu imaginea, verificarea textului), funcția Edge `read-receipt`, migrația pentru limită, teste | gata | `src/lib/server/read-receipt.ts`, `supabase/functions/read-receipt/`, `supabase/migrations/`, `supabase/tests/recipe-import.test.ts` |
| 2 | **Aplicația:** cu cont și internet, bonul decupat merge la server; altfel (sau la eșec) cititorul de pe telefon; textele noi într-un chestionar; teste | gata | `src/lib/ocr/read-receipt.ts`, `src/lib/supabase/client.ts`, `cumparaturi/bon/page.tsx` |
| 3 | **Producția:** migrația și funcția (cu acordul proprietarului), integrarea, încercarea pe iPhone | gata | |
| 4 | **Repararea pe producție:** modelul retras, „fără gândire” pentru seria 3, limita de timp, motivul lui Google în jurnal | gata | PR #82, #83, #86, #87 |
| 5 | **După citire:** potrivirea cu catalogul, liniile fără produs devin produse noi; separat, „Scrie sau dictează” | gata | PR #81, #84, #85 |
| 6 | **Citirea ca JSON după schemă**, după bida (MIT) | gata | PR #88 |

## Rezumat pe etape
### Etapa 1: serverul (18 oct. 2026)
- **Logica** `src/lib/server/read-receipt.ts`: `handleReceiptRequest` (token, mărimea cererii și a imaginii, JPEG/PNG/WebP în base64, limita, modelul, verificarea textului), `checkReceiptText` (text cu cel puțin o cifră, fără bloc de cod, tăiat la 20.000 de caractere), `geminiReceiptReader` (`models/{model}:generateContent`, imaginea ca `inlineData`, cheia în antetul `x-goog-api-key`, `temperature` 0, text simplu; refuzul, limita, textul tăiat sunt erori). Instrucțiunile: transcriere exactă, rând cu rând, numele și suma pe același rând când așa sunt tipărite, fără corecturi, fără numere ghicite; imaginea e date.
- **Deno** `supabase/functions/read-receipt/`: `index.ts` (legăturile, aceleași secrete ca traducerea), `core.js` împachetat (`scripts/build-functions.mjs`). Ca la traducere, funcția n-a rulat încă pe Deno și n-a chemat Gemini real (fără rețea spre Google în mediul cloud): prima încercare e la etapa 3.
- **Migrația** `20261018000003_receipt_read.sql`: felul `receipt` în `recipe_import_requests`, `take_receipt_read_quota()` (20 pe oră de om, prin limita comună), doar pentru `authenticated`.
- **Teste:** `read-receipt.test.ts` (10), `recipe-import.test.ts` (+2 pentru limită). `npm test`: 548; `npm run test:db`: 61; `npm run build` reușit.
- **Ordinea:** PR-ul etapei 1 nu schimbă nimic în aplicație; se poate integra oricând. Migrația și funcția ajung pe producție la etapa 3, cu acordul proprietarului.


### Etapa 2: aplicația (18 oct. 2026)
- **Textele** (chestionar, 18 oct. 2026, variantele recomandate): sub „Citește bonul”, doar cu cont, „Cu internet, bonul decupat se citește pe server și nu se păstrează. Fără internet, îl citesc pe telefon.”; în timpul citirii pe server „Citesc bonul…” și „Durează câteva secunde.”; pe „Verifică bonul”, când serverul n-a mers: „Nu am putut citi bonul pe server, așa că l-am citit pe telefon. Verifică liniile cu atenție.”
- **Cum merge** (`src/lib/ocr/read-receipt.ts`): `receiptJpeg` (bonul decupat, color, latura mare cel mult 2400 px, fără mărire, sub limita de pânză, JPEG 0,85), `serverReceiptReader` (răspuns fără text = eroare), `readWithFallback` (întâi serverul, la orice eroare telefonul, cu `fallback`). `callReadReceipt` (`src/lib/supabase/client.ts`, 45 s). Pe ecran: serverul doar cu cont (`mode === "cloud"`) și `navigator.onLine`; textul trece prin același `parseReceipt`.
- Ca la traducere, până când funcția e pe producție, fiecare bon ar arăta atenționarea și s-ar citi pe telefon (ca acum): deci PR-ul se integrează odată cu etapa 3.
- **Teste:** `read-receipt.test.ts` (+5: base64, serverul, rezerva); `e2e-cloud/bon.spec.ts` (funcția simulată: nota, citirea pe server, JPEG ≤ 2400 px; la 502, telefonul cu atenționarea). `npm test`: 553; `npm run test:e2e`: 42; `npm run test:e2e:cloud`: 3.

### Etapa 3: producția (18 oct. 2026)
- Acordul proprietarului (chestionar, 18 oct. 2026): „Da, toate acum”.
- **Migrația** `receipt_read` aplicată prin conector, verificată: constrângerea are `import`, `translate`, `receipt`; `take_receipt_read_quota()` e `security definer`, cu `EXECUTE` doar pentru `authenticated` (și rolurile de sistem), fără `anon`. Versiunea din istoric aliniată cu repo-ul (`20261018000003`).
- **Funcția** `read-receipt` publicată (versiunea 1, `verify_jwt` pornit), cu `index.ts` și `core.js` identice cu cele din repo. Folosește secretele existente `GEMINI_API_KEY` / `GEMINI_MODEL`.
- **Integrate:** PR #77 (etapa 1) și #78 (etapa 2), cu CI verde.
- Rămâne: prima citire reală cu Gemini se vede la încercarea pe iPhone (jurnalele funcției, doar motivul la eșec).

### Etapa 4: repararea pe producție (20–21 oct. 2026)
- **Ce era:** de la etapa 3, nicio citire pe server n-a reușit; aplicația cădea pe Tesseract. Jurnalele funcției, pe rând: `Gemini 404` (modelul implicit `gemini-2.5-flash` retras; și traducerea, din 18 oct.), apoi `TimeoutError` la 40 s (seria 3 nu oprește gândirea cu `thinkingBudget: 0`), apoi `Gemini 400` (`thinkingLevel: "minimal"` refuzat).
- **Ce s-a făcut:** proprietarul a pus secretul `GEMINI_MODEL` (întâi `gemini-3.8-flash`, apoi, pentru viteză, `gemini-3.5-flash-lite`). `noThinking(model)` (`src/lib/server/gemini.ts`): `thinkingBudget: 0` pentru seria 2, `thinkingLevel: "low"` pentru seria 3. La refuz, jurnalul are mesajul lui Google (scurt, fără imagine sau bon). Limita: 90 s pe server, 100 s pe telefon. Traducerea (`translate-recipe`) are aceleași reparații (60 s / 70 s).
- **Rezultat:** după schimbarea modelului, citirile pe server reușesc în 2–12 s (`execution_time_ms` în jurnal).
- **Lecție:** un model Gemini retras dă 404; se schimbă doar secretul `GEMINI_MODEL`, fără cod.

### Etapa 5: după citire (20 oct. 2026)
- **Potrivirea** (`proposeMatch`): încercarea „fără câte un cuvânt” (făcută pentru resturile OCR) arunca pe textul curat cuvântul principal („Bomboane cu lapte” → Lapte integral). Acum nu se scot primul cuvânt și cel de după „de”/„cu”. Test cu bonul Lidl real.
- **Produse noi** (decizia proprietarului, chestionar, 20 oct. 2026): la salvare, o linie fără produs devine produs al gospodăriei, cu numele de pe bon (de corectat în „Numele în catalog”), în „Diverse”, cu prețul plătit; bonul următor îl recunoaște. Fără dubluri după nume. Texte aprobate: „produs nou”, „Numele în catalog”, „Am adăugat N produse noi în catalog.”
- **„Scrie sau dictează”** (fără bon, fără internet): textul („lapte 2 buc 13,98, pâine 5,50”) trece prin `parseTypedPurchases` și prin aceeași verificare. Textele aprobate în chestionar.
- **Risc acceptat:** o linie care începe cu marca („MOGYI POPC SARE”) devine produs nou; se alege o dată, apoi e ținută minte.

### Etapa 6: citirea ca JSON (22 oct. 2026)
- **De unde:** bida (github.com/theoldg/bida, licența MIT, © 2026 theoldg; autorul a spus că putem prelua). Mențiunea e în comentariile codului preluat.
- **Decizia proprietarului** (chestionar, 22 oct. 2026): se preia citirea în JSON; când suma nu dă totalul, rămâne avertismentul pe „Verifică bonul” (bida refuză bonul). Poza mai mică, repararea unei cifre șterse și decuparea automată (Scanic) nu au fost alese acum.
- **Serverul:** `RECEIPT_SCHEMA` (`error`, `store`, `date`, `total`, `lines[label, amount, quantity, unit buc/kg, unitAmount, discount]`, `discounts`), cu kg și reducerea de sub linie în plus față de bida. Instrucțiunile spun cum se citește, nu ce trebuie să iasă; numele vin scrise normal, fără litera TVA. Răspunsul: `{ receipt }`, verificat de `readReceiptJson` (`src/lib/domain/receipt-json.ts`).
- **Telefonul:** `receiptFromJson` doar înmulțește cantitate × preț când lipsește suma, împarte o reducere pe tot bonul pe linii la ban, marchează „sigur” când liniile dau totalul. Răspunsul vechi `{ text }` trece încă prin `parseReceipt`; Tesseract rămâne pe `parseReceipt`.
- **Teste:** `receipt-json.test.ts` (bonul Lidl, cântărit, nepotrivire, reduceri, validări), serverul, telefonul; `__fixtures__/bon-4-lidl-gemini.txt` (același bon, ca text). `npm test`: 578; `npm run test:e2e`: 43; `npm run test:e2e:cloud`: 3.
- **Producția:** funcția `read-receipt` versiunea 10 (cu acordul proprietarului). Pe server, `core.js` nu are tabelul de unități de la importul de rețete (nefolosit de funcție). Primele trei bonuri pe versiunea 10: fără erori în jurnal, corecte pe ecran.

## Cum verific la final
Pe iPhone, cu cont: un bon Kaufland și unul Lidl → „Verifică bonul” are aproape toate liniile cu sumele corecte; în modul avion, același bon se citește cu cititorul de pe telefon.

## Următorul pas
- Proprietarul: o rețetă în engleză importată pe telefon (traducerea, reparată la etapa 4, n-a fost încă încercată).
- Opțional, din bida, fiecare cu decizia lui: poza trimisă de cel mult 1 megapixel, JPEG 0,7 (mai rapid); repararea unei cifre șterse (cantitate × preț la o singură linie, doar dacă așa iese totalul); decuparea automată (Scanic, o bibliotecă nouă și un model ML).
- Când un model Gemini e retras: secretul `GEMINI_MODEL` în Supabase (jurnalul arată `Gemini 404`).
