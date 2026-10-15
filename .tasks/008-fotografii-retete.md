# 008 — Fotografii pentru rețete

**Stare:** în lucru; etapele 1–4 gata, urmează etapa 5.
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
Rețetele au fotografie: cele din catalog (~85) primesc câte o fotografie aprobată de proprietar, iar fiecare gospodărie își poate pune fotografia ei la orice rețetă (a ei sau din catalog), direct de pe telefon. Fără fotografie, rețeta arată ca acum (fără pătrățele cu pictograme). Punctul 7 din [ROADMAP.md](../docs/ROADMAP.md), partea cu fotografiile.

Deciziile proprietarului (12 oct. 2026, chestionar):
- **Ce intră în prima versiune:** ambele, fotografiile catalogului și ale gospodăriilor.
- **Sursa pentru catalog:** bancă de imagini cu licență liberă (Unsplash, Pexels). Agentul propune câte una pe rețetă, cu sursa și autorul notate; proprietarul aprobă fiecare fotografie. Poza arată un fel asemănător, nu exact rețeta.
- **Stocarea fotografiilor gospodăriei:** Supabase Storage, bucket privat; le văd doar membrii gospodăriei (RLS pe `household_id`). Poza se micșorează pe telefon înainte de încărcare.
- **Fără internet:** pozele deschise o dată rămân în cache și apar și offline; o poză făcută offline se încarcă automat când revine internetul.

## În afara scopului
- Imagini generate cu AI.
- Mai multe fotografii pe rețetă (galerie) sau fotografii la pași.
- Fotografii la produse, la cămară sau la liste.
- Valorile nutriționale (cealaltă jumătate a punctului 7 din ROADMAP).
- Partajarea fotografiilor între gospodării sau propunerea lor pentru catalog.

## Restricții
- Catalogul: doar fotografii cu licență care permite folosirea gratuită și găzduirea în aplicație; pentru fiecare se notează sursa (URL-ul paginii), autorul și licența. Nimic nu intră fără aprobarea proprietarului, poză cu poză.
- Fotografiile catalogului se servesc din aplicație (`public/`), nu de pe CDN-ul băncii, ca să meargă offline și fără cereri către alte servere.
- Fotografiile gospodăriei: bucket privat, căi `{household_id}/{recipe_id}/{id}.webp`; politicile pe `storage.objects` folosesc `can_read` / `can_write` pe primul segment al căii. Niciun URL public; se citesc cu sesiunea membrului.
- Micșorarea pe telefon: latura mare max. 1280 px, WebP (JPEG dacă browserul nu poate), țintă ~200 KB. Metadatele (EXIF, locația GPS) se pierd la recodare, deci nu pleacă de pe telefon.
- Ștergere logică pe rând (`deleted_at`); fișierul din Storage se șterge după sincronizarea ștergerii.
- Textele noi (butoane, mesaje, mențiunea autorului) se aprobă într-un singur chestionar (etapa 5).

