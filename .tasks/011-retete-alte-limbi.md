# 011 — Rețete din alte limbi, cu unități metrice

**Stare:** în așteptare (proprietarul: încercarea pe telefon, 18 oct. 2026). Etapele 1–3 gata.
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
Gospodăria importă și rețete în engleză (link sau text), iar Cămara le aduce cât mai aproape de română și de unitățile metrice, fără ca omul să aleagă de mână fiecare ingredient.

Decizia proprietarului (17 oct. 2026, chestionar): **întâi fără AI**, în aplicație, gratuit și offline. Numele și pașii rămân în limba originală (se pot corecta de mână pe ecranul de confirmare). Traducerea cu AI, eventual, într-o lucrare separată, după alegerea furnizorului.

## Ce face deja importul (`.tasks/009`)
- Citește ingredientele în engleză (cantitate, unitate, nume, notă); `lb`/`oz` → grame.
- `cup`/`tbsp`/`tsp` → „cană”/„lingură”/„linguriță” (fără ml; cana americană are 240 ml).
- `fl oz` rămâne doar în notă; °F din pași rămâne neschimbat.
- Numele în engleză nu se potrivesc cu catalogul (în română), deci ajung toate la „De ales”.

## În afara scopului
- Traducerea numelui, a descrierii și a pașilor (cere AI).
- Alte limbi decât engleza (eventual după, cu același mecanism).
- Schimbarea catalogului sau a sinonimelor de pe server: dicționarul e doar pentru import, deci căutarea obișnuită și baza de producție nu se schimbă (fără `CATALOG_VERSION`, fără `seed.sql`).

## Model
- **Dicționarul englez–român** (`src/data/import-en.ts`): cuvinte și expresii („all-purpose flour” → „făină”, „ground beef” → „carne tocată de vită”, „scallions” → „ceapă verde”), folosite doar înainte de căutarea în catalog. Rândul original rămâne afișat („din rețetă: …”). E conținut scris de agenți: lista se aprobă de proprietar înainte de producție.
- **Unitățile:** `cup` → 240 ml, `fl oz` → 30 ml (convenția din bucătărie: 8 fl oz = o cană), `pint`/`quart`/`gallon` (SUA) → 473/946/3785 ml, fără abrevieri („pt” e și „pentru”); `lb`/`oz` → g (din `.tasks/009`); `tbsp`/`tsp` rămân „lingură”/„linguriță”. „Cană” din textele românești rămâne „cană”. Un „stick” de unt (cuvântul „butter” întreg, nu „butternut”) → 113 g; alte „sticks” rămân în notă.
- **Temperaturile și lungimile din pași și descriere** (`metricText`): „350°F”, „350 F”, „350 degrees Fahrenheit” → „175°C” (rotunjit la 5); dacă pasul are deja și °C („350°F (175°C)”, „180°C/350°F”), rămâne doar °C. „F” fără semnul de grad doar între 200 și 600 (temperaturi de cuptor) și niciodată urmat de literă („250 făină” rămâne așa). Intervalele se transformă la ambele capete („350-375°F” → „175–190°C”, „1-2 inches” → „2,5–5 cm”). „9x13 inch” → „23×33 cm”, „1/2-inch” → „1,5 cm” (la jumătate de cm sub 3 cm, apoi la cm întreg). Rândul original al ingredientului rămâne afișat („din rețetă: …”).

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Unitățile și temperaturile:** cup/fl oz/pint/quart/gallon/stick → metric în `parseIngredientLine`; °F → °C și inch → cm în pași. Teste cu rânduri reale. | gata | (vezi PR) |
| 2 | **Dicționarul englez–român** pentru potrivirea cu catalogul, cu test: o rețetă americană tipică are majoritatea ingredientelor potrivite automat. Lista, în chestionar, spre aprobare. | gata | (vezi PR) |
| 3 | **Textele noi** (dacă apar, ex. „Am transformat unitățile în metric.”) într-un singur chestionar; E2E în modul demonstrativ cu o rețetă în engleză lipită la „Text”. | gata | (vezi PR) |

Totul e în client (`src/lib/domain/recipe-import.ts`, folosit și de funcția Edge prin `core.js`). La o schimbare în parsarea JSON-LD: `npm run build:functions` și funcția publicată din nou pe producție, cu acordul proprietarului.

