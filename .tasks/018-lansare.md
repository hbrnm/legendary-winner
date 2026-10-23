# 018 — Lansarea: cerc restrâns, apoi public

**Stare:** în lucru — planul (23 oct. 2026)
**Ramuri:** câte una pe etapă, din `main` (`claude/018-...`).

## Scop
Proprietarul vrea să împartă aplicația (23 oct. 2026). Decizii (chestionar, 23 oct. 2026):
- întâi pagina de confidențialitate; apoi 10–20 de oameni invitați 2–3 săptămâni (familie, prieteni), ca să vedem erorile și costurile reale; lansarea publică după aceea;
- ciorna de confidențialitate și termeni o scrie Claude, după ce face aplicația de fapt, cu „DE COMPLETAT” pentru datele operatorului; nu se publică până nu o aprobă proprietarul, ideal după o privire de jurist.

## Ce știm deja (pentru ciornă)
- Conturi: email și parolă (Supabase Auth); datele sunt ale gospodăriei, cu membri și roluri; ștergeri logice (`deleted_at`).
- Unde stau datele: Supabase, proiectul „Camara”, `eu-central-1` (Frankfurt); aplicația statică pe Vercel (`appcamara.vercel.app`).
- Servicii externe: `read-receipt` (fotografia decupată a bonului → Gemini, nu se păstrează); `translate-recipe` (textul rețetei → Gemini, MyMemory de rezervă); `import-recipe` (descarcă pagina rețetei de la adresa dată). Fără bon pe server, bonul se citește pe telefon.
- Fotografiile rețetelor gospodăriei: bucketul privat `recipe-photos`.
- Copii de siguranță: pe planul gratuit Supabase, doar manuale (`docs/DEPLOYMENT.md`).
- DE COMPLETAT (proprietarul): numele și datele de contact ale operatorului, adresa pentru cereri GDPR, cât păstrăm datele după ștergerea contului.

## În afara scopului
- Schimbări de plan plătit, domeniu propriu, SMTP propriu: doar cu acordul explicit al proprietarului, separat.

## Etape
| # | Etapa | Stare |
|---|---|---|
| 1 | Ciorna: pagina „Confidențialitate și termeni” (`/confidentialitate/`), legături la înregistrare și în Gospodărie; textul în chestionar | de făcut |
| 2 | Ștergerea contului și descărcarea datelor, verificate (drepturile din GDPR) | de făcut |
| 3 | Pregătirea cercului restrâns: SMTP propriu? limitele Gemini și Supabase gratuit, de verificat cu proprietarul | de făcut |
| 4 | Cercul restrâns (2–3 săptămâni): erorile și costurile, apoi decizia pentru public | de făcut |

## Înainte de cercul restrâns (proprietarul)
- Verificarea pe telefon din `.tasks/README.md` (în așteptare din 18 oct.), plus #108 (căutarea pe bon) și #109 (mesajul de versiune nouă).
- PR #107 (închide 017).

## Următorul pas
Etapa 1, într-o sesiune nouă: ciorna de confidențialitate.