## Model
- **Catalogul:** `public/retete/{recipe_id}.webp` (max. 1280 px, ~150 KB) + `src/data/recipe-photos.ts`: `{ recipe_id, file, author, source_url, license }`. `recipes.image_url` primește calea relativă (`/retete/{id}.webp`); validarea din `kitchen.ts` acceptă și căi relative.
- **`recipe_photos`** (tabel nou): `id`, `household_id` (obligatoriu), `recipe_id` (rețetă globală sau a gospodăriei, verificată cu `check_household_refs`), `storage_path`, `width`, `height`, `created_by`, `created_at`, `updated_at`, `deleted_at`. Cel mult o fotografie activă pe gospodărie și rețetă (index unic parțial).
- **Ce se afișează:** fotografia gospodăriei, dacă există; altfel cea din catalog; altfel nimic.
- **Local:** Dexie ține rândurile `recipe_photos` (sincronizate ca restul) și, separat, coada de încărcare (blob-ul pozei până ajunge în Storage). Pozele descărcate stau în Cache Storage, cheia fiind `storage_path` (nu URL-ul semnat, care expiră).
- **Copia de siguranță** (export/import) include rândurile, nu fișierele; documentat.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Logica** (`src/lib/domain/recipe-photos.ts`, pură): tipul `RecipePhoto`; alegerea fotografiei afișate (gospodărie → catalog → nimic); dimensiunile la micșorare (max. 1280 px, fără mărire); calea în Storage (segmente verificate); `image_url` acceptă https sau `/retete/….webp`. Legarea în `RecipeVisual` se face la etapa 5, când există pozele gospodăriei. | gata | (vezi PR) |
| 2 | **Fotografiile catalogului:** agentul caută pe Unsplash/Pexels 2–3 variante pe rețetă și le pune într-o pagină de aprobare (cu autor, sursă, licență); proprietarul alege. Cele aprobate se optimizează în `public/retete/`, se notează în `src/data/recipe-photos.ts`, `image_url` în catalog și în `seed.sql` (`npm run seed:sql`). Mențiunea autorului pe pagina rețetei. Test: fiecare poză din listă are fișier, autor, sursă și licență. Poate merge în paralel cu etapele 3–4. | gata (2a codul, 2b pozele) | (vezi PR-urile) |
| 3 | **Baza de date:** migrația `recipe_photos` (RLS, `check_household_refs`, `touch_updated_at`, `keep_household_id`, index unic parțial) + bucket privat `recipe-photos` (limită de mărime și tipuri `image/webp`, `image/jpeg`) + politici pe `storage.objects`. Teste în `supabase/tests/` (membru, alt membru, membru din altă gospodărie, rețeta altei gospodării). `npm run test:db`. Documentația schemei. | gata | (vezi PR) |
| 4 | **Local și sincronizare:** versiune nouă Dexie, `recipe_photos` în `SYNCED_TABLES`, coada de încărcare (offline → încarcă la revenirea internetului, reîncearcă la eroare), descărcarea cu cache, ștergerea fișierului după ștergerea logică, copia de siguranță. Teste unitare (Storage simulat); `e2e-cloud` mutat la etapa 5. | gata | (vezi PR) |
| 5 | **Ecranele:** pe pagina rețetei, „Adaugă fotografie” (cameră sau galerie), „Schimbă” și „Șterge”; starea „se încarcă” / „se va încărca când ai internet”; fotografia în listele de rețete, plan și acasă. Textele: un chestionar. E2E (mod demonstrativ, fără Storage), capturi doar pentru ecranele noi. | de făcut | |
| 6 | **Producția:** migrația și bucketul cu acordul proprietarului, apoi integrarea; verificare pe Android și iPhone reale. | de făcut | |

## Rezumat pe etape
### Etapa 1 (12 oct. 2026)
Logica pură și tipul `RecipePhoto`, 11 teste noi în `recipe-photos.test.ts` și unul în `services.test.ts` (rețeta păstrează calea relativă, refuză `javascript:`). Validarea `image_url` din `saveRecipe` acceptă acum doar https sau o fotografie din catalog (înainte, orice URL, inclusiv http). `npm test`: 19 fișiere, 148 de teste; `npm run build` reușit. Deschis: mesajul de validare „Adresa fotografiei nu e validă.” (nu apare în ecrane azi) intră în chestionarul de texte de la etapa 5.

### Etapa 2a (12 oct. 2026)
Codul pentru fotografiile catalogului, fără poze încă. `src/data/recipe-photos.ts`: lista `RECIPE_PHOTOS` (goală), `recipePhotoProblems` (rețeta există, o poză pe rețetă, fișierul `public/retete/{recipe_id}.webp` există și are max. 250 KB, autor, sursă = pagina fotografiei pe Unsplash/Pexels, licență), `catalogPhotoByUrl` (găsește autorul după `image_url`, deci și la copiile rețetelor). `buildCatalog` pune `image_url` din listă; `seed.sql` are acum coloana `image_url` (toate `null` deocamdată). Mențiunea autorului sub fotografia mare de pe pagina rețetei: „Foto: Ana Pop / Unsplash”, cu „Unsplash” legătură către pagina fotografiei, în altă filă (text și legătură aprobate în chestionar, 12 oct. 2026). Teste: `src/data/recipe-photos.test.ts` (5), `recipe-visual.test.tsx` (+2).

