# 010 — Design cald la 360 px și gospodăria model din modul demonstrativ

**Stare:** în așteptare (proprietarul: aprobarea textelor noi și integrarea PR-ului)
**Ramura:** claude/010-design-cald-demo

## Scop
Cererea proprietarului din 16 oct. 2026 („Finalizarea autonomă, design cald”), fără întrebări: ecranele Buget, Rețete, Cumpărături și Cămară arată bine la 360 px în ambele moduri de culoare, culorile vin doar din tokenii din `globals.css`, iar modul demonstrativ pornește cu o gospodărie model plină. Se adaugă la planurile existente (001–009), nu le înlocuiește.

## În afara scopului
- Schimbări de schemă, migrații, funcții Edge (nu au fost necesare).
- Date inventate în gospodăriile reale: graficele goale arată o schiță estompată cu explicație, nu un istoric simulat. Istoricul cu prețuri există doar în baza locală a modului demonstrativ (`camara-demo`, fără outbox), marcat în cod ca DATE DE EXEMPLU.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | Tokeni: toast, sheet (fundalul ferestrei), căutarea de produse, graficul, comutatorul; test care păzește tokenii (`src/app/tokens.test.ts`) | gata | vezi PR |
| 2 | Buget: butoane de 44 px pe grilă (prețuri sus, exporturile pe 2 coloane), bară dublă cheltuit (brand) + coș (warn), grafice care nu apar goale | gata | vezi PR |
| 3 | Rețete: avatar uniform 64 px cu pictograma categoriei pentru rețetele fără poză (și în plan/acasă, 48 px), titluri pe 2 rânduri, filtrele pe mai multe rânduri | gata | vezi PR |
| 4 | Cumpărături: numele listei pe 2 rânduri, „X din Y luate · ~total”, bară de progres, „Adăugare rapidă” (terminate în cămară, cumpărate des) | gata | vezi PR |
| 5 | Cămară: 4 filtre pe un rând (Toate, Frigider, Congelator, Cămară), celelalte locuri doar dacă au produse; rândurile care expiră evidențiate (warn/accent) | gata | vezi PR |
| 6 | Modul demonstrativ: 14 produse în cămară (iaurtul expiră în 2 zile), lista recurentă cu 10 produse (3 luate), buget 2.500 RON, 26 de săptămâni de istoric la Kaufland, Lidl și Piață, 3 mese în planul săptămânii | gata | vezi PR |

## Rezumat pe etape
### Etapele 1–6 (16 oct. 2026)
Verificat local: `npm test` 30 fișiere, 308 teste trec; `npm run lint`, `npm run typecheck` curate; `npm run build:functions` fără schimbări; `npm run build` (export static + `sw.js`); `npm run test:e2e` 27/27, inclusiv `e2e/demo-model.spec.ts` (gospodăria model; la 360 px în modul luminos și întunecat: nimic nu iese din ecran, butoanele Buget ≥ 44 px, filtrele Cămării netăiate, avatarul de 64 px). `npm run test:db` nu s-a rulat: nicio schimbare de schemă.

Testele e2e existente pornesc cu `camara-demo-gol` (în `e2e/helpers.ts`), deci rămân pe gospodăria goală.

## Deschis pentru proprietar
- Textele noi (de aprobat): „Graficul se umple după primele cumpărături.”, „Cheltuit …”, „În coș, estimat …”, „Adăugare rapidă”, „Din cămară și din ce cumperi des”, „s-a terminat”, „des”, „Exportă luna” (fost „Exportă luna (CSV)”).
- Avatarul rețetelor fără poză inversează decizia din 12 oct. 2026 („fără pătrățele cu pictograme”), la cererea din 16 oct.; pe pagina rețetei rămâne fără imagine.
- Prețurile din gospodăria model sunt de exemplu (doar în modul demonstrativ), o excepție de la „nu se inventează prețuri”.

## Cum verific la final
`npm test` și `npm run test:e2e` (în special `e2e/demo-model.spec.ts`).

## Următorul pas
Proprietarul aprobă textele și integrează PR-ul.
