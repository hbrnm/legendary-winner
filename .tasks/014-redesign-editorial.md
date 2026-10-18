# 014 — Redesign editorial (hârtie, verde de pădure, terracotta, serif)

**Stare:** în lucru (18 oct. 2026). Etapele 1–2 gata (vezi PR-urile).
**Ramuri:** câte una pe etapă, din `main` (`claude/014-...`).

## Scop
Cererea proprietarului din 18 oct. 2026 („Cămară — Editorial redesign”): o interfață editorială, caldă și tactilă, în locul aspectului generic de aplicație SaaS. Doar prezentare: fără schimbări de schemă, date, sincronizare sau calcule. Se adaugă la planurile existente (001–013).

## Decizii (chestionar, 18 oct. 2026)
- Fonturi: Fraunces (titluri, nume de rețete), DM Sans (interfață), JetBrains Mono (sume, date, cantități); locale, prin `next/font/local`, licență OFL (`src/app/fonts/`).
- Terracotta: `#A8553C` pentru text (contrast ≥ 4,5 pe hârtie și pe foi); `#C86D51` doar pentru bare, fundaluri și text mare, când ajungem la ele.
- „(parțial)”: costul pe porție doar peste 80% acoperire; altfel „preț pentru X din Y ingrediente” (textul exact se aprobă în etapa 5).
- Tokenii își păstrează numele (`bg-bg`, `text-ink`, `bg-brand`...); se schimbă doar valorile.

## În afara scopului
- Migrații, date noi, schimbări în `src/lib/domain`, `src/lib/db`, `src/lib/sync`.
- Textura de hârtie (imagine în plus); se reia doar dacă proprietarul o cere.

## Etape
| # | Etapa | Stare | Fișiere |
|---|---|---|---|
| 1 | Tokeni și tipografie | gata | `globals.css`, `layout.tsx`, `manifest.ts`, `fonts.ts`, `fonts/`, `contrast.test.ts`, `e2e/fonts.spec.ts` |
| 2 | Antet, bara de jos, primitive (fără blur, filete, colțuri mici, banda demonstrativă discretă) | gata | `shell.tsx`, `ui/misc.tsx`, `ui/button.tsx`, `ui/fields.tsx`, `ui/sheet.tsx`, `ui/toast.tsx`, `tokens.test.ts` |
| 3 | Acasă (registru, rețete în serif, expiră curând, cheltuieli recente cu magazinul) | de făcut | `home-screen.tsx`, `recipe-visual.tsx` |
| 4 | Buget și liste (sume în mono, „des” grupat) | de făcut | `buget/page.tsx`, `charts.tsx`, `cumparaturi/page.tsx`, `cumparaturi/lista/page.tsx` |
| 5 | Rețete, plan, cămară („(parțial)”) | de făcut | `retete/page.tsx`, `retete/reteta/page.tsx`, `plan/page.tsx`, `camara/page.tsx` |
| 6 | Istoric și prețuri în stil registru | de făcut | `cumparaturi/istoric/page.tsx`, `buget/preturi/page.tsx` |
| 7 | Verificare finală (capturi 360 px și desktop, ambele moduri) | de făcut | `e2e/` |

## Rezumat pe etape
### Etapa 1 (18 oct. 2026)
- Paleta nouă pe tokenii existenți: hârtie `#F6F4EE`, foi `#FBFAF6`, kraft `#EFECE4`, cerneală `#1C241E`, filete `#E2DEC9`, verde `#1E3F2B`, terracotta `#A8553C`; modul întunecat negru-măsliniu (`#16170F`). Umbra `shadow-card` mai discretă.
- Fonturile se încarcă local (aprox. 180 KB în total, subseturi latin + latin-ext, care se descarcă doar la nevoie); interfața în DM Sans, titlurile `h1` în Fraunces; `font-serif` și `font-mono` sunt gata pentru etapele următoare.
- Teste noi: `src/app/contrast.test.ts` (contrastul perechilor de tokeni în ambele moduri; pe paleta veche picau 5 perechi), `e2e/fonts.spec.ts` (fonturile, inclusiv subsetul pentru ă, ș, ț, se încarcă).

### Etapa 2 (18 oct. 2026)
- Antetul și bara de jos: fundal plin, filet de 1 px, fără blur; numele gospodăriei în serif; fila activă cu o linie verde de 2 px sus (fără pastilă); pictogramele au grosime 1,75 (2 la fila activă). Pe desktop, bara laterală marchează pagina cu o linie verde în stânga.
- Banda „Mod demonstrativ”: același text, fără fundal albastru, cu filet punctat dedesubt și „Mod demonstrativ” ca ștampilă (majuscule, cerneală).
- Primitivele: `Card` fără umbră, cu colțuri de 8 px; `SectionTitle` cu filet până la acțiune; `PageHeader` și titlurile ferestrelor în serif; butoane, câmpuri, ferestre și notificări cu colțuri mici; fundalul ferestrelor fără blur.
- `tokens.test.ts` interzice `backdrop-blur` (prindea 5 locuri).
- Colțurile mari scrise direct în ecrane (`rounded-2xl` pe Acasă, căutarea de produse) rămân pentru etapele 3–6.

## Cum verific la final
`npm test`, `npm run build`, `npm run test:e2e`; capturile la 360 px din `e2e/demo-model.spec.ts`.

## Următorul pas
Etapa 3: Acasă.