Blocaj: rețeaua mediului cloud refuză `unsplash.com`, `images.unsplash.com`, `www.pexels.com`, `images.pexels.com` (și din terminal, și din WebFetch), deci propunerile de poze nu se pot căuta și descărca.

### Etapa 2b (12 oct. 2026)
Sursa s-a schimbat, cu acordul proprietarului (chestionar, 12 oct. 2026): **Wikimedia Commons** în loc de Unsplash/Pexels (Unsplash cere cheie API, Pexels rămâne blocat în rețea; Commons are fotografii cu feluri românești). Licențe acceptate: CC0, domeniu public, CC BY, CC BY-SA. Mențiunea: „Foto: Ana Pop / Wikimedia Commons · CC BY-SA 4.0”, cu legături către pagina pozei și către licență; la domeniul public, „domeniu public”, fără legătură.

- Căutare pe Commons (API, 2–3 termeni pe rețetă), max. 5 variante pe rețetă, pe o pagină de aprobare (artifact privat, alegerile salvate în baza lui). Proprietarul a ales 82 de poze; „Mâncare de mazăre cu pui” = „Niciuna”; fără propuneri: „Pilaf de pui”, „Tocană de cartofi”; nealeasă: „Paste cu ton și roșii”.
- Pozele: latura mare max. 1280 px, WebP, ~50–160 KB, în `public/retete/{recipe_id}.webp`; metadatele (EXIF) nu se păstrează. Lista în `src/data/recipe-photos-list.ts` (autor, pagina pozei, licența, legătura licenței).
- Modelul: `source` (`unsplash` / `pexels` / `wikimedia`), `license` (textul băncii), `license_url` (obligatoriu la CC BY / CC BY-SA). Testul refuză alte licențe de pe Commons.
- Offline: service worker-ul pune `/retete/*.webp` în cache la prima deschidere (nu în precache: ~9 MB); test e2e cu „Sarmale” fără internet.
- `CATALOG_VERSION` = 2026-10-12T09:00, `seed.sql` regenerat (coloana `image_url`).
- De știut: Wikimedia limitează descărcările; merge doar cu un User-Agent cu adresă (`CamaraApp/0.1 (https://github.com/hbrnm/legendary-winner)`) și o cerere la câteva secunde.

### Etapa 3 (15 oct. 2026)
Migrația `20261015000001_recipe_photos.sql`: tabelul `recipe_photos` (triggerele `touch_updated_at`, `keep_household_id`, `check_household_refs` pe `recipe_id`; index unic parțial pe gospodărie + rețetă; în Realtime), bucketul privat `recipe-photos` (1 MB, WebP/JPEG) și patru politici pe `storage.objects`.
- Abatere de la plan: politicile folosesc `is_member`, nu `can_read`/`can_write`, pe gospodăria din cale (`photo_household(name)`): pentru o cale greșită aceasta e `NULL`, iar `can_read(NULL)` ar însemna „catalog global”, deci vizibil tuturor.
- `storage_path` e verificat să fie exact `{household_id}/{recipe_id}/{id}.webp|jpg` al rândului: un rând nu poate arăta spre fișierul altei gospodării.
- Drepturi: `anon` nimic, `authenticated` fără `DELETE` (ștergere logică); fișierele se pot șterge din Storage (după sincronizarea ștergerii, etapa 4).
- Shim-ul de test imită `storage.buckets` / `storage.objects` cu RLS.
- De rezolvat la etapa 4: (a) doi membri care pun offline o fotografie la aceeași rețetă → al doilea rând e respins de indexul unic (23505); sincronizarea trebuie să-l șteargă logic pe cel pierdut și să-i șteargă fișierul, ca să nu blocheze coada; (b) Storage acceptă fișiere fără rând în `recipe_photos` (doar în dosarul gospodăriei) → curățarea fișierelor orfane; (c) limita de 1 MB și tipurile le aplică serviciul Storage, deci se verifică în `e2e-cloud`.
- Teste: `supabase/tests/recipe-photos.test.ts` (11). `npm run test:db`: 40 de teste; `npm test`: 160; `npm run build` reușit.

