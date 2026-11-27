# Detalii tehnice

Verdictele confirmate se bazează pe cod, configurație din repo sau avize aplicabile versiunilor instalate. Testele existente de bază de date au fost rulate separat, fără a folosi date din producție.

## SEC-001 · Restrânge modificarea membrilor la coloana role

**High** · CWE-863 · `confirmed`

**Cod** · `supabase/migrations/20261011000001_schema.sql:111, 549–564, 708–712, 774–777`

Rolul authenticated primește UPDATE pe tabel. RLS verifică dreptul asupra rândului existent și valoarea nouă a rolului. Cheile de identitate ale rândului rămân editabile; household_members are trigger de timestamp, fără trigger de imutabilitate.

Revocă UPDATE la nivel de tabel pentru rolurile client și acordă UPDATE exclusiv pe role. Păstrează RLS și fluxul privilegiat separat pentru transferul proprietății.

## SEC-002 · Leagă validarea destinației importului de conexiunea efectivă

**High** · CWE-918 · `needs_validation`

**Cod** · `src/lib/server/import-recipe.ts:146–174, 231–268, 320–338; supabase/functions/import-recipe/index.ts:15–22`

URL-ul primit ajunge la un fetch HTTP după verificarea DNS separată. Codul nu garantează că adresa folosită de conexiune este cea validată. Impactul depinde de runtime și de restricțiile de rețea din mediul găzduit.

Folosește un proxy de ieșire care validează destinația la conectare și blochează intervalele private și speciale. Păstrează validarea fiecărui redirect și limitele de răspuns.

## SEC-003 · Actualizează lanțul de dependențe de test și lint

**Medium** · CWE-1395 · `confirmed`

**Cod** · `package-lock.json:8644, 8969, 9209; .github/workflows/ci.yml:29–40`

npm audit a găsit 11 intrări afectate în arborele complet, inclusiv tinypool prin Vitest și undici prin jsdom. Scanarea cu omiterea dependențelor de dezvoltare a raportat zero intrări. Expunerea specifică a CI la avize rămâne de validat.

Actualizează Vitest, jsdom și lanțul typescript-eslint la versiuni compatibile fără avize relevante, regenerează lockfile-ul și repetă auditul și CI.

## SEC-004 · Tratează erorile de parsare ale serverului static local

**Low** · CWE-248 · `confirmed`

**Cod** · `scripts/serve-static.mjs:11–15, 27–40; vercel.json:3–6`

Parsarea URL și decodarea au loc înaintea blocului try. O eroare respinge handlerul asincron al serverului HTTP. Serverul ascultă fără host explicit și face parte din fluxul local de test.

Prinde erorile de intrare și răspunde 400, verifică încadrarea căii în directorul de export și folosește loopback implicit.

## SEC-005 · Verifică integritatea binarelor descărcate pentru testele cloud

**Medium** · CWE-494 · `confirmed`

**Cod** · `scripts/local-supabase.mjs:23–30, 128; playwright.cloud.config.ts:15; .github/workflows/ci.yml:38–40`

Harness-ul descarcă arhive binare cu versiune fixă, le extrage și rulează executabilele fără verificarea unui hash sau a unei semnături din repo.

Descarcă arhivele în fișier temporar, verifică un SHA-256 fixat înainte de extracție și oprește scriptul la orice nepotrivire.

## SEC-006 · Verifică anteturile de protecție ale aplicației publicate

**Low** · CWE-693 · `needs_validation`

**Cod** · `vercel.json:7–13; src/app/layout.tsx:35`

Configurația din repo definește doar antetul de cache pentru service worker. Setările efective de hosting sau de proxy ar putea adăuga protecții.

Verifică anteturile efective. Adaugă Content-Security-Policy în mod report-only, frame-ancestors, X-Content-Type-Options și Referrer-Policy potrivite aplicației offline.

## SEC-007 · Aplică o limită comună pentru căutarea nutrițională

