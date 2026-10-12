# Auditul 0.1.1 (11 oct. 2026)

Pornit de la `main` `a9b26a3` (CI verde). Verificare în citire, apoi câte un PR pe problemă. Nimic din catalog sau din rețete nu s-a schimbat.

## 1. Probleme găsite
| Severitate | Unde | Problema | Dovada | Stare |
| --- | --- | --- | --- | --- |
| Înaltă | `src/lib/domain/pricing.ts` (`latestUnitPrice`) | Estimarea lua cel mai recent preț, indiferent de magazin sau sursă: o listă pentru Lidl putea fi estimată cu prețul de la piață. | `pricing.test.ts` („piață și supermarket…”) | PR #13 |
| Înaltă | `src/lib/domain/quantities.ts` (`toShoppingNeed`, `subtractStock`) | 136 de ingrediente cerute la bucată, pentru produse vândute la kg: lista pune „1 kg” oricât de multe bucăți cer rețetele, cămara nu le scade, iar costul lor e necunoscut. | auditul de mai jos, secțiunea 3 | `.tasks/004` (de aprobat) |
| Medie | `src/app/buget/page.tsx` | Numărul produselor fără preț din listele deschise (`unknown − checked_without_price`) putea fi greșit sau negativ. | `shopping.test.ts` (0 în loc de 1) | PR #14 |
| — | `src/lib/sync/*` | Fără probleme. O tragere întreruptă nu era acoperită de teste; acum este. | `engine.test.ts` | PR #12 |

Verificat și corect: proiecția bugetului de pe listă (sumele plătite pe listele deschise sunt deja în cheltuială, prin `spendRecords`), finalizarea fără dublă numărare (id-uri deterministe), lista recurentă după finalizare, bugetele pe sursă (piața și producătorul împreună), magazin și categorie, copia de siguranță (`backup.test.ts`, `e2e/copie-siguranta.spec.ts`), corecțiile din PR #7–#11 (`e2e/responsive.spec.ts`, așteptările E2E după rezultat, `engine.test.ts`).

## 2. Sincronizarea
`engine.ts` cere `server_now()` înaintea primei pagini. Cursorul `{updated_at, id, stable}` e salvat la finalul fiecărui tabel. Rândurile mai vechi decât `stable` nu se mai cer; cele recente se re-citesc de la `stable`. Paginile continuă strict după (`updated_at`, `id`). `applyRemoteRows` sare peste rândurile cu același `updated_at` și fără outbox, iar modificările locale netrimise se reaplică peste server. Ștergerile logice circulă ca orice actualizare.

Ipoteza rămasă (documentată în `.tasks/003`): o tranzacție se confirmă în mai puțin de 30 s de la scriere.

## 3. Rețetele (86 de rețete, 885 de ingrediente, 471 de produse)
Verificare automată (unități, cantitate pe porție, dubluri, timpi, porții, pași, ingrediente nemenționate în pași, alergeni). Testele din `src/data/catalog.test.ts` acoperă deja legătura cu catalogul și câmpurile obligatorii.

**Eroare certă (afectează lista, cămara, costul):** unitatea din rețetă nu se poate converti în unitatea de vânzare.
| Rețetă → produs | Ingrediente | Efect |
| --- | --- | --- |
| buc → kg (ceapă, morcovi, ardei, cartofi, roșii, mere…) | 136 | „1 kg” pe listă oricât de multe bucăți; cămara nu scade; fără cost. Reparat de `.tasks/004` |

**Posibilă eroare:** linia de listă devine „1 × ambalaj” cu nota „pentru rețete: …”. Corect pentru cantități mici; poate fi prea puțin dacă un plan cere mult.
| Unități | Ingrediente |
| --- | --- |
| linguriță/lingură → plic, borcan, sticlă, conservă, pachet, buc (condimente, ulei, pastă de tomate, muștar, smântână) | 106 |
| g/ml → buc, pachet, caserolă, conservă, borcan, pungă, sticlă (unt, smântână, paste, ciuperci, roșii în conservă, bulion, vin) | 74 |
| cățel → buc (usturoi) | 42 |
| lingură/linguriță → kg (zahăr, făină, griș) | 10 — rezolvat după 0.1.1 cu densitățile aprobate (`grams_per_ml`) |
| felie → buc (pâine) | 7 |
| buc → legătură / plic / pachet / borcan (ceapă verde, dafin, cub de supă) | 18 |

Pentru costul rețetei, aceste ingrediente au preț doar dacă gospodăria a introdus un preț în aceeași unitate. Altfel, rețeta arată „Cost incomplet”, ceea ce e corect.

**Problemă editorială (de aprobat separat; nu am modificat nimic):** ingrediente opționale sau verdețuri care nu apar în pași: mărar (ciorbă de perișoare, ciorbă de pui, sarmale, ardei umpluți), pătrunjel și leuștean (ciorbă de văcuță), lămâie (cozonac). La ghiveci, pașii spun „legumele”, fără să le numească. Propunere: câte o frază în pasul de servire („Presară mărarul tocat”).

**Necesită validare:** fără valori aberante de cantitate pe porție, porții (1–12), timpi sau număr de pași. Semnalele de alergeni ale scriptului erau false („două” conține „oua”, „mărunt” conține „unt”); alergenii vin din produse (`recipeAllergens`) și nu au fost găsite lipsuri reale.

## 4. Catalogul: modelul de acum
| Entitate | Tabel | Stare |
| --- | --- | --- |
| Produs generic | `products` (unitate de vânzare, categorie, sezon, piață, alergeni) | 471, scrise de agenți, aprobate 11 oct. |
| Categorii | `product_categories` | 20 |
| Sinonime | `product_aliases` | pentru căutare |
| Brand | `brands`, `products.brand_id` | tabel gol; `brand_id` peste tot `null` |
| EAN | `products.ean`, `product_retailer_mappings.ean` | peste tot `null`; nu se inventează |
| Magazine | `retailers` (13 lanțuri, tip) + magazinele gospodăriei | |
| Produs ↔ magazin | `product_retailer_mappings` (nume la magazin, EAN) | există în schemă, nefolosit în interfață |
| Prețuri | `product_prices` (magazin, sursă, tip: plătit/văzut/promoție/estimat, încredere, data) | doar de la gospodărie |

### Propunere pentru 0.2.0: produs generic → variantă comercială → ofertă → preț observat
- **`product_variants`** (nou): `product_id`, `brand_id`, `ean`, `net_quantity` + `net_unit` (ex. 500 g), denumire comercială. Rezolvă greutatea ambalajului (paste, unt, smântână) și conversia „1 pachet = 500 g” fără valori inventate: varianta o adaugă gospodăria sau un administrator, cu sursă.
- **`product_prices.variant_id`** (opțional) și **`valid_from` / `valid_to`** pentru promoții. Prețul pe kg se calculează din `net_quantity`.
- `product_retailer_mappings` devine oferta magazinului pentru o variantă (`variant_id` în loc de `product_id`).
- Surse permise: Open Food Facts (licență ODbL: atribuire și share-alike, de verificat), fișiere CSV furnizate legal (importul există deja), parteneriate, introducere manuală controlată. Fără scraping.

| | |
| --- | --- |
| Avantaje | estimări din prețul pe ambalaj; comparație pe kg între mărci; EAN pentru scanare |
| Dezavantaje | încă un nivel în interfață; date de întreținut |
| Costul migrării | 1 migrație aditivă (tabel nou + 2 coloane nulabile), RLS după modelul `products`, sincronizare (un tabel nou în `SYNCED_TABLES`), backup; datele existente rămân valide (`variant_id` null = produs generic) |
