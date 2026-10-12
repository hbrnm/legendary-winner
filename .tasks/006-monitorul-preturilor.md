# 006 — Prețuri văzute din Monitorul Prețurilor

**Stare:** etapa 1 făcută pe o copie indirectă a datelor (raportul de mai jos); verificarea directă pe site așteaptă domeniul permis în rețeaua mediului (încă 403 pe 12 oct. 2026) și răspunsurile proprietarului la chestionarul din raport.
**Ramura:** câte una pe etapă, `claude/monitor-<etapa>`, fiecare cu PR-ul ei din `main`.

## Scop
Prețurile publicate în Monitorul Prețurilor (Consiliul Concurenței) intră în Cămara ca prețuri **văzute** la magazin, cu sursa și data. Ajung în „Compară magazinele” și în estimări, sub prețurile plătite de gospodărie.

Deciziile proprietarului (12 oct. 2026, în conversație și chestionar):
- **Acordul Consiliului Concurenței există** („Am acordul consiliului concurenței. Ia de acolo”). Condițiile acordului (atribuire, frecvență, redistribuire) sunt DE COMPLETAT, de la proprietar.
- **Prima etapă în aplicație:** prețuri văzute, folosite în calcule (nu doar consultare).

## În afara scopului
- Alte surse (cataloagele magazinelor, Open Prices); variantele comerciale (marcă, gramaj, EAN), din 0.2.0.
- Carburanți și încărcare electrică.
- Prețuri inventate sau completate: ce nu se potrivește sigur cu un produs din catalog nu intră.

## Restricții
- Preluarea rulează pe server, programat, nu din telefon: aplicația e export static și offline. Cheia de scriere (`service_role`) stă doar în setările Supabase.
- Datele sunt publice, deci catalog global: `household_id NULL`, citite de toți membrii, scrise doar de server sau `app_admins`.
- Cererile către site rămân rare (o dată pe zi) și respectă condițiile acordului.
- Atribuirea sursei se vede lângă preț („Monitorul Prețurilor”, cu data). Textele noi se aprobă într-un chestionar.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Probă pe date:** cum se obțin datele (API, export sau pagini), ce câmpuri au (magazin, localitate, produs, gramaj, preț, dată), câte produse din catalog se potrivesc. Raport în acest fișier, fără cod în `main`. Cere accesul la domeniu din mediul cloud. | făcut (indirect; de confirmat direct) | |
| 2 | **Citirea datelor** (`src/lib/domain/monitor.ts`, logică pură): rând din sursă → {lanț, produs propus, cantitate, unitate, preț, dată}. Teste pe un eșantion mic comis (cu acordul condițiilor). | de făcut | |
| 3 | **Baza de date:** migrația `public_prices` (globală, `price_type = 'observat'`, `source_name`, `source_ref`, `observed_on`) + legătura lanț din Monitor → `retailers` și produs din Monitor → produs din catalog; RLS: citire pentru toți autentificații, scriere doar `app_admins`/server. `npm run test:db`. | de făcut | |
| 4 | **Preluarea programată:** funcție pe server (Supabase Edge Function + cron), idempotentă pe `source_ref`, cu jurnal fără date personale. | de făcut | |
| 5 | **În aplicație:** sincronizarea prețurilor publice în Dexie; `estimateCost` și „Compară magazinele” le folosesc după cele plătite/văzute de gospodărie; eticheta sursei. Textele: un chestionar. E2E. | de făcut | |
| 6 | **Producția:** migrația și funcția cu acordul proprietarului; verificare pe telefon. | de făcut | |

## De ce are nevoie de la proprietar
- **Acum:** `monitorulpreturilor.info` adăugat la Allowed domains în setările rețelei mediului cloud; condițiile acordului cu Consiliul Concurenței (și cheia de acces, dacă există, pusă doar în setările Supabase).
- **Etapa 5:** aprobarea textelor. **Etapa 6:** acordul pentru producție.

## Cum verific la final
Pentru o listă reală, „Compară magazinele” arată un total la un lanț la care gospodăria nu are prețuri proprii, cu sursa „Monitorul Prețurilor” și data.

## Raportul etapei 1 (12 oct. 2026)