**Low** · CWE-770 · `confirmed`

**Cod** · `supabase/functions/lookup-nutrition/index.ts:9–22; src/lib/server/lookup-nutrition.ts:55–94`

Identitatea e verificată prin serviciul Auth. Limita este memorată într-un Map local instanței, deci nu există o cotă comună garantată pentru toate instanțele. Volumul real depinde și de gateway.

Folosește limitare distribuită per utilizator, cu expirare și plafon global, înaintea interogării furnizorului extern.

## SEC-008 · Execuție SQL arbitrară în RPC-ul de finalizare

**Informational** · CWE-89 · `rejected`

**Cod** · `supabase/migrations/20261124081428_atomic_shopping_checkout.sql:8, 31–44, 57–78, 111–131`

RPC-ul folosește drepturile apelantului, tabele admise explicit, citarea identificatorilor și legarea valorilor ca parametri. Migrarea păstrează RLS.

Menține lista de permisiuni și parametrii legați.

## SEC-009 · Citire publică a bucketului de fotografii

**Informational** · CWE-862 · `rejected`

**Cod** · `supabase/migrations/20261015000001_recipe_photos.sql:50–76`

Migrarea setează bucketul privat și limitează citirea la membrii gospodăriei din cale. Starea efectivă a bucketului găzduit nu a fost inspectată.

Păstrează setarea privată și testele RLS pentru Storage.

## SEC-010 · Șterge fișierele prin API-ul Storage la închiderea contului

**Medium** · CWE-459 · `confirmed`

**Cod** · `supabase/migrations/20261116000003_delete_account_alias.sql:14–28`

RPC-ul șterge rândurile storage.objects direct prin SQL. Supabase documentează că această operație lasă obiectele binare în stocare, cu risc de retenție după ștergerea contului.

Autorizează operația server-side și elimină fișierele prin API-ul Storage într-un flux reluabil. Marchează ștergerea completă după confirmarea operațiilor Storage și DB.

## Exemplu de migrare pentru SEC-001

Înainte, grantul de tabel permite UPDATE pe toate coloanele. După migrare, clientul păstrează permisiunea pentru rol, iar verificarea RLS rămâne activă. Verifică drepturile moștenite și execută testele de transfer al proprietății înainte de promovare.

```diff
+ revoke update on table public.household_members from public, anon, authenticated;
+ grant update (role) on table public.household_members to authenticated;
```

Politica SELECT limitează vizibilitatea rândurilor, iar cheia primară și cheile externe verifică integritatea referințelor. Aceste controale nu fac coloanele de identitate imutabile. Verificarea separată a migrațiilor a găsit un trigger de imutabilitate pentru alte tabele, în timp ce `household_members` are triggerul de timestamp. [Semantica politicilor PostgreSQL](https://www.postgresql.org/docs/current/sql-createpolicy.html)

## Dovezi și limite suplimentare

- Importul are autentificare prin cota RPC, validează schema URL, verifică destinația fiecărei redirecționări și limitează mărimea și durata. Aceste controale reduc expunerea și justifică verdictul `needs_validation` pentru impactul rețelei găzduite. [Autentificarea Edge Functions](https://supabase.com/docs/guides/functions/auth)
- Arborele instalat include Vitest 3.2.7, tinypool 1.1.1, jsdom 29.1.1 și undici 7.30.0. Cele două intrări critice din sumarul npm includ propagarea către Vitest. Severitatea în acest raport reflectă utilizarea în test și CI. [Aviz tinypool](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) · [Aviz undici](https://github.com/advisories/GHSA-xjj6-f33q-929c)
- Testele Storage folosesc un shim Postgres. Ele verifică politicile, iar comportamentul binar la ștergere este susținut de contractul oficial al serviciului. [Ștergerea obiectelor Supabase Storage](https://supabase.com/docs/guides/storage/management/delete-objects)
