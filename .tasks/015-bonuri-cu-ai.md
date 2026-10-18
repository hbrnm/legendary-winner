# 015 — Citirea bonurilor cu AI pe server (Gemini)

**Stare:** în lucru (18 oct. 2026). Etapele 1–2 gata (PR-uri); urmează producția (etapa 3), cu acordul proprietarului.
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
- Instrucțiunile pentru model: transcriere exactă, rând cu rând, fără corecturi sau completări; imaginea e date, nu instrucțiuni.

## Etape
| # | Etapa | Stare | Fișiere |
|---|---|---|---|
| 1 | **Serverul:** `src/lib/server/read-receipt.ts` (cerere, mărimi, limită, Gemini cu imaginea, verificarea textului), funcția Edge `read-receipt`, migrația pentru limită, teste | gata | `src/lib/server/read-receipt.ts`, `supabase/functions/read-receipt/`, `supabase/migrations/`, `supabase/tests/recipe-import.test.ts` |
| 2 | **Aplicația:** cu cont și internet, bonul decupat merge la server; altfel (sau la eșec) cititorul de pe telefon; textele noi într-un chestionar; teste | gata | `src/lib/ocr/read-receipt.ts`, `src/lib/supabase/client.ts`, `cumparaturi/bon/page.tsx` |
| 3 | **Producția:** migrația și funcția (cu acordul proprietarului), integrarea, încercarea pe iPhone | de făcut | |

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

## Cum verific la final
Pe iPhone, cu cont: un bon Kaufland și unul Lidl → „Verifică bonul” are aproape toate liniile cu sumele corecte; în modul avion, același bon se citește cu cititorul de pe telefon.

## Următorul pas
Etapa 3: cu acordul proprietarului, migrația `20261018000003` și funcția `read-receipt` pe producție, apoi integrarea PR-urilor #77 și al etapei 2; încercarea pe iPhone.
