# Publicare: Supabase + Vercel

Aplicația e statică (`out/`), deci are nevoie doar de un proiect Supabase și de o găzduire statică (Vercel). Pașii de mai jos îi face proprietarul, în conturile lui; în repo nu intră nicio cheie secretă.

## Producția de acum (11 oct. 2026)
- Adresa: https://appcamara.vercel.app (proiectul Vercel `appcamara`, echipa „hbrnm's projects”). Fiecare push pe `main` se publică automat.
- Supabase: proiectul „Camara” (`wvgmwpvivospyetpznzv`, `eu-central-1`). Istoricul migrațiilor are `20261011000001 schema` și `20261011000002 harden_functions`, la fel ca `supabase/migrations/`.
- Catalogul e identic cu `supabase/seed.sql` (aceleași rânduri și sume de control).
- Administratorul aplicației: contul proprietarului.
- Detaliile publicării: `.tasks/002-publicare.md`.

## 1. Proiectul Supabase
1. Creează un proiect în [Supabase](https://supabase.com/dashboard), regiunea cea mai apropiată (ex. Frankfurt, `eu-central-1`).
2. Leagă repo-ul și aplică migrația:
   ```sh
   npx supabase login
   npx supabase link --project-ref <ref-ul proiectului>
   npx supabase db push
   ```
3. Încarcă catalogul (poate fi rulat din nou; actualizează rândurile existente):
   ```sh
   psql "<connection string din Project Settings → Database>" -f supabase/seed.sql
   ```
   Fără `psql`, merge și din **SQL Editor**: lipești conținutul lui `seed.sql` și apeși **Run**. Dacă fișierul e prea mare pentru editor, rulează pe rând câte o instrucțiune `insert … on conflict`, una pentru fiecare tabel.
4. **Authentication → URL Configuration**:
   - Site URL: adresa publică (ex. `https://camara.vercel.app`);
   - Redirect URLs: `https://<domeniu>/autentificare/**` și `https://<domeniu>/invitatie/**`.
5. **Authentication → Providers → Email**: activ. Confirmarea emailului poate rămâne pornită; aplicația spune utilizatorului să deschidă linkul primit. Pentru volume reale, configurează un SMTP propriu (cel implicit are limite mici).
6. **Database → Replication**: publicația `supabase_realtime` e setată de migrație; verifică doar că Realtime e activ pe proiect.

### Administratorii aplicației
Doar ei pot modifica catalogul comun (ecranul „Administrare”). După ce persoana și-a făcut cont, în SQL Editor:
```sql
insert into public.app_admins (user_id)
select id from auth.users where email = '<email>';
```

## 2. Vercel
1. Importă repo-ul în Vercel (https://vercel.com/new). Framework: Next.js. Lasă implicite **Build and Output Settings**: Vercel recunoaște exportul static (`output: "export"`) și rulează `npm run build`. Nu schimba Output Directory în `out` cu preset-ul Next.js.
2. Variabilele de mediu (Production și Preview), simple, nu „Sensitive”: amândouă sunt publice și ajung oricum în browser. Vezi [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Publică. Verifică: crearea unui cont, a unei gospodării, o invitație deschisă de pe alt telefon, o listă care apare pe amândouă.

Fără aceste variabile, build-ul pornește în **mod demonstrativ** (date doar pe dispozitiv).

## 3. Schimbări de schemă
- Doar prin migrații noi în `supabase/migrations/` (nu se modifică migrațiile deja aplicate).
- Înainte: `npm run test:db`. Apoi `npx supabase db push`.
- Dacă se schimbă `src/data`: `npm run seed:sql`, commit, apoi rulează din nou `supabase/seed.sql` pe proiect.

## 4. Copii de siguranță și restaurare
- **Supabase**: planurile plătite au copii zilnice automate (Database → Backups), cu restaurare din panou. Pe planul gratuit, fă copii manuale:
  ```sh
  npx supabase db dump --linked -f backup-schema.sql
  npx supabase db dump --linked --data-only -f backup-date.sql
  ```
  Restaurare pe un proiect nou: aplică migrațiile (`db push`), apoi `psql "<connection string>" -f backup-date.sql`.
  Datele de autentificare (`auth.users`) nu intră în dump-ul schemei `public`; pentru o copie completă folosește `pg_dump` pe tot proiectul, cu connection string-ul din panou.
- **Utilizatorul**: din „Gospodărie și setări” poate descărca datele gospodăriei ca fișier JSON (`exportHouseholdData`). Fișierul se readuce cu „Încarcă o copie” (`importHouseholdData`): adaugă rândurile lipsă și le actualizează doar pe cele mai vechi decât copia; nu șterge nimic.

## 5. Ce nu face aplicația (încă)
Notificări push de pe server (cer chei VAPID), import automat din cataloagele magazinelor. Vezi [ROADMAP.md](ROADMAP.md).
