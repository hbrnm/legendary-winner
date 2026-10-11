# 002 — Publicarea (Supabase + Vercel)

**Stare:** de făcut (planul aprobat pe 11 oct. 2026)
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
| 1 | Migrație nouă de întărire: `search_path` fix pe cele 2 funcții; `revoke execute` de la `anon` pe tot ce nu e chemat fără cont și de la `authenticated` pe funcțiile de trigger. Test în `supabase/tests` că `anon` nu le poate chema, iar aplicația încă merge (`npm run test:db`, `npm run test:e2e:cloud`). | repo | de făcut | |
| 2 | Producția Supabase: compar schema de pe producție cu migrația din repo. Dacă sunt identice, aliniez istoricul (`20261011000001` marcată ca aplicată, cea veche scoasă din istoric), fără să modific tabelele. Apoi aplic migrația din etapa 1, reîncarc `supabase/seed.sql` complet (sigur la rulări repetate) și verific numărul de rânduri și avertismentele. Fiecare comandă cu acord. | producție | de făcut | |
| 3 | Proiectul Vercel: creat din `hbrnm/legendary-winner`, build `npm run build`, ieșirea `out`, variabilele `NEXT_PUBLIC_SUPABASE_URL` și `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publice; nimic secret). Prima publicare. Cu acord. | producție | de făcut | |
| 4 | Autentificarea Supabase: Site URL = adresa Vercel; Redirect URLs `…/autentificare/**` și `…/invitatie/**`. Dacă conectorul nu le poate seta, proprietarul le pune din panou, după pașii scriși. | producție | de făcut | |
| 5 | Verificarea pe producție: proprietarul își face cont, apoi gospodăria, trimite o invitație unui al doilea cont și deschide o listă comună pe două telefoane. Apoi îl adaug în `app_admins` (cu acord). Bifez criteriile 1, 3, 20, 21 pe producție, cu dovada. | producție | de făcut | |
| 6 | Documentație la zi: `DEPLOYMENT.md` (istoricul migrațiilor, pașii reali), `IMPLEMENTATION_STATUS.md`, `CHANGELOG.md` (0.1.0 publicată), `README.md` (adresa). | repo | de făcut | |

## Cum verific la final
- Adresa Vercel deschide aplicația fără „Mod demonstrativ”.
- Un cont nou primește emailul de confirmare.
- Două conturi văd aceeași listă.
- `get_advisors` (security) nu mai arată funcții interne apelabile de `anon`.
- `npm test`, `npm run test:db`, `npm run build` și E2E trec pe `main`.

## Următorul pas
Etapa 1: migrația de întărire, cu test, într-un PR din `main`.
