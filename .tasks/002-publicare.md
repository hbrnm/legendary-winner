# 002 — Publicarea (Supabase + Vercel)

**Stare:** gata (11 oct. 2026). O problemă de performanță rămasă deschisă, mai jos.
**Ramura:** `claude/publicare` (câte un PR pe etapă, din `main`)

## Scop
Cămara v1 pe producție: proiectul Supabase „Camara” existent și un proiect Vercel nou, pe un subdomeniu Vercel. Apoi se reverifică pe producție criteriile 1, 3, 20 și 21 (`docs/IMPLEMENTATION_STATUS.md`).

Decizii (11 oct. 2026):
- Pașii pe producție îi face Claude prin conectorii Supabase și Vercel. Înainte de **fiecare** comandă pe producție spune exact ce face și așteaptă „da” de la proprietar (`CLAUDE.md`). Pașii din panou pe care conectorii nu îi pot face îi primește proprietarul scriși pas cu pas.
- Proiectul Supabase: „Camara” existent (`wvgmwpvivospyetpznzv`, `eu-central-1`, Postgres 17).
- Adresa: un subdomeniu Vercel (`camara-….vercel.app`). Un domeniu propriu, mai târziu, cu acord separat.
- Emailurile de autentificare: serverul Supabase implicit, la început (limită mică pe oră). Un furnizor propriu (Resend, Brevo), mai târziu.

## Starea de la care pornim (citită pe 11 oct. 2026, fără modificări)
- Supabase „Camara”, creat pe 11 oct. la 12:23:
  - migrația e înregistrată ca `20261011135035 schema`, iar în repo e `20261011000001_schema.sql`, deci istoricul nu se potrivește;
  - toate tabelele au RLS; nu există conturi și nici date ale gospodăriilor;
  - catalogul e încărcat parțial: `recipe_steps` 0 din 498, `recipe_ingredients` 233 din 885; celelalte tabele sunt complete (471 de produse, 1127 de sinonime, 86 de rețete, 20 de categorii, 13 magazine, 5 locuri).
- Avertismentele de securitate ale proiectului (`get_advisors`):
  - `touch_updated_at` și `keep_household_id` nu au `search_path` fix;
  - 9 funcții `SECURITY DEFINER` pot fi apelate de `anon` prin `/rest/v1/rpc/…`, printre ele funcțiile de trigger (`handle_new_user`, `check_household_refs`, `limit_invitations`) și cele de ajutor pentru RLS (`can_read`, `can_write`, `is_member`, `member_role`, `is_household_admin`, `is_app_admin`);
  - funcțiile chemate de aplicație (`create_household`, `accept_invitation`, `invitation_preview`, `transfer_ownership`, `household_member_list`) rămân accesibile contului autentificat, intenționat.
- Vercel: echipa „hbrnm's projects”, fără proiect pentru Cămara.

## În afara scopului
- Domeniu propriu, SMTP propriu, plan plătit (fiecare cu acord separat).
- Notificări push de pe server (cer chei VAPID).

