> Actualizare Ritm: designul Health inspirat a fost aprobat ulterior și implementat local. Vezi [RITM_IMPLEMENTATION.md](RITM_IMPLEMENTATION.md). Pachetul ZIP pregătit inițial rămâne o copie a etapei anterioare.

# Cămara — handoff design și implementare

## 1. Stare și sursa de adevăr

Repo: https://github.com/hbrnm/legendary-winner
Ramură locală: `claude/material-3-redesign`
Commit de bază: `88d3780af78105d489cd9eeb3f713d445e885d84`

Redesignul Material 3 aprobat este implementat local. Schimbările sunt necomise și nu au fost trimise pe GitHub sau publicate. Propunerile vizuale generate ulterior sunt explorări: utilizatorul nu a selectat încă una dintre cele trei alternative. Cele două SVG-uri sunt propunerea ulterioară pentru Acasă, nu o captură a interfeței implementate și nu o direcție finală aprobată.

Nu există un fișier Figma creat: integrarea nu a expus instrumentele de creare/editare în sesiune. Pachetul include SVG-uri importabile, nu un fișier `.fig` sau componente Figma conectate la cod. La import se verifică fonturile și comportamentul textului; nu se presupune că s-au păstrat Auto Layout, componentele și variabilele.

## 2. Decizii confirmate

- Material Design 3 cu identitatea Cămara, verde natural, suprafețe tonale și font DM Sans peste tot.
- Temă luminoasă, întunecată și automată; fonturi locale cu diacritice, disponibile offline.
- Cinci destinații: Acasă, Cumpărături, Rețete, Buget, Cămară. Planul este în secțiunea Rețete, cu acces și din Acasă.
- Reorganizarea vizuală este permisă, cu funcțiile, datele, rutele, rolurile și sincronizarea păstrate.
- Interfață în română. Textele existente se păstrează; textele noi se prezintă proprietarului pentru aprobare.

## 3. Sistem de design pentru dezvoltator

Sursa tokenilor: `src/app/globals.css`. Componentele folosesc rolurile semantice, nu culori directe.

| Rol | Luminos | Întunecat |
|---|---|---|
| Background | #f8faf3 | #11150f |
| Primary | #315c3d | #a1d3a7 |
| On primary | #ffffff | #073816 |
| Primary container | #cdebd0 | #264f30 |
| Secondary container | #d5e8cc | #3b4b36 |
| On surface | #191d18 | #e1e5da |
| Outline pentru controale | #727b6c | #8b9686 |

Nu se confundă `outline` cu `line`: separatoarele decorative pot fi mai discrete; contururile controalelor trebuie să rămână vizibile.

Tipografie: DM Sans local, body 14–16 px; câmpuri minimum 16 px pentru a evita zoom-ul Safari. Titluri de pagină 28/36 px. Numerele folosesc cifre aliniate.

Layout: mobil sub 600 px, navigation bar 80 px + safe area; tabletă 600–1199 px, rail 96 px; desktop de la 1200 px, drawer 256 px. Margini de conținut 16/24/32 px. Zone tactile minimum 48 px; câmpuri comune 56 px. În lista activă de cumpărături rămâne modul concentrat fără bara inferioară. Offset-urile elementelor fixate trebuie să urmeze înălțimea reală a navigației.

Forme: câmpuri 4 px, suprafețe/carduri 12–16 px, containere importante și dialoguri până la 28 px; acțiuni principale rotunjite complet. Dialog nativ, bottom sheet pe mobil și centrat de la 600 px. Se păstrează Escape, focus, scroll intern și adaptarea la tastatură. Mișcare discretă, cu respectarea `prefers-reduced-motion`.

## 4. Ce este implementat

Tokeni și ambele teme, tipografie, butoane, câmpuri, segmented controls, switch-uri, chips, carduri, dialoguri și snackbar-uri; navigație adaptivă și subnavigație Rețete/Plan. Stilurile au fost propagate în toate rutele, inclusiv autentificare, gospodărie, administrare, offline și paginile juridice.

Fișiere de intrare importante: `src/components/app/shell.tsx`, `src/components/ui/`, `src/components/home/home-screen.tsx`, `src/components/recipes/navigation.tsx`. Pentru detaliile complete: `docs/material-3-design.md` și `docs/superpowers/plans/2026-11-15-material-3.md`.

API-urile, schema, logica de buget, autentificarea și serviciile de date nu au fost schimbate. Nu s-au adăugat dependențe.

## 5. Propunerea Acasă, separată de implementare

În `proposal/` sunt variantele luminoasă și întunecată la 390 × 844 px și o previzualizare HTML.

Ierarhie propusă: salut și dată → adăugare rapidă → buget → lista activă cu o singură acțiune principală → masa zilei → navigație. Valorile provin din gospodăria demonstrativă; în implementare se leagă la datele reale, nu se hardcodează. Data din machetă este 15 noiembrie 2026; aplicația folosește data din mecanismul existent.

Pachetul include și cele trei alternative anterioare în `alternatives/`, în ordinea afișată utilizatorului. Niciuna nu a fost aleasă. Capturile din `implemented/` arată aplicația implementată, nu alternativele.

## 6. Validare efectuată în această sesiune

- 52 fișiere de teste unitare, 657 teste trecute.
- Lint, TypeScript și build trecute.
- Browser: 57/60 scenarii au trecut inițial; cele 3 eșecuri au fost corectate și rerulate cu succes. Alte 4 scenarii noi au trecut. Total: 64 scenarii unice verificate în două rulări, nu o singură rulare de 64.
- Lățimi verificate: 360, 390, 600, 768, 1024, 1440 px; teme luminoasă/întunecată, fonturi, formulare, bonuri, import, fotografii și offline.
- Probleme remediate: offset-ul butonului de citire a bonului pentru bara de 80 px; contururile câmpurilor în tema luminoasă; așteptările testelor pentru vechiul font Fraunces.
- Revizie independentă a diff-ului efectuată; constatarea fermă privind contururile a fost remediată și acoperită de test.

Comenzi uzuale: `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. În această sesiune Playwright a folosit Chromium de sistem `/usr/bin/chromium` prin configurație temporară, fără schimbarea configurației repository-ului. Pe un alt calculator se instalează browserele Playwright necesare. Verificările sunt cele înregistrate la momentul implementării; handoff-ul nu a declanșat o nouă rulare.

## 7. Preluare

Pentru workspace-ul actual, se continuă din ramura locală existentă; nu se aplică patch-ul încă o dată.

Pentru un checkout separat:
1. Se pornește de la commit-ul de bază indicat mai sus, într-o ramură nouă.
2. Se verifică și se aplică `source-changes.patch` cu `git apply --check`, apoi `git apply`.
3. Se copiază fișierele din `new-files/` în aceleași căi relative din repository. Patch-ul conține doar fișierele urmărite; fișierele noi sunt separate.
4. Se instalează dependențele și se rulează verificările de mai sus.

Următorul pas de produs: proprietarul alege dacă păstrează implementarea actuală sau adoptă o alternativă ori propunerea SVG pentru Acasă. După alegere, aceasta devine referința vizuală pentru implementare și verificare. Crearea unui document Figma, commit/push și publicarea nu au fost efectuate prin acest handoff.
