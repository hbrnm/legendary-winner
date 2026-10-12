# 006 — Prețuri din Monitorul Prețurilor (uz personal)

**Stare:** în lucru: planul e gata; urmează etapa 1, într-o sesiune nouă, cu acces de rețea la `monitorulpreturilor.info`.
**Ramura:** câte una pe etapă, `claude/monitor-<etapa>`, fiecare cu PR-ul ei din `main`.

## Acordul
Consiliul Concurenței a răspuns proprietarului (12 oct. 2026): datele Monitorului Prețurilor se pot folosi **pentru uz personal**. Răspunsul scris îl păstrează proprietarul; în repo nu intră date personale.

Consecința tehnică: prețurile Monitorului ajung **doar în gospodăria proprietarului**. Nu ajung în catalogul comun și nu ajung la gospodăriile prietenilor sau ale rudelor care folosesc aplicația. Pentru alte gospodării sau pentru public e nevoie de un acord nou, explicit, pentru redistribuire.

## Deciziile proprietarului (12 oct. 2026, chestionar)
- **Pentru cine:** aplicația o folosesc proprietarul și câțiva prieteni sau rude. Funcția se activează doar pentru gospodăria proprietarului și o activează un administrator al aplicației (`app_admins`), nu membrii.
- **Unde intră prețurile:** în gospodărie, ca prețuri „văzute”, marcate cu sursa („Monitorul Prețurilor, 10 oct.”), doar pentru localitatea gospodăriei și pentru produsele legate. Intră în estimări și în „Compară magazinele”.
- **Potrivirea:** proprietarul alege o dată varianta din Monitor pentru un produs al Cămării („Lapte” → „Lapte Zuzu 1,5% 1 l”), iar aplicația o ține minte.
- **Frecvența:** zilnic, automat, noaptea.

## Ce știm despre sursă
Proiectul open-source `gov2-ro/monitorulpreturilor` folosește un serviciu XML public, fără autentificare, nedocumentat oficial:
- `…/pmonsvc/Retail/GetUATByName?uatname=`;
- `…/Retail/GetCatalogProductsByNameNetwork?prodname=`;
- `…/Retail/GetStoresForProductsByUat?uatId=&csvprodids=&OrderBy=price`;
- `GetRetailNetworks`.

Răspunsurile au namespace-ul `pmonsvc.Models.Protos`. Prețul are data raportată de magazin. Produsele au ID-uri interne, nu EAN. Câmpurile exacte se confirmă la etapa 1.

## În afara scopului
- Carburanții, catalogul comun, alte gospodării, scraping-ul altor site-uri.
- Variantele comerciale complete (0.2.0). Aici păstrăm doar legătura produs → produs din Monitor și gramajul lui, cât trebuie pentru prețul pe kg sau l.

## Restricții
- Datele circulă server → Monitor doar dintr-o funcție Supabase (Edge Function), cu `service_role` din setările Supabase, niciodată în repo, în CI sau în mediul cloud.
- Telefonul nu cheamă direct Monitorul: CORS nu e garantat, iar sursa rămâne izolată într-un singur loc.
- Prețurile nu se inventează: un produs fără răspuns rămâne fără preț. Data prețului e cea raportată de magazin, nu ziua preluării.
- Cererile sunt puține și rare: o rulare pe zi, doar pentru produsele legate (zeci, nu mii), cu pauze între cereri.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Probă:** într-o sesiune cu acces la `monitorulpreturilor.info`, câte un răspuns real pentru `GetUATByName`, `GetCatalogProductsByNameNetwork` și `GetStoresForProductsByUat`; câmpurile confirmate (preț, gramaj și unitate, rețea, magazin, data); răspunsurile anonimizate devin teste. Se confirmă și ce rețele corespund magazinelor noastre (`retailers`). | de făcut | |
| 2 | **Citirea răspunsurilor** (logică pură, `src/lib/domain/monitor.ts`): XML → produse, magazine, prețuri; prețul pe kg sau l din gramaj; alegerea prețului pe rețea în localitate (regula, întâi în chestionar). Teste pe răspunsurile de la etapa 1. | de făcut | |
| 3 | **Baza de date:** migrațiile `monitor_households` (gospodăria activată, localitatea; scrie doar `app_admins`) și `monitor_links` (produs → produs din Monitor, gramaj; scriu membrii gospodăriei activate); coloana `product_prices.external_source` (marcajul „Monitorul Prețurilor”); RLS pe `household_id`; sincronizare și backup. `npm run test:db`. | de făcut | |
| 4 | **Funcția Supabase `monitor`:** căutarea localității și a produselor (pentru ecrane), plus rularea zilnică (`pg_cron` + `pg_net`) care scrie prețurile doar pentru gospodăriile activate. Prețurile sunt idempotente: același produs, rețea și dată = același rând. Teste cu răspunsuri simulate. | de făcut | |
| 5 | **Ecranele:** „Gospodărie” → Monitorul Prețurilor (activat de administrator, localitatea); la produs → „Leagă de Monitor” (căutare, alegere); marcajul sursei în fișa produsului și în comparație. Textele noi: un singur chestionar. E2E cu funcția simulată. | de făcut | |
| 6 | **Producția:** migrațiile, funcția, programarea, doar cu acordul proprietarului; activarea pentru gospodăria lui; verificare după prima rulare. | de făcut | |

## De ce are nevoie de la proprietar
- Acces de rețea la `monitorulpreturilor.info` pentru sesiunea de lucru (setările mediului cloud, apoi o **sesiune nouă**).
- Regula de preț pe rețea în localitate, înainte de etapa 2: de exemplu cel mai ieftin magazin al rețelei sau prețul cel mai des întâlnit.
- Textele noi (etapa 5) și acordul pentru producție (etapa 6).

## Cum verific la final
Leg „Lapte” de varianta mea din Monitor. A doua zi, fișa produsului arată prețul de la Lidl și Kaufland din localitatea mea, cu „Monitorul Prețurilor” și data. „Compară magazinele” le folosește. O gospodărie de test a unui prieten nu vede niciunul dintre aceste prețuri (test RLS).

## Următorul pas
Proprietarul permite `monitorulpreturilor.info` în rețeaua mediului; etapa 1 se face într-o sesiune nouă.
