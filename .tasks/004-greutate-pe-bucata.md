# 004 — Greutatea aproximativă pe bucată

**Stare:** în așteptare (proprietarul: aprobarea valorilor de mai jos și a migrației). Decizia „Greutăți chiar acum” (în 0.1.1), proprietarul, 11 oct. 2026, chestionar.
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
3. `Product.piece_grams`; conversia buc ↔ g/kg doar pentru produsul care are valoarea, în `toShoppingNeed`, `subtractStock`/`planConsumption` și `estimateCost`, cu teste (10 cepe → 1,5 kg; 2 kg în cămară acoperă 3 cepe; preț 5 lei/kg → 2 cepe = 1,50 lei). Pe listă rămâne nota „pentru rețete: 10 buc”, ca rotunjirea să se vadă.
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
| 1 | Aprobarea valorilor și a migrației | de făcut | |
| 2 | Teste care reproduc (pică) | de făcut | |
| 3 | Migrația, catalogul, conversiile, backup | de făcut | |
| 4 | `npm test`, `npm run test:db`, `npm run test:e2e`, `npm run build`; `verificare`; PR | de făcut | |
| 5 | Producția (cu acordul proprietarului) | de făcut | |

## Cum verific la final
Planul unei săptămâni cu 10 cepe în rețete pune pe listă 1,5 kg. Cu 2 kg de ceapă în cămară, ceapa nu mai apare pe listă.

## Următorul pas
Aprobarea tabelului de mai sus, apoi etapa 2 într-o sesiune nouă.
