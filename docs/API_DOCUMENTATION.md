# API

Aplicația nu are server propriu. Vorbește direct cu Supabase: PostgREST (`/rest/v1`) pentru tabele, funcții RPC pentru operațiile care cer verificări pe server, și Auth (`/auth/v1`). Toate cererile au cheia anon și, după autentificare, tokenul utilizatorului; RLS decide ce vede fiecare.

## Funcții RPC
Toate cer un utilizator autentificat (`anon` nu le poate apela).

| Funcție | Parametri | Întoarce | Ce face |
| --- | --- | --- | --- |
| `create_household` | `p_name text` (1–80 caractere) | `uuid` | creează gospodăria, te face owner, creează setările și o face activă; cel mult 5 gospodării proprii |
| `invitation_preview` | `p_token text` | `household_name, invited_by, role, expires_at` (0 sau 1 rând) | ce vezi înainte să accepți; nimic dacă invitația a expirat, a fost anulată sau folosită |
| `accept_invitation` | `p_token text` | `uuid` (gospodăria) | te adaugă în gospodărie cu rolul din invitație; verifică emailul, dacă invitația e pe email |
| `transfer_ownership` | `p_household uuid`, `p_new_owner uuid` | — | doar owner; noul owner trebuie să fie membru; vechiul owner devine admin |
| `household_member_list` | `p_household uuid` | `user_id, display_name, role, joined_at` | membrii, ordonați după rol; doar pentru membri |

Erorile au mesaje în română și coduri Postgres: `42501` (nu ai voie), `22023` (date invalide), `54000` (limită depășită).

## Tabele
Toate tabelele din [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) se folosesc prin PostgREST, cu aceleași reguli:
- **citire incrementală**: `select * … where updated_at >= <cursor> order by updated_at, id limit <n>`;
- **creare**: `upsert` pe `id` (id-urile le generează clientul, UUID);
- **modificare**: `update … where id = …` doar cu câmpurile schimbate; dacă RLS refuză, nu se întoarce niciun rând, iar clientul notează refuzul;
- **ștergere**: `update … set deleted_at = now()`; nu există `DELETE` pentru tabelele sincronizate.

Adaptorul din aplicație: [`src/lib/sync/supabase-remote.ts`](../src/lib/sync/supabase-remote.ts).

## Autentificare
Email și parolă (Supabase Auth, flux PKCE): cont nou, intrare, resetarea parolei. La crearea contului, declanșatorul `handle_new_user` creează profilul cu `display_name` din metadatele contului.

## Linkul de invitație
`<site>/invitatie/?token=<token>`. Tokenul are 48 de caractere hexazecimale aleatorii, e valabil 7 zile și poate fi folosit o singură dată.
