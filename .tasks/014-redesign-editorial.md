# 014 — Redesign editorial (hârtie, verde de pădure, terracotta, serif)

**Stare:** în lucru (18 oct. 2026). Etapele 1–4 gata (vezi PR-urile).
**Ramuri:** câte una pe etapă, din `main` (`claude/014-...`).

## Scop
Cererea proprietarului din 18 oct. 2026 („Cămară — Editorial redesign”): o interfață editorială, caldă și tactilă, în locul aspectului generic de aplicație SaaS. Doar prezentare: fără schimbări de schemă, date, sincronizare sau calcule. Se adaugă la planurile existente (001–013).

## Decizii (chestionar, 18 oct. 2026)
- Fonturi: Fraunces (titluri, nume de rețete), DM Sans (interfață), JetBrains Mono (sume, date, cantități); locale, prin `next/font/local`, licență OFL (`src/app/fonts/`).
- Terracotta: `#A8553C` pentru text (contrast ≥ 4,5 pe hârtie și pe foi); `#C86D51` doar pentru bare, fundaluri și text mare, când ajungem la ele.
- „(parțial)”: costul pe porție doar peste 80% acoperire; altfel „preț pentru X din Y ingrediente” (textul exact se aprobă în etapa 5).
- Etapa 3 (chestionar, 18 oct. 2026): la Cheltuieli recente, magazinul pe rândul principal (mai multe: „Kaufland, Lidl”; fără magazin, sursa; altfel numele listei); rețetele fără poză au inițiala în serif pe kraft (inversează pictograma categoriei din 16 oct.); bugetul și următoarea listă într-un singur bloc-registru; „Expiră curând” ca etichete de borcan.
- Etapa 4 (chestionar, 18 oct. 2026): la Adăugare rapidă, două grupuri cu titlu („S-a terminat în cămară”, „Cumperi des”), fără sufix pe butoane (subtitlul „Din cămară și din ce cumperi des” dispare); barele peste buget rămân pe tokenul `accent` (#A8553C), fără token nou pentru #C86D51; caseta „Înainte de cumpărături” de pe Buget duce la Cumpărături.
- Etapa 6 (chestionar, 18 oct. 2026): în Istoric, pe rândul principal magazinul, ca la Cheltuieli recente (fără magazin, sursa; altfel numele listei), iar lista dedesubt, lângă dată, când există și nu e deja titlul; „cel mai bun”, „promoție”, „preț vechi” și „N fără preț” devin ștampile în mono, fără pastilă.
- Tokenii își păstrează numele (`bg-bg`, `text-ink`, `bg-brand`...); se schimbă doar valorile.

## În afara scopului
- Migrații, date noi, schimbări în `src/lib/domain`, `src/lib/db`, `src/lib/sync`.
- Textura de hârtie (imagine în plus); se reia doar dacă proprietarul o cere.

## Etape
| # | Etapa | Stare | Fișiere |
|---|---|---|---|
| 1 | Tokeni și tipografie | gata | `globals.css`, `layout.tsx`, `manifest.ts`, `fonts.ts`, `fonts/`, `contrast.test.ts`, `e2e/fonts.spec.ts` |
| 2 | Antet, bara de jos, primitive (fără blur, filete, colțuri mici, banda demonstrativă discretă) | gata | `shell.tsx`, `ui/misc.tsx`, `ui/button.tsx`, `ui/fields.tsx`, `ui/sheet.tsx`, `ui/toast.tsx`, `tokens.test.ts` |
| 3 | Acasă (registru, rețete în serif, expiră curând, cheltuieli recente cu magazinul) | gata | `home-screen.tsx`, `recipe-visual.tsx`, `recipe-photo.tsx`, `product-search.tsx` |
| 4 | Buget și liste (sume în mono, „des” grupat) | gata | `buget/page.tsx`, `charts.tsx`, `cumparaturi/page.tsx`, `cumparaturi/lista/page.tsx` |
| 5 | Rețete, plan, cămară („(parțial)”) | de făcut | `retete/page.tsx`, `retete/reteta/page.tsx`, `plan/page.tsx`, `camara/page.tsx` |
| 6 | Istoric și prețuri în stil registru | gata | `cumparaturi/istoric/page.tsx`, `buget/preturi/page.tsx` |
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

### Etapa 3 (18 oct. 2026)
- Acasă: data în mono (majuscule), salutul în serif; căutarea „îngropată” (kraft, colțuri mici); registrul buget + listă pe aceeași foaie (suma în mono, rândul listei cu nume în serif); Azi la masă fără carduri, între filete, cu nume în serif și porțiile în mono; Expiră curând ca etichete cu chenar punctat terracotta și termenul ca ștampilă; Rețete sugerate pe o singură foaie cu filete; Cheltuieli recente ca registru (magazin, dată, sumă în mono, filete punctate).
- `RecipeAvatar`: inițiala în serif (ș → Ș) în locul pictogramei categoriei (se aplică și în plan și în lista de rețete); pictogramele categoriilor au fost scoase.
- Teste: `recipe-visual.test.tsx` (inițiala), `e2e/demo-model.spec.ts` (magazinele la cheltuieli, eticheta de expirare, inițiala; pică pe codul vechi cu „Cumpărături” în loc de „Kaufland”).

### Etapa 4 (18 oct. 2026)
- Buget: numele bugetului în serif, cheltuitul și „din …” în mono (cheltuitul terracotta peste buget); „Înainte de cumpărături” e o legăre spre liste; luna în serif; „Cheltuit în lună” și „Media unei ieșiri” pe aceeași foaie, separate de filet, sumele în mono; în „Unde s-au dus banii”, sumele în mono; tooltip-ul graficului în mono.
- Cumpărături: numele listelor în serif; „Adaugă un bon fiscal” și „Istoricul cumpărăturilor” pe aceeași foaie.
- Lista: prețurile în mono, totalul de jos în mono, colțuri mici; Adăugare rapidă pe grupuri.
- e2e: grupurile de la adăugarea rapidă (inclusiv „S-a terminat în cămară”, după ce untul ajunge la zero în cămară) și legătura spre liste de pe Buget; ambele pică pe codul vechi.

### Etapa 6 (18 oct. 2026)
- Istoric: luna în serif cu totalul în mono; cumpărăturile pe o foaie cu filete punctate; magazinul pe rândul principal, data cu majusculă, „N produse” cu acord; suma în mono, „N fără preț” ca ștampilă; în fereastră, cantitățile, sumele și totalul în mono.
- Prețuri: numele produsului în serif; datele și sumele în mono; ștampilele „cel mai bun” (verde), „promoție” (terracotta), „preț vechi” (gri); colțuri mici.
- e2e: istoricul din gospodăria model are Kaufland, Piață, Lidl pe rândul principal și în titlul ferestrei (pică pe codul vechi, cu numele listei).

## Cum verific la final
`npm test`, `npm run build`, `npm run test:e2e`; capturile la 360 px din `e2e/demo-model.spec.ts`.

## Următorul pas
Etapa 5: rețete, plan, cămară (inclusiv „(parțial)”).
