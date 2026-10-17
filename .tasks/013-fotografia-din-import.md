# 013 — Fotografia rețetei importate din link

**Stare:** în lucru; etapa 1 gata (în repo), urmează etapa 2
**Ramura:** câte una pe etapă, fiecare cu PR-ul ei din `main`.

## Scop
La importul unei rețete din link, Cămara aduce și fotografia de pe site, ca fotografia gospodăriei la rețetă.

Decizia proprietarului (17 oct. 2026, chestionar): **copie privată**. Fotografia se descarcă o dată, se micșorează pe telefon și se păstrează ca fotografia gospodăriei (privată, ca la `.tasks/008`; merge și offline). Pe „Verifică rețeta” se vede și se poate scoate înainte de salvare. Variantele respinse: doar linkul (nu merge offline, poza poate dispărea, site-ul vede fiecare deschidere), fără fotografie.

## În afara scopului
- Textul lipit (Instagram, TikTok, Facebook): n-are fotografie.
- Mai multe fotografii pe rețetă, alegerea dintre pozele paginii, fotografiile pașilor.
- Publicarea fotografiei în catalogul global.

## Restricții
- Fotografia rămâne a site-ului: doar pentru gospodărie (bucketul privat `recipe-photos`), cu „Sursa: site” pe rețetă.
- Descărcarea prin funcția `import-recipe` (browserul nu poate citi imaginea altui site din cauza CORS), cu aceleași protecții ca pagina: doar `https`, adrese publice (SSRF), redirecționări verificate, limită de timp; doar `image/jpeg`, `image/png`, `image/webp`, `image/avif`, `image/gif`, cel mult 5 MB. Se socotește în limita de cereri de import (20 pe oră). Nu se păstrează pe server.
- Pe telefon: `resizePhoto` (latura mare 1280 px, WebP sau JPEG, fără EXIF), apoi `addRecipePhoto` după salvarea rețetei.
- Textele noi se aprobă într-un singur chestionar (etapa 2). Publicarea funcției pe producție doar cu acordul proprietarului.

## Model
- **Ciorna** (`RecipeDraft.image_url`): din JSON-LD `image` (text, `ImageObject.url`, listă; prima adresă `https`, max. 500), relativă la pagină.
- **Serverul:** `POST import-recipe {"image": "https://…"}` → corpul imaginii (`content-type` al imaginii) sau `{error}`.
- **Clientul:** după citirea rețetei, în fundal, imaginea → `resizePhoto` → previzualizare pe „Verifică rețeta” (cu „Scoate fotografia”) → la salvare, `addRecipePhoto`.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | **Ciorna și serverul:** `image_url` din JSON-LD; descărcarea imaginii în `import-recipe`; teste (fără rețea). | gata (în repo) | (vezi PR) |
| 2 | **Aplicația:** descărcare, micșorare, previzualizare, scoatere, salvare; textele noi; teste. | de făcut | |
| 3 | **Producția:** publicarea `import-recipe` (cu acord), încercarea pe telefon. | de făcut | |

## Rezumat pe etape
### Etapa 1 (17 oct. 2026)
- **Ciorna:** `imageUrlFrom` (`src/lib/domain/recipe-import.ts`) ia prima adresă `https` din `image` (text, `ImageObject.url`/`contentUrl`, listă), relativă la pagină, cu entitățile HTML decodate; `draftFromJsonLd` pune `image_url` doar când există (celelalte ciorne rămân la fel). Testul vechi „ignoră poza” schimbat cu bună știință.
- **Serverul** (`src/lib/server/import-recipe.ts`): descărcarea comună `fetchResource` (pagină sau imagine: SSRF, redirecționări verificate, timp, mărime); `fetchRecipeImage` acceptă doar `image/jpeg|png|webp|avif|gif` cu tipul declarat (fără SVG, fără tip lipsă), cel mult 5 MB; `POST {"image"}` întoarce octeții imaginii (`cache-control: no-store`), cu eroarea nouă `not_image`. Se socotește în limita de import.
- **Teste:** 8 pentru poza din JSON-LD, 2 pentru server (imaginea întoarsă; refuzuri: pagină, fără tip, SVG, prea mare, adresă internă, http). `core.js` regenerat și încercat cu Node.
- `verificare`: nimic blocant (nu e proxy deschis: doar cu cont, cu limită, https, adrese publice, 5 MB, 5 tipuri). Reparate: `image` doar ca text (cu `url` împreună → `bad_request`), `x-content-type-options: nosniff`, `contentUrl` când `url` e greșit, fără port în `image_url`, comentarii mutate la locul lor; teste noi: redirecționare spre adresă internă/http, imagine fără `Content-Length` peste limită, tipuri cu majuscule și `image/jpegx`, limita și tokenul, `//cdn`, `data:`, adâncime, listă goală.
- Funcția de pe producție nu are încă descărcarea imaginii: se publică la etapa 3; până atunci aplicația (etapa 2) trebuie să meargă și fără poză.

### Textele etapei 2 (aprobate, chestionar, 17 oct. 2026)
- Lângă fotografie: „Fotografia de pe {site}” și butonul „Scoate fotografia”.
- Cât se descarcă: „Aduc fotografia…”.
- La eșec (varianta aleasă, nu cea recomandată): „Nu am putut aduce fotografia. O poți pune din galerie după ce salvezi.”

## Cum verific la final
Pe telefon, cu cont: import din link o rețetă de pe un site românesc → pe „Verifică rețeta” se vede fotografia → salvez → rețeta are fotografia (și offline, și pe al doilea telefon al gospodăriei).

## Următorul pas
Etapa 2 (aplicația și textele noi).