### Cum am lucrat
- Din mediul cloud, `monitorulpreturilor.info` dă tot **403** la proxy (domeniul nu e în Allowed domains); nici unealta de citire web nu rezolvă numele. N-am văzut site-ul direct.
- Am folosit o sursă indirectă, publică: proiectul [gov2-ro/monitorulpreturilor](https://github.com/gov2-ro/monitorulpreturilor) (interfață alternativă, ultimul commit 26 iul. 2026). Am citit codul lui (fără să-l rulez) și am interogat, doar în citire, baza SQLite comisă acolo (`data/prices_ci.db`: subsetul lor de CI, prețuri din 13–25 apr. 2026, 20 de municipii, 787 de magazine, 509 produse cu preț, 508 167 de rânduri de preț).
- Proiectul **n-are licență**: nu copiem nimic din el (cod sau date) în repo; e doar documentație. Toate cifrele de mai jos se reverifică pe site când domeniul e permis.

### Cum se obțin datele
- **Nu există export sau date deschise.** Există un serviciu web nedocumentat, folosit de site: `https://monitorulpreturilor.info/pmonsvc/Retail/…` (alimente) și `…/pmonsvc/Gas/…` (carburanți, în afara scopului). Răspunde în **XML** (WCF, namespace `pmonsvc.Models.Protos`), fără cheie, fără WSDL/Swagger, fără istoric de prețuri (doar prețul curent).
- Cereri utile (după gov2-ro):
  - `GetRetailNetworks` → lanțurile (10).
  - `GetProductCategoriesNetwork` / `GetProductCategoriesNetworkOUG` → categoriile (143, două arbori: „network” și „OUG” = produsele cu adaos plafonat).
  - `GetCatalogProductsByNameNetwork` (fără parametri) → toate produsele, ~87 000 de nume (16,5 MB).
  - `GetStoresForProductsByUat?uatId=…&csvprodids=…&OrderBy=price[&csvnetworkids=…]` și `GetStoresForProductsByLatLon` → magazinele cu prețurile pentru câteva produse, într-o localitate (UAT) sau în jurul unui punct.
- Prețurile se cer **pe magazin × grup de produse**: o trecere completă la gov2-ro înseamnă ~30 000 de cereri (~15 ore). Pentru Cămara, cu prețuri **pe lanț**, ajung puține cereri: o localitate (sau câteva), produsele potrivite, filtrat pe lanț. Compatibil cu „o dată pe zi”, de confirmat cu condițiile acordului.
- Site-ul a avut o problemă de certificat (lanț Sectigo incomplet, iun. 2026); funcția de pe server trebuie să o suporte.

### Ce câmpuri au
| Câmp dorit | În sursă | Observații |
|---|---|---|
| Lanț | `Retailnetwork/Id` (ex. `KAUFLAND`, `PROFI`, coduri GLN pentru Carrefour, Lidl, Mega Image, Cora) | În subset, 337 din 787 de magazine n-aveau lanțul pe magazin; se ia din `Networkid` pe produs. 8 din cele 10 lanțuri există deja în `retailers`; lipsesc Cora și Supeco. |
| Magazin, localitate | `RetailStore`: nume, adresă, cod poștal, coordonate, `Uatid` (UAT = localitate) | |
| Produs | `Catprod/Id` + nume liber (ex. „Barilla Paste Fusilli Nr98 500g”) și `Brand` | Fără EAN. Produse **comerciale**, cu marcă, nu generice. |
| Gramaj | **doar în nume** (ex. „500g”, „1l”, „/Kg”) | Câmpul `Unit` nu e gramajul și e haotic (`Kg`, `K`, `BUC`, `BUCATI`, `bucata`, `L`, `500g`…); „Muștar 300g” are `Unit = Kg` și prețul pe borcan. Cu tipare simple, gramajul se citește din aproximativ jumătate din nume (234–248 din 509). |
| Preț | `Price`, lei, prețul de raft al articolului | `0` = magazinul nu are produsul. |
| Dată | `Pricedate` (`DD.MM.YYYY HH:MM`) | |
| Promoție | `Promo`, text liber („Este in promotie”, „Promo”, „Promotie”…) | ~6% din rânduri. |

### Prețul diferă de la un magazin la altul
Pe 24 apr. 2026, procentul produselor cu același preț (±1%) în toate magazinele unui lanț: Cora 94%, Selgros 91%, Kaufland 88%, Auchan 54%, Mega Image 26%, Profi 11%, Carrefour 8%. Deci „prețul lanțului” trebuie ales (ex. mediana pe o localitate de referință a gospodăriei, sau pe țară) — decizie de produs, în chestionar.

### Câte produse din catalog se potrivesc
Am încercat potrivirea automată după nume și sinonime (cuvintele unui nume din catalog să apară toate în numele din Monitor; câștigă potrivirea cea mai lungă):

| | Produse Monitor | 1 candidat | mai mulți | niciunul | Produse din catalog atinse |
|---|---|---|---|---|---|
| Toate numele din subset | 6 932 | 3 999 | 1 007 | 1 926 | 207 din 471 |
| Cu preț în subset | 509 | 124 | 16 | 369 | 54 |

Verificate de mână, din cele 124 cu un singur candidat **doar 46 sunt corecte (37%)**, pe **25 de produse din catalog** (cafea boabe/instant/măcinată, muștar, mălai, ulei de floarea-soarelui, orez, paste fusilli/spaghete, sare, zahăr vanilat, drojdie uscată, ketchup, maioneză, pâine albă, pastă de tomate, brichete…). Greșelile tipice: „Rom Captain Morgan” → esență de rom, „Aperitiv Cherry” → roșii cherry, lichioruri → fructe, „Pui la cuptor /Kg” (mâncare gata) → pui întreg, „Ceai verde” → ceai negru. Nici categoria din Monitor nu ajută: brichetele sunt la „Băuturi alcoolice”.

**Concluzie:** potrivirea automată nu e sigură; după regula „ce nu se potrivește sigur nu intră”, legătura produs Monitor → produs din catalog trebuie să fie **o listă aprobată** (`Catprod/Id` → id catalog), propusă automat și confirmată de un admin. Probabil cel mai bun început: categoriile **OUG** (pâine, lapte, iaurt, smântână, unt, ouă, făină, mălai, ulei, zahăr, roșii, ceapă, cartofi, morcovi, usturoi, ardei, mere, pere, prune, struguri, pui întreg, pulpe, aripi, carne de porc), care se suprapun cu produsele generice din catalog. În subset aceste categorii **n-au produse** (gov2-ro le-a filtrat), deci numărul lor e DE COMPLETAT, pe site.

### Ce rămâne de verificat direct, când domeniul e permis
1. Că cererile de mai sus răspund la fel (și cu ce volum) pentru o localitate.
2. Produsele din categoriile OUG: câte, ce nume, ce gramaje.
3. Condițiile acordului: dacă acoperă folosirea serviciului `pmonsvc`, frecvența, atribuirea, redistribuirea către aplicație.

### Chestionar pentru proprietar (decizii pentru etapele 2–3)
1. **Legătura produselor:** (a) listă aprobată de admin, propusă automat **(Recomandat)**; (b) potrivire automată doar pentru categoriile OUG; (c) potrivire automată peste tot (37% corect în probă — nu).
2. **Prețul lanțului:** (a) mediana în localitatea gospodăriei, cu țara ca rezervă **(Recomandat)**; (b) mediana pe țară; (c) prețul cel mai mic găsit.
3. **Gramajul:** (a) intră doar rândurile cu gramajul citit sigur din nume sau vândute „/Kg” **(Recomandat)**; (b) și celelalte, cu prețul pe bucată.
4. **Promoțiile:** (a) intră, marcate „promoție” **(Recomandat)**; (b) se sar.
5. **Lanțuri noi (Supeco, Cora):** (a) le adăugăm în `retailers` **(Recomandat)**; (b) le ignorăm.

## Următorul pas
Proprietarul: permite `monitorulpreturilor.info` în rețeaua mediului, trimite condițiile acordului și răspunde la chestionarul de mai sus. Apoi, într-o sesiune nouă: verificarea directă (lista de mai sus, ~1 oră) și etapa 2.
