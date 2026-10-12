# 008 — Fotografii reale pentru rețete

**Stare:** în așteptare (proprietarul): mediul cloud nu ajunge la Wikimedia Commons; trebuie permise `commons.wikimedia.org` și `upload.wikimedia.org` în rețeaua mediului.
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
În locul pătrățelelor cu pictograme (scoase în PR #25), fiecare rețetă primește o fotografie reală a preparatului. Câmpul `recipes.image_url` există deja.

Deciziile proprietarului (12 oct. 2026, chestionar):
- **Sursa:** Wikimedia Commons, doar fotografii cu licență liberă (CC0, CC BY, CC BY-SA), cu autorul și licența afișate lângă fotografie.
- **Găzduirea:** copii micșorate în aplicație (WebP, ~60 KB), nu link către sursă: merg și fără internet după prima vizualizare, iar telefonul nu cere nimic de la alte site-uri.
- **Potrivirea:** „înainte să adaugi, verifică dacă poza se potrivește 100% cu rețeta”.

## În afara scopului
- Fotografii generate de AI, ilustrații, poze din alte surse.
- Fotografii pentru produsele din catalog.

## Restricții
- **Potrivirea:** fiecare fotografie o deschide orchestratorul și o compară cu rețeta (preparatul, ingredientele vizibile, servirea). Se păstrează doar unde preparatul se recunoaște clar; la orice îndoială (ciorbe asemănătoare, variante străine), rețeta rămâne fără fotografie. Nimic nu intră fără aprobarea proprietarului, pe o galerie.
- **Licența:** autorul, licența și adresa fișierului de pe Commons se păstrează pentru fiecare fotografie (în `src/data`) și se afișează în fișa rețetei. Textul atribuirii se aprobă în chestionar.
- **PWA:** fotografiile nu intră în cache-ul de la instalare; se păstrează la prima vizualizare.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Căutare și verificare:** pentru cele 86 de rețete, candidați de pe Commons (licență liberă), fiecare verificat vizual; galerie pentru proprietar (rețetă, fotografie, autor, licență) + chestionar pentru textul atribuirii. Fără cod în `main`. | de făcut | |
| 2 | **În aplicație:** fotografiile aprobate micșorate în `public/`, `image_url` și atribuirea în `src/data/recipes`, seed-ul SQL regenerat, atribuirea afișată în fișa rețetei, cache la prima vizualizare. Teste (unitar + E2E), capturi. | de făcut | |
| 3 | **Producția:** actualizarea catalogului pe Supabase, cu acordul proprietarului; verificare pe telefon. | de făcut | |

## De ce are nevoie de la proprietar
- **Acum:** `commons.wikimedia.org` și `upload.wikimedia.org` la Allowed domains, în setările rețelei mediului cloud.
- **Etapa 1:** aprobarea fotografiilor din galerie și a textului atribuirii. **Etapa 3:** acordul pentru producție.

## Cum verific la final
Pe telefon, în Rețete, rețetele cu fotografie aprobată o arată; în fișa rețetei apare atribuirea; fără internet, fotografiile deja văzute se încarcă.

## Următorul pas
Etapa 1, după ce domeniile sunt permise.