### Etapa 4 (15 oct. 2026)
Local și sincronizare, fără ecrane.
- Dexie versiunea 2: `recipe_photos` (sincronizat, după `recipe_steps` în `SYNCED_TABLES`), `photo_uploads` (coada fișierelor, `ArrayBuffer` pentru Safari) și `photo_removals` (fișierele de șters din Storage).
- `SyncEngine` primește `files` (`SupabaseFiles`, bucketul `recipe-photos`) și `cache` (Cache Storage `fotografii-retete`, numele nu începe cu „camara-”, ca service worker-ul să nu-l golească). Ordinea unei sincronizări: urcă fișierele → trimite outbox-ul (rândul fotografiei abia după fișier) → trage → șterge fișierele confirmate → curăță cache-ul.
- Rezolvat din etapa 3: (a) conflictul dintre doi membri: rândul refuzat dispare local, iar fișierul lui se șterge din Storage, deci coada nu se blochează; Storage care nu răspunde nu oprește restul datelor.
- Erorile Storage: refuz definitiv doar pentru 400/403/413/415/422; bucket lipsă (404) sau sesiune expirată se reîncearcă, ca să nu se piardă poza.
- **Siguranța pe producție până la etapa 6:** `recipe_photos` e în `OPTIONAL_TABLES`: tragerea îl sare cât timp migrația nu e aplicată, iar rândurile lui așteaptă în outbox (nu se pierd); abonamentul Realtime pentru fotografii e pe un canal separat (pe producție dă eroare în consolă până la migrație, fără efect asupra celorlalte).
- Un fișier cu eroare temporară nu oprește coada; o ștergere refuzată de server păstrează fișierul.
- Serviciul `src/lib/services/recipe-photos.ts`: `addRecipePhoto` (înlocuiește poza veche), `removeRecipePhoto`, `recipePhotoBlob` (coadă → cache → descărcare), `activeRecipePhoto`. Ecranele le folosesc la etapa 5.
- Copia de siguranță: rândurile fotografiilor intră, dar nu se readuc la import (fișierul nu e în copie și poate lipsi din Storage; în altă gospodărie calea nu mai e valabilă).
- Abatere: `e2e-cloud` se mută la etapa 5 (nu există încă ecrane, iar Supabase-ul local din `scripts/local-supabase.mjs` nu are Storage; trebuie adăugat atunci un Storage minimal în proxy). Rămâne deschis (b) din etapa 3: fișierele orfane din Storage.
- Teste: `src/lib/sync/photos.test.ts` (16). `npm test`: 22 de fișiere, 176 de teste; `npm run build` reușit.

### Rămas din etapa 2 (pentru o sesiune viitoare, opțional)
Poze pentru „Pilaf de pui”, „Tocană de cartofi”, „Paste cu ton și roșii”, „Mâncare de mazăre cu pui” (căutare nouă, aceeași pagină de aprobare).

## De ce are nevoie de la proprietar
- **Etapa 5:** aprobarea textelor noi.
- **Etapa 6:** acordul pentru migrație și bucket pe producție.

## Cum verific la final
Pe telefon: „Ciorbă de perișoare” are fotografia din catalog, cu autorul menționat. Fac o poză ciorbei mele, offline; după ce revine internetul, poza apare și pe telefonul altui membru al gospodăriei, dar nu și la o altă gospodărie. Pornesc avionul: ambele poze se văd în continuare. Șterg poza mea: revine cea din catalog.

## Următorul pas
Etapa 5 (ecranele, textele într-un chestionar, `e2e-cloud` cu Storage local), într-o sesiune nouă.
