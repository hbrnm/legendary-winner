# 011 — Rețete din alte limbi, cu unități metrice

**Stare:** de făcut (după verificarea pe telefoane de la `.tasks/009`, etapa 5)
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
- **Unitățile:** `cup` → 240 ml, `fl oz` → 30 ml (29,57 rotunjit), `pint`/`quart`/`gallon` (SUA) → ml/l; `tbsp`/`tsp` rămân „lingură”/„linguriță” (aceeași măsură în bucătăria românească). „Cană” din textele românești rămâne „cană”. `stick of butter` → 113 g. Cantitățile se rotunjesc la valori de bucătărie (ex. 237 → 240 ml), fără să inventeze precizie.
- **Temperaturile din pași:** „350°F”, „350 F”, „350 degrees Fahrenheit” → „175°C” (rotunjit la 5), cu valoarea originală în paranteză doar dacă proprietarul alege așa la chestionar. Inch → cm în pași („9x13 inch pan” → „23×33 cm”).

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Unitățile și temperaturile:** cup/fl oz/pint/quart/gallon/stick → metric în `parseIngredient`; °F → °C și inch → cm în pași. Teste cu rânduri reale (fixturi). | de făcut | |
| 2 | **Dicționarul englez–român** pentru potrivirea cu catalogul (cele mai folosite ~150 de ingrediente), cu test: o rețetă americană tipică are majoritatea ingredientelor potrivite automat. Lista, în chestionar, spre aprobare. | de făcut | |
| 3 | **Textele noi** (dacă apar, ex. „Am transformat unitățile în metric.”) într-un singur chestionar; E2E în modul demonstrativ cu o rețetă în engleză lipită la „Text”. | de făcut | |

Totul e în client (`src/lib/domain/recipe-import.ts`, folosit și de funcția Edge prin `core.js`). La o schimbare în parsarea JSON-LD: `npm run build:functions` și funcția publicată din nou pe producție, cu acordul proprietarului.

## Cum verific la final
Pe telefon: import din link o rețetă de pe un site american (ex. o rețetă de banana bread) → ingredientele în grame/ml, majoritatea potrivite automat cu catalogul, temperatura în °C în pași → salvez.

## Următorul pas
Etapa 1, într-o sesiune nouă, după ce se termină verificarea pe telefoane a `.tasks/009`.
