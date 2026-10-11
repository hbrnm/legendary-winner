# Cămara

Cumpărături, rețete, plan de mese, buget și cămară pentru gospodăriile din România. Mobil întâi, instalabilă ca aplicație (PWA) și folosibilă fără internet.

Fluxul: **plan → rețete → listă → cumpărături reale → buget → analiză**.

## Ce face
- **Liste de cumpărături** comune gospodăriei: adăugare rapidă („2 kg cartofi”), grupare pe raioane sau magazine, bifare în magazin, prețul plătit, finalizarea turei și istoricul.
- **Rețete** (86 în catalog și rețetele gospodăriei): porții, ingrediente trimise în listă, „am gătit” scade din cămară.
- **Planul săptămânii**: mese pe zile, copiere de săptămână, lista generată din plan (scade ce e deja în cămară).
- **Buget**: bugete pe lună, sursă, categorie sau magazin; cheltuiala reală vine doar din cumpărături, fără dublă numărare.
- **Prețuri**: doar cele introduse de gospodărie (plătite, văzute, promoții). Aplicația nu inventează prețuri.
- **Cămara**: ce ai acasă, unde stă, când expiră.
- **Gospodării cu membri și roluri** (proprietar, administrator, membru), invitații prin link, sincronizare între telefoane.
- **Mod demonstrativ**: fără Supabase configurat, aplicația merge complet local, pe un singur dispozitiv.

Aplicația publicată: https://appcamara.vercel.app

## Pornire rapidă
```sh
npm ci
npm run dev            # http://localhost:3000, mod demonstrativ
```
Cu Supabase: vezi [`docs/ENVIRONMENT_VARIABLES.md`](docs/ENVIRONMENT_VARIABLES.md) și [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Comenzi
| Comandă | Ce face |
| --- | --- |
| `npm test` | testele unitare și de servicii (Vitest) |
| `npm run test:db` | migrația, RLS și funcțiile, pe Postgres real |
| `npm run build` | export static în `out/` + service worker |
| `npm run test:e2e` | Playwright pe `out/`, mod demonstrativ |
| `npm run test:e2e:cloud` | Playwright cu Supabase local (fără Docker) |
| `npm run seed:sql` | regenerează `supabase/seed.sql` din `src/data` |
| `npm run lint`, `npm run typecheck` | ESLint, TypeScript |

## Documentație
- [Arhitectura](docs/ARCHITECTURE.md)
- [Schema bazei de date](docs/DATABASE_SCHEMA.md)
- [API (RPC și tabele)](docs/API_DOCUMENTATION.md)
- [Publicare (Supabase + Vercel)](docs/DEPLOYMENT.md)
- [Variabile de mediu](docs/ENVIRONMENT_VARIABLES.md)
- [Testare](docs/TESTING.md)
- [Starea implementării](docs/IMPLEMENTATION_STATUS.md)
- [Ce urmează](docs/ROADMAP.md)
- [Istoricul versiunilor](CHANGELOG.md)
- [Cum lucrăm cu Claude Code](docs/playbook-claude-code.md) și regulile din [`CLAUDE.md`](CLAUDE.md)
