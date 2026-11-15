# Cămara — redesign Material Design 3

Status: aprobat de proprietar la 15 noiembrie 2026; implementare pe ramura `claude/material-3-redesign`.

## Obiectiv și decizii confirmate

Refacerea întregii interfețe după Material Design 3 (https://m3.material.io/), pentru gospodării din România, cu prioritate pentru utilizarea pe telefon. Identitatea rămâne Cămara: verde natural, tonuri calde, texte în română. DM Sans local se folosește peste tot, inclusiv la titluri. Sunt permise îmbunătățiri ale organizării ecranelor, cu toate fluxurile și datele păstrate.

Cele cinci destinații principale rămân Acasă, Cumpărături, Rețete, Buget, Cămară. Planul săptămânal este accesibil în Rețete și din Acasă. Modurile luminos, întunecat și sistem sunt păstrate.

## Abordări

1. Material 3 cu identitatea Cămara — direcția aleasă: componente Material, paletă verde natural și fontul local existent.
2. Aspect Google/Pixel — alternativă nealeasă; uniformitate mai mare cu aplicațiile Google, dar identitate proprie mai redusă.
3. Material 3 Expressive — alternativă nealeasă; forme și mișcare mai accentuate, dar densitate mai mică pentru listele de cumpărături.

Implementarea propusă adaptează componentele React/Tailwind existente; nu introduce un framework UI suplimentar. Rămân Next.js, exportul static, Dexie și Supabase.

## Sistem vizual propus

- Paletă Material 3 statică, în jurul verdelui existent `#1e3f2b`. Roluri primary/on-primary, primary-container/on-primary-container, secondary, tertiary, surface și nivelurile surface-container, outline, error și perechile lor de text. Warning și success au roluri distincte; erorile nu reutilizează decorativ terracotta. Valorile finale se aleg și se verifică la implementare pentru contrast în ambele teme.
- Culorile rămân centralizate în CSS. Tokenii existenți sunt aliasuri temporare spre rolurile noi; fără culori directe în componente. Metadatele PWA sunt aliniate la teme.
- Tipografie DM Sans: display 36/44, headline 28/36, title 22/28 și 16/24, body 16/24 și 14/20, label 14/20 și 12/16 (dimensiune/interlinie în px). Sume cu cifre aliniate; diacriticele și fonturile rămân disponibile offline. Se înlătură utilizarea și încărcarea Fraunces; licențele existente se păstrează.
- Spațiere pe multipli de 4 px; margini mobile 16 px, tabletă 24 px, desktop 32 px. Forme: câmpuri 4 px, carduri 12 px, containere importante 16–28 px, dialoguri 28 px, butoane principale complet rotunjite. Suprafața și ierarhia tonală primează; umbre discrete doar unde exprimă elevația.
- Butoane filled, tonal, outlined și text; icon buttons cu suprafață tactilă de minimum 48 px. Câmpuri outlined de 56 px, cu etichete și mesaje asociate accesibil. Chips, segmented buttons, switch-uri, checkbox-uri, progres și snackbar-uri au stări coerente.
- Stările hover, focus, pressed, selected, disabled și error sunt explicite. Tranziții discrete de 150–250 ms, fără animații de layout în liste; respectarea `prefers-reduced-motion`.
- Pictogramele Lucide și pictogramele existente sunt păstrate, cu dimensiuni și grosimi coerente; nu este necesar un serviciu extern de iconuri.

## Navigație și ecrane

- Sub 600 px: navigation bar de 80 px plus safe area, cu cinci destinații și indicator tonal rotunjit. 600–1199 px: navigation rail de 96 px. De la 1200 px: drawer permanent de 256 px. Conținutul și acțiunile fixate țin cont de navigație, tastatură și safe area. În lista activă de cumpărături se păstrează modul actual concentrat, cu navigația inferioară ascunsă și buton de întoarcere vizibil.
- App bar comun cu identitatea gospodăriei, sincronizare și acces la setări. Titlurile paginilor și acțiunile principale au o ierarhie comună. Stările demo, offline, sincronizare și eroare rămân vizibile și accesibile.
- Acasă: salut și dată, adăugare rapidă, rezumat comun pentru buget și lista activă (se păstrează asocierea lor existentă), apoi mese planificate și produse care expiră. Acces direct la Plan, fără funcții noi.
- Cumpărături: liste active și istoric clar separate; listă activă cu adăugare rapidă, grupare, bifare, cantități, prețuri și total/finalizare. Aceeași funcționalitate pentru bonuri, OCR, verificare, variante și compararea costurilor.
- Rețete: catalog cu căutare și filtre, carduri foto și metadate lizibile. Subnavigație comună Rețete / Plan pe paginile de catalog și plan; rutele existente se păstrează. Detaliu rețetă, porții, ingrediente, gătire, editare și import sunt refăcute în același sistem.
- Plan: selector de săptămână și zile lizibile pe telefon, distribuție pe mai multe coloane când există spațiu. Se păstrează copierea săptămânii, editarea meselor și generarea listei.
- Buget: sumar lunar și progres, defalcări și istoric cu distincție între cheltuiala reală și estimări. Prețurile și produsele Diverse primesc aceeași structură vizuală; calculele și proveniența datelor rămân neschimbate.
- Cămară: căutare, filtre pentru locație și expirare, rânduri cu cantitate și termen, adăugare/editare în sheet. Starea expirării este exprimată și prin text sau pictogramă.
- Gospodărie și setări: grupuri pentru cont/gospodărie, membri/invitații, preferințe, date/backup și informații. Se păstrează toate permisiunile și acțiunile existente.
- Autentificare, invitații, administrare catalog, pagină offline, termeni și confidențialitate intră în redesign; conținutul juridic și controalele de autorizare rămân intacte.
- Sheet-urile rămân dialoguri native: bottom sheet pe telefon, dialog centrat de la 600 px, cu scroll intern și acțiuni vizibile. Se păstrează gestionarea tastaturii, Escape, focus și întoarcerea focusului. Fără gesturi de drag noi.
- Stările fără date, încărcare, eroare și succes se verifică pentru fiecare modul. Se reutilizează textele existente; eventualele texte noi se prezintă proprietarului într-un singur chestionar înainte de integrare.

## Limite și compatibilitate

Nu se modifică API-uri de server, schema bazei de date, autentificarea, rolurile, sincronizarea, regulile de buget sau conținutul catalogului. Rutele și parametrii URL rămân compatibili cu linkurile existente. Datele locale și preferința de temă se păstrează. Componentele comune pot primi variante vizuale, cu păstrarea proprietăților și comportamentului accesibil folosite de apelanții existenți. Fără migrații și fără publicare în producție în această lucrare.

## Etape și verificare

1. Înregistrarea situației inițiale: teste, build și capturi ale ecranelor principale; consultarea referinței Material 3 și a ghidurilor Next.js instalate înainte de cod.
2. Tokeni, tipografie, componente comune și navigație; adaptarea regulii vechi care interzice colțurile mari. Se păstrează testele care interzic culorile directe; se verifică rolurile și contrastul noilor teme.
3. Ecranele principale și toate paginile secundare, apoi consistența stărilor și a dialogurilor. Verificare vizuală pe un ecran reprezentativ înainte de propagarea detaliilor în restul aplicației.
4. Validare: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`. Testele de fonturi și navigație se adaptează la cerințele aprobate, fără a slăbi verificările funcționale.

Criterii de acceptare: toate rutele au noua identitate; nicio derulare orizontală a paginii la 360, 390, 600, 768, 1024 și 1440 px; nicio acțiune esențială acoperită de navigație sau tastatură; contrast WCAG AA (4,5:1 text obișnuit, 3:1 text mare și controale); navigare cu tastatura și focus vizibil; fluxul plan → ingrediente → listă → cumpărături → buget → cămară funcționează; fonturi și operații locale disponibile offline. Testele pentru roluri și sincronizare existente continuă să treacă; redesignul nu introduce cerințe de conectare noi.

Dimensiunile, breakpoint-urile și maparea componentelor de mai sus sunt propuneri tehnice ale implementatorului; alegerile confirmate de proprietar sunt enumerate în prima secțiune.
