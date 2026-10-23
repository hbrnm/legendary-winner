# 019 — Ghidul „Cum folosești Cămara”

**Stare:** în lucru — planul (23 oct. 2026)
**Ramuri:** câte una pe etapă, din `main` (`claude/019-...`).

## Scop
Proprietarul vrea un ghid complet de folosire (23 oct. 2026). Decizii (chestionar, 23 oct. 2026):
- în aplicație: pagina `/ghid/` („Cum folosești Cămara”), deschisă din Gospodărie și setări; merge fără internet (intră în `sw.js` ca orice pagină) și se actualizează odată cu aplicația;
- pe secțiuni, scurt: 2–5 pași pe acțiune, capturi decupate, în ambele moduri.

## Reguli
- Ghidul descrie doar ce face aplicația azi; fiecare pas e verificat pe ecran (demo la 360 px), nu din memorie.
- Textele noi le aprobă proprietarul într-un chestionar, pe secțiuni; tonul din 017 (cald, „tu”, fără termeni tehnici).
- Fără prețuri, promoții sau valori nutriționale inventate în exemple.
- Un test e2e: pagina se deschide din Gospodărie, are secțiunile, iar fiecare legătură „Du-mă acolo” duce la un ecran care există.

## Secțiunile
1. Primii pași: contul, gospodăria, invitarea membrilor (roluri), modul demonstrativ, instalarea pe telefon (Android / iPhone), fără internet.
2. Cumpărături: lista, adăugarea („2 kg roșii”), raioane / magazine, bifa și „În coș”, prețul plătit sau de la raft, variantele, „Gata”, lista care se reia, „Pune deoparte”, „Anulează”.
3. Bonul: fotografia și colțurile, „Scrie sau dictează”, verificarea liniilor, „Alege produsul” și „ca produs nou”, unde ajung produsele.
4. Rețete și planul meselor: rețetele, importul din link sau text (și traducerea), fotografiile, costul pe porție, planul săptămânii, lista din plan, „am gătit”.
5. Buget și prețuri: bugetul lunar sau săptămânal, ce intră în cheltuieli, istoricul, prețurile pe magazine, compararea.
6. Cămara: adăugarea, termenul de expirare, „ce pot găti”, scăderea la gătit.
7. Întrebări frecvente: sincronizarea între membri, mesajul „versiune nouă”, copia de siguranță, ce date pleacă din telefon (legătură spre pagina de confidențialitate din 018, când există).

## Etape
| # | Etapa | Stare |
|---|---|---|
| 1 | Textele secțiunilor 1–3, verificate pe ecran; chestionar | de făcut |
| 2 | Textele secțiunilor 4–7; chestionar | de făcut |
| 3 | Pagina `/ghid/`, legătura din Gospodărie, capturile, testul e2e | de făcut |

## Următorul pas
Etapa 1, într-o sesiune nouă: textele secțiunilor 1–3.