## Rezumat pe etape
### Etapa 1 (17 oct. 2026)
- `parseIngredientLine` (`src/lib/domain/recipe-import.ts`): unitățile americane de volum în ml, „fl oz” ca unitate (nu mai e doar notă), „stick” de unt în grame. `metricText` nouă, aplicată în `prepareImport` (`src/lib/services/recipe-import.ts`) pe pași și descriere, deci merge la link și la text, și offline.
- `core.js` regenerat: se schimbă doar tabelele de unități, pe care funcția Edge nu le folosește (ingredientele se citesc în telefon). Funcția de pe producție se comportă la fel; nu trebuie publicată din nou.
- `verificare` a găsit 6 probleme, toate reparate cu teste care pică pe prima variantă (11): `\b` din JavaScript nu știe de diacritice („250 făină” devenea „120°Căină”; acum flag-ul `u` și „fără literă după”), intervalele, „pt”/„qt”/„gal”, „butternut”, „fl oz” fără nume, „350°F, or 175°C”.
- Fără texte noi. Teste: 29 noi în `recipe-import.test.ts` (unități, „sticks” de țelină, temperaturi, inch, pași românești neschimbați) și unul în `services/recipe-import.test.ts` (rețetă americană → metric).

### Etapa 2 (17 oct. 2026)
- **Dicționarul** `src/data/import-en.ts`: 440 de expresii englezești, 374 legate de un produs din catalog și 66 oprite (`null`), ca un cuvânt din ele să nu ia alt produs („peanut butter” nu e unt, „coconut milk” nu e lapte, „sesame oil” nu e susan). Folosit doar la import; catalogul, sinonimele și baza de producție nu se schimbă.
- **Potrivirea** (`phraseDictionary`, `matchIngredients` în `src/lib/domain/recipe-import.ts`): expresia cea mai lungă câștigă; la aceeași lungime, cea din dreapta (în engleză substantivul e la urmă: „dill pickle” e murătură). La singular, fără diacritice, cratime și apostrofuri („confectioners' sugar”, „jalapeño”). Un produs găsit doar în notă („boneless, skinless chicken breasts”) e doar variantă, nebifat, pentru că nota poate fi și „seasoned with salt”. Serviciul bifează doar produse care există în catalogul gospodăriei și sunt alimente.
- `verificare` a găsit nota care bifa produse greșite („steak, seasoned with salt” → Sare; blocant) și ~20 de expresii-capcană; toate reparate, cu teste pe dicționarul real (18 potriviri, 26 de capcane). `core.js` nu se schimbă.
- **Aprobat de proprietar** (chestionar, 17 oct. 2026): tot dicționarul, cum e, inclusiv alegerile discutabile („chicken” → Pui întreg, „pepper” → Piper negru măcinat, „corn” → Porumb la conservă, fasolea → la conservă, „yeast” → Drojdie uscată, „thyme”/„basil” → proaspăt, „water” → Apă plată, „heavy cream” → Smântână dulce).

### Etapa 3 (17 oct. 2026)
- **Fără text nou** (decizia proprietarului, chestionar, 17 oct. 2026): la ingrediente se vede deja rândul original („din rețetă: 1/3 cup unsalted butter, melted”), iar pașii apar direct în °C și cm.
- **E2E** `e2e/import-retete.spec.ts`, „import din text în engleză”: o rețetă de banana bread lipită la „Text” → Unt 80 ml, Făină albă 000 360 ml, Zahăr 180 ml, Banane 3, potrivite automat; „peanut butter” rămâne de ales; „350°F (175°C)” → „175°C”, „9x5 inch” → „23×13 cm”; se salvează. `npx playwright test e2e/import-retete.spec.ts`: 4 trec.

## Cum verific la final
Pe telefon: import din link o rețetă de pe un site american (ex. o rețetă de banana bread) → ingredientele în grame/ml, majoritatea potrivite automat cu catalogul, temperatura în °C în pași → salvez.

## Următorul pas
Proprietarul, pe telefon: importul unei rețete de pe un site american (link) și al uneia în engleză lipite la „Text”. Eventual, într-o lucrare nouă: traducerea numelui și a pașilor cu AI.