## Etape
| # | Etapa | Unde | Stare | Commit / PR |
|---|---|---|---|---|
| 1 | Migrație nouă de întărire: `search_path` fix pe cele 2 funcții; `revoke execute` de la `anon` pe tot ce nu e chemat fără cont și de la `authenticated` pe funcțiile de trigger. Test în `supabase/tests` că `anon` nu le poate chema, iar aplicația încă merge (`npm run test:db`, `npm run test:e2e:cloud`). | repo | gata | #4 |
| 2 | Producția Supabase: compar schema de pe producție cu migrația din repo. Dacă sunt identice, aliniez istoricul (`20261011000001` marcată ca aplicată, cea veche scoasă din istoric), fără să modific tabelele. Apoi aplic migrația din etapa 1, reîncarc `supabase/seed.sql` complet (sigur la rulări repetate) și verific numărul de rânduri și avertismentele. Fiecare comandă cu acord. | producție | gata | (doar pe producție) |
| 3 | Proiectul Vercel: creat din `hbrnm/legendary-winner`, build `npm run build`, ieșirea `out`, variabilele `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publice; nimic secret). Prima publicare. Cu acord. | producție | gata | (din panou) |
| 4 | Autentificarea Supabase: Site URL = adresa Vercel; Redirect URLs `…/autentificare/**` și `…/invitatie/**`. Dacă conectorul nu le poate seta, proprietarul le pune din panou, după pașii scriși. | producție | gata | (din panou) |
| 5 | Verificarea pe producție: proprietarul își face cont, apoi gospodăria, trimite o invitație unui al doilea cont și deschide o listă comună pe două telefoane. Apoi îl adaug în `app_admins` (cu acord). Bifez criteriile 1, 3, 20, 21 pe producție, cu dovada. | producție | gata | (doar pe producție) |
| 6 | Documentație la zi: `DEPLOYMENT.md` (istoricul migrațiilor, pașii reali), `IMPLEMENTATION_STATUS.md`, `CHANGELOG.md` (0.1.0 publicată), `README.md` (adresa). | repo | gata | PR-ul acestei etape |

## Rezumat pe etape
### Etapa 1 (11 oct.)
- Migrația `20261011000002_harden_functions.sql`:
  - `search_path = ''` pe `touch_updated_at` și `keep_household_id`;
  - cele 5 funcții de trigger nu mai pot fi chemate de nimeni (triggerele rulează și fără `EXECUTE`);
  - cele 6 funcții de ajutor pentru RLS rămân doar la `authenticated`, pentru că politicile le cheamă ca utilizatorul conectat;
  - cele 5 RPC-uri: revocat și de la `anon`, pentru că dreptul implicit al Supabase îl include explicit.
- `supabase-shim.sql` imită acum dreptul implicit al Supabase (`EXECUTE` pentru `anon` și `authenticated` pe funcțiile noi), ca testul să pice fără migrație. Fără migrație a picat: 11 funcții apelabile de `anon`, exact ca în `get_advisors` pe producție.
- 3 teste noi în `supabase/tests/rls.test.ts`: `anon` nu cheamă nicio funcție a noastră; `authenticated` nu cheamă funcții de trigger, dar cheamă cele 5 RPC-uri; toate funcțiile au `search_path` fix.
- Verificarea: `npm test` 105/105, `npm run test:db` 27/27, `npm run test:e2e:cloud` 1/1 (înregistrarea prin GoTrue declanșează `handle_new_user` fără `EXECUTE`), `npm run build`, `tsc --noEmit` și `eslint` curate.
- Rămâne pe producție (etapa 2): 6 funcții de ajutor și 5 RPC-uri apar în continuare în `get_advisors` ca apelabile de `authenticated`. E intenționat, iar funcțiile de ajutor răspund doar despre contul care le cheamă.

### Etapa 2 (11 oct.)
Doar pe producție (Supabase „Camara”), fiecare comandă cu acordul proprietarului.
- Comparația (doar citire):
  - textul migrației din istoric e identic, octet cu octet, cu `20261011000001_schema.sql` (md5 `3fd0fdcc…`);
  - amprenta schemei vii e identică cu cea dintr-un Postgres local cu aceeași migrație: coloane, constrângeri, indexuri, politici, funcții, triggere, drepturi pe funcții, Realtime;
  - singura diferență sunt drepturile implicite ale Supabase pe tabele (`anon` și `authenticated` au toate drepturile). Sunt acoperite de RLS: toate cele 27 de tabele au politici doar `to authenticated`, iar `TRUNCATE` nu se poate chema prin API.
- Istoricul: `20261011135035` redenumită în `20261011000001` (acord).
- Migrația `20261011000002_harden_functions` aplicată într-o tranzacție și înregistrată în istoric (acord). După aplicare:
  - nicio funcție de-a noastră nu mai poate fi chemată de `anon`;
  - funcțiile de trigger nu mai pot fi chemate de `authenticated`;
  - toate funcțiile au `search_path` fix;
  - `get_advisors` arată doar cele 11 funcții lăsate intenționat la `authenticated` (5 RPC-uri și 6 funcții de ajutor pentru RLS).
- Catalogul (acord): lipseau doar ingrediente (233 din 885) și toți pașii (0 din 498). Celelalte tabele aveau deja aceleași sume de control ca seed-ul.
  - Ingredientele le-am încărcat cu upsert prin conector, în 5 bucăți. Am verificat local, înainte, că bucățile dau exact același conținut ca `seed.sql`.
  - Pașii i-a încărcat proprietarul din SQL Editor, cu instrucțiunea din `seed.sql`, pentru că prin conector mergea prea încet.
  - Rezultat: toate cele 8 tabele ale catalogului au aceleași numere de rânduri și sume de control (fără `created_at` și `updated_at`) ca `seed.sql` aplicat local. Rânduri: 20 de categorii, 471 de produse, 1127 de sinonime, 13 magazine, 5 locuri, 86 de rețete, 885 de ingrediente, 498 de pași.
- De reținut: `seed.sql` întreg (474 KB) e prea mare pentru o singură cerere prin conector. La reîncărcări viitoare se folosește SQL Editor sau bucăți de cel mult 16 KB.

### Etapa 3 (11 oct.)
- Conectorul Vercel a fost refuzat la creare (403, pe ambele căi): poate citi doar proiectele `workflow-dosare` și `mentor-sec`. Proiectul l-a creat proprietarul din panou.
  - Numele proiectului: `appcamara`; adresa: https://appcamara.vercel.app.
  - Preset Next.js, cu setările de build implicite. Am renunțat la `out` ca Output Directory: cu preset-ul Next.js poate strica build-ul, iar Vercel recunoaște singur exportul static.
  - Variabilele `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY` (cheia anon legacy), simple, nu „Sensitive”.
- Rețeaua mediului cloud nu poate deschide `*.vercel.app`. Verificarea a făcut-o proprietarul: aplicația se deschide fără „Mod demonstrativ”.

### Etapa 4 (11 oct.)
- Proprietarul a setat din panou Site URL `https://appcamara.vercel.app` și Redirect URLs `…/autentificare/**` și `…/invitatie/**`. Conectorul Supabase nu are o funcție pentru setările de autentificare.
- Linkul de confirmare din email duce înapoi în aplicație.

### Etapa 5 (11 oct.)
- Criteriul 1: două conturi create din aplicație, ambele confirmate.
- Criteriul 3: invitație creată de proprietar și acceptată de al doilea cont, pe Android; rolurile sunt owner și member. Pe server: lista creată pe iPhone (3 produse, bifate) și o a doua listă („Lidl”). Proprietarul confirmă că le vede pe Android.
- Criteriul 20, citire în tranzacții anulate:
  - `anon` vede 0 gospodării, 0 membri și 0 produse;
  - un cont străin (id inventat) vede 0 gospodării, 0 membri și 0 liste, dar catalogul comun (471);
  - proprietarul își vede gospodăria.
- Criteriul 21: publicat pe Vercel, fără „Mod demonstrativ”.
- Proprietarul a fost adăugat în `app_admins` (acord, după id).
- **Deschis:** la 17:21, la revenirea în aplicație, sincronizarea de pe Android s-a oprit după tragerea tabelului `products`, iar aplicația „nu se mai încărca”. Serverul nu a primit nicio eroare. La 17:24 a pornit din nou și a sincronizat complet. Cauza nu e confirmată. Am găsit însă o problemă care o poate agrava: la fiecare sincronizare (o dată pe minut și la fiecare revenire în aplicație), telefonul descarcă din nou 1067 din cele 3105 rânduri ale catalogului. `pull` cere `updated_at >= cursor - 30 s`, iar catalogul a fost încărcat în câteva secunde, deci rândurile din ultimele 30 de secunde ale fiecărui tabel revin mereu. Pe producție sunt: toți cei 498 de pași, 295 de sinonime, 134 de ingrediente, 101 produse, 20 de categorii, 13 magazine, 5 locuri și o rețetă. Pe un telefon mai lent, fiecare sincronizare le rescrie în IndexedDB.

### Etapa 6 (11 oct.)
`DEPLOYMENT.md` (producția de acum, catalogul din SQL Editor, setările Vercel reale), `IMPLEMENTATION_STATUS.md` (criteriile 1, 3, 20, 21 pe producție), `CHANGELOG.md` (0.1.0 publicată) și `README.md` (adresa).

## Cum verific la final
- Adresa Vercel deschide aplicația fără „Mod demonstrativ”.
- Un cont nou primește emailul de confirmare.
- Două conturi văd aceeași listă.
- `get_advisors` (security) nu mai arată funcții interne apelabile de `anon`.
- `npm test`, `npm run test:db`, `npm run build` și E2E trec pe `main`.

## Următorul pas
Lucrare nouă, cu acordul proprietarului: sincronizarea să nu mai descarce tot catalogul la fiecare rulare (test care reproduce, apoi reparare).
