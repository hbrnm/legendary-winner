# Variabile de mediu

Aplicația e statică: variabilele `NEXT_PUBLIC_*` se scriu în fișierele build-ului și ajung în browser. De aceea aici intră **doar** valori publice. Accesul la date e controlat de RLS, nu de secretul cheii.

| Variabilă | Obligatorie | Exemplu | Ce face |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | nu* | `https://<ref>.supabase.co` | adresa proiectului Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | nu* | cheia „anon public” din Project Settings → API | cheia publică a proiectului |

\* Dacă lipsește oricare dintre ele, aplicația rulează în **mod demonstrativ**: fără conturi, cu datele doar pe dispozitiv.

Local: copiază `.env.example` în `.env.local` și completează. `.env*` e ignorat de git (în afară de `.env.example`).

## Ce nu intră niciodată aici
- cheia `service_role` și parola bazei de date: nu sunt folosite de aplicație; stau doar în panoul Supabase;
- orice cheie secretă: nici în repo, nici în variabilele mediului cloud al sesiunilor Claude Code.

## Variabile folosite doar de unelte
| Variabilă | Unde | Ce face |
| --- | --- | --- |
| `TEST_DATABASE_URL` | `npm run test:db` | un Postgres existent (ex. serviciul din CI); fără ea, testul pornește un Postgres temporar local |
| `CI` | Playwright | 2 workeri, raport HTML, fără reutilizarea serverului |
| `OUT_DIR`, `PORT` | `scripts/serve-static.mjs` | ce dosar servește și pe ce port (implicit `out`, 3100) |
| `SITE_URL`, `DEBUG` | `scripts/local-supabase.mjs` | adresa aplicației pentru Auth (implicit `http://localhost:3200`); `DEBUG=1` arată logurile serviciilor |

Cheile din `scripts/local-supabase-keys.mjs` sunt doar pentru Supabase-ul local de test și nu deschid nimic real.
