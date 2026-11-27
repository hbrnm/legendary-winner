# Monitorizarea rapoartelor CSP

Aplicația trimite încălcările politicii CSP în mod `Report-Only` către funcția Edge Supabase `csp-report`. Politica este doar observativă și nu blochează resurse.

## Activare

1. Publică funcția `csp-report` din acest repository, cu `verify_jwt = false` conform `supabase/config.toml`. Endpointul trebuie să fie accesibil anonim pentru ca browserele să poată trimite rapoarte.
2. Publică aplicația Vercel cu antetele din `vercel.json`. Acestea declară `Reporting-Endpoints`, folosesc `report-to` și păstrează `report-uri` ca fallback pentru browserele care nu suportă Reporting API.
3. Confirmă recepția printr-o încălcare CSP controlată și verifică logurile funcției `csp-report` în Supabase Dashboard → Edge Functions → Logs.

Nu inversa ordinea: dacă antetul este activ înaintea funcției, rapoartele nu vor ajunge la colector.

## Date și limite

Colectorul acceptă formatele Reporting API și CSP legacy. Loghează doar directiva, dispoziția, URL-urile HTTP(S) fără credențiale, query sau fragment și pozițiile numerice. Nu loghează corpul brut, `sample`, refererul ori politica completă. Corpul este limitat la 16 KiB, fiecare cerere la 20 rapoarte, iar logarea este limitată la 30 de evenimente pe minut per instanță; rapoartele duplicate sunt reduse pentru a limita zgomotul. Aceste limite protejează colectorul, dar pot elimina rapoarte în perioade de vârf.

Logurile se găsesc în Supabase Dashboard → Edge Functions → `csp-report` → Logs. Retenția depinde de planul Supabase. Analizează rapoartele înainte de a modifica sau impune o politică CSP mai strictă; nu activa automat blocarea pe baza rapoartelor.
