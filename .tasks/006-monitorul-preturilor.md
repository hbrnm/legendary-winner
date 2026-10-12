# 006 — Prețuri văzute din Monitorul Prețurilor

**Stare:** în așteptare (proprietarul): mediul cloud nu ajunge la `monitorulpreturilor.info` (proxy 403); etapa 1 cere domeniul permis în setările rețelei.
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
| 1 | **Probă pe date:** cum se obțin datele (API, export sau pagini), ce câmpuri au (magazin, localitate, produs, gramaj, preț, dată), câte produse din catalog se potrivesc. Raport în acest fișier, fără cod în `main`. Cere accesul la domeniu din mediul cloud. | de făcut | |
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

## Următorul pas
Etapa 1, într-o sesiune nouă, după ce domeniul e permis în rețeaua mediului.
