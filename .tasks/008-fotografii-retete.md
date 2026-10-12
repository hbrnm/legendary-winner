# 008 — Fotografii pentru rețete

**Stare:** în lucru; etapa 1 gata, etapa 2 pe jumătate (codul gata, pozele așteaptă acces la Unsplash/Pexels).
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
| 2 | **Fotografiile catalogului:** agentul caută pe Unsplash/Pexels 2–3 variante pe rețetă și le pune într-o pagină de aprobare (cu autor, sursă, licență); proprietarul alege. Cele aprobate se optimizează în `public/retete/`, se notează în `src/data/recipe-photos.ts`, `image_url` în catalog și în `seed.sql` (`npm run seed:sql`). Mențiunea autorului pe pagina rețetei. Test: fiecare poză din listă are fișier, autor, sursă și licență. Poate merge în paralel cu etapele 3–4. | 2a gata (codul); 2b de făcut (pozele) | (vezi PR) |
| 3 | **Baza de date:** migrația `recipe_photos` (RLS, `check_household_refs`, `touch_updated_at`, `keep_household_id`, index unic parțial) + bucket privat `recipe-photos` (limită de mărime și tipuri `image/webp`, `image/jpeg`) + politici pe `storage.objects`. Teste în `supabase/tests/` (membru, alt membru, membru din altă gospodărie, rețeta altei gospodării). `npm run test:db`. Documentația schemei. | de făcut | |
| 4 | **Local și sincronizare:** versiune nouă Dexie, `recipe_photos` în `SYNCED_TABLES`, coada de încărcare (offline → încarcă la revenirea internetului, reîncearcă la eroare), descărcarea cu cache, ștergerea fișierului după ștergerea logică, copia de siguranță. Teste unitare (Storage simulat) și `e2e-cloud`. | de făcut | |
| 5 | **Ecranele:** pe pagina rețetei, „Adaugă fotografie” (cameră sau galerie), „Schimbă” și „Șterge”; starea „se încarcă” / „se va încărca când ai internet”; fotografia în listele de rețete, plan și acasă. Textele: un chestionar. E2E (mod demonstrativ, fără Storage), capturi doar pentru ecranele noi. | de făcut | |
| 6 | **Producția:** migrația și bucketul cu acordul proprietarului, apoi integrarea; verificare pe Android și iPhone reale. | de făcut | |

## Rezumat pe etape
### Etapa 1 (12 oct. 2026)
Logica pură și tipul `RecipePhoto`, 11 teste noi în `recipe-photos.test.ts` și unul în `services.test.ts` (rețeta păstrează calea relativă, refuză `javascript:`). Validarea `image_url` din `saveRecipe` acceptă acum doar https sau o fotografie din catalog (înainte, orice URL, inclusiv http). `npm test`: 19 fișiere, 148 de teste; `npm run build` reușit. Deschis: mesajul de validare „Adresa fotografiei nu e validă.” (nu apare în ecrane azi) intră în chestionarul de texte de la etapa 5.

### Etapa 2a (12 oct. 2026)
Codul pentru fotografiile catalogului, fără poze încă. `src/data/recipe-photos.ts`: lista `RECIPE_PHOTOS` (goală), `recipePhotoProblems` (rețeta există, o poză pe rețetă, fișierul `public/retete/{recipe_id}.webp` există și are max. 250 KB, autor, sursă = pagina fotografiei pe Unsplash/Pexels, licență), `catalogPhotoByUrl` (găsește autorul după `image_url`, deci și la copiile rețetelor). `buildCatalog` pune `image_url` din listă; `seed.sql` are acum coloana `image_url` (toate `null` deocamdată). Mențiunea autorului sub fotografia mare de pe pagina rețetei: „Foto: Ana Pop / Unsplash”, cu „Unsplash” legătură către pagina fotografiei, în altă filă (text și legătură aprobate în chestionar, 12 oct. 2026). Teste: `src/data/recipe-photos.test.ts` (5), `recipe-visual.test.tsx` (+2).

Blocaj: rețeaua mediului cloud refuză `unsplash.com`, `images.unsplash.com`, `www.pexels.com`, `images.pexels.com` (și din terminal, și din WebFetch), deci propunerile de poze nu se pot căuta și descărca.

### Ce rămâne pentru etapa 2b
1. Proprietarul adaugă domeniile de mai sus la „Allowed domains” în setările mediului cloud.
2. Agentul caută 2–3 variante pe rețetă (Unsplash `napi/search/photos`, Pexels) și publică pagina de aprobare (artifact cu alegerea salvată, citită apoi de agent).
3. Pozele alese: script de optimizare cu `sharp` (latura mare 1280 px, WebP, ~150 KB; `sharp` vine deja cu Next, se adaugă ca devDependency), fișierele în `public/retete/`, intrările în `RECIPE_PHOTOS`, `CATALOG_VERSION` nou, `npm run seed:sql`.
4. Offline: în `src/sw/sw.template.js`, `/retete/*.webp` din cache, apoi rețea (ca `/icons/`), nu în precache (~85 × 150 KB); atenție, `/retete/` e și ruta paginii de rețete, deci regula se leagă de extensie. Test e2e offline cu o poză din catalog.

## De ce are nevoie de la proprietar
- **Etapa 2b:** accesul la Unsplash/Pexels în rețeaua mediului cloud; aprobarea fiecărei fotografii din catalog (pagina de aprobare).
- **Etapa 5:** aprobarea textelor noi.
- **Etapa 6:** acordul pentru migrație și bucket pe producție.

## Cum verific la final
Pe telefon: „Ciorbă de perișoare” are fotografia din catalog, cu autorul menționat. Fac o poză ciorbei mele, offline; după ce revine internetul, poza apare și pe telefonul altui membru al gospodăriei, dar nu și la o altă gospodărie. Pornesc avionul: ambele poze se văd în continuare. Șterg poza mea: revine cea din catalog.

## Următorul pas
Etapa 2b (după ce rețeaua permite Unsplash/Pexels) sau etapa 3 (baza de date), într-o sesiune nouă.
