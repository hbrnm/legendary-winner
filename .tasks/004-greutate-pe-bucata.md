# 004 — Greutatea aproximativă pe bucată

**Stare:** în lucru: codul e gata (PR), migrația și seed-ul pe producție așteaptă acordul proprietarului. Decizia „Greutăți chiar acum” (în 0.1.1) și valorile de mai jos aprobate de proprietar, 11 oct. 2026, chestionar („Aprob, continuă acum”).
**Ramura:** `claude/greutate-pe-bucata` (un PR din `main`, într-o sesiune nouă)

## Scop
Rețetele cer multe legume și fructe la bucată („2 cepe”), dar produsul se vinde la kg. Azi:
- lista pune „1 kg ceapă, pentru rețete: N buc”, oricât de mare e N (`toShoppingNeed`, `src/lib/domain/quantities.ts`);
- cămara nu scade ceapa ținută în kg dintr-o nevoie în bucăți (`subtractStock`: unități incompatibile);
- costul rețetei nu folosește prețul pe kg (`estimateCost`: unități incompatibile).

Problema apare la 136 din cele 885 de ingrediente (auditul din `docs/AUDIT_0.1.1.md`).

## În afara scopului
- Greutatea ambalajelor (pachet de paste, unt, smântână), densitatea pentru linguri de zahăr sau făină. Acestea țin de modelul de variante comerciale din 0.2.0.
- Valori nutriționale, prețuri.

## Abordarea
1. Migrație nouă `20261012000001_piece_grams.sql`: `products.piece_grams numeric null check (piece_grams > 0 and piece_grams <= 5000)`. Fără schimbări de RLS (coloană pe un tabel existent). `npm run test:db`.
2. `src/data`: câmpul opțional `piece_g` în `ProductSeed`, valorile aprobate, `CATALOG_VERSION` nou, `npm run seed:sql`.
3. `Product.piece_grams`; conversia buc ↔ g/kg doar pentru produsul care are valoarea, în `toShoppingNeed`, `subtractStock`/`planConsumption` și `estimateCost`, cu teste (10 cepe → 1,5 kg; 2 kg în cămară acoperă 3 cepe; preț 5 lei/kg → 2 cepe = 1,50 lei). Pe listă rămâne nota „pentru rețete: 10 buc”, ca aproximarea să se vadă (text existent, aceeași formă).
4. Copia de siguranță: câmpul nou intră în export/import (`backup.test.ts`).
5. Producția: migrația și seed-ul doar cu acordul proprietarului; apoi `list_migrations` și o verificare a rândurilor.

## Valorile propuse (scrise de agent, de aprobat): greutatea medie la cumpărare, cu coajă
| Produs (`id`) | g / buc |
| --- | --- |
| ceapa-galbena | 150 |
| ceapa-rosie | 150 |
| morcovi | 100 |
| ardei-gras | 150 |
| ardei-iute | 20 |
| pastarnac | 150 |
| patrunjel-radacina | 80 |
| cartofi-albi | 150 |
| dovlecei | 300 |
| vinete | 300 |
| rosii | 150 |
| castraveti | 200 |
| mere | 180 |
| banane | 180 |
| portocale | 200 |
| kiwi | 80 |

Sunt valori aproximative, de bucătărie. Nu provin dintr-o sursă oficială și se afișează ca aproximări.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | Aprobarea valorilor și a migrației | făcut | chestionar, 11 oct. |
| 2 | Teste: `services.test.ts` (listă, cămară, cost, „am gătit”), `units.test.ts`, `rls.test.ts`; testul de servicii pică fără greutăți (verificat) | făcut | |
| 3 | Migrația, catalogul (`CATALOG_VERSION` 2026-10-11T19:00Z), conversiile (`convertWithPiece` în listă, cămară, prețuri, „ce pot găti”), `normalizeRemote` | făcut | |
| 4 | `npm test` 126, `npm run test:db` 28, `npm run test:e2e` 20, `npm run build`; `verificare`; PR | făcut | |
| 5 | Producția: migrația, apoi `seed.sql`, **înainte** de integrarea PR-ului (codul nou scrie `piece_grams`) | de făcut (acordul proprietarului) | |

## Cum verific la final
Planul unei săptămâni cu 10 cepe în rețete pune pe listă 1,5 kg. Cu 2 kg de ceapă în cămară, ceapa nu mai apare pe listă.

## Următorul pas
Acordul proprietarului pentru etapa 5; apoi integrarea PR-ului.
