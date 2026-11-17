# FAB contextual și simplificarea fluxurilor — plan de implementare

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans pentru implementare în etape. Pașii `[ ]` sunt de bifat doar după verificare. Delegarea este opțională și necesită alegerea utilizatorului.

**Goal:** Un singur punct principal de adăugare pe fiecare tab, cameră accesibilă direct, Acasă compact, rețete conectate corect la stoc, import de liste și buget simplificat, fără pierderea funcționalităților sau datelor existente.

**Architecture:** Păstrăm App Router cu export static, componentele Sheet, Dexie/outbox și serviciile existente. Separăm alegerea acțiunii pe rută de formularele de domeniu. Importul se parsează local, se verifică înainte de salvare și se persistă atomic.

**Tech Stack:** Next.js 16.4.2, React 19.3, TypeScript, Dexie, Supabase, Vitest și Playwright; pdfjs-dist încărcat la cerere pentru PDF cu text.

**Spec:** `docs/superpowers/specs/2026-11-17-contextual-actions-user-brief.txt`, copie integrală a documentului atașat. Acest plan face explicite propunerile tehnice acolo unde documentul oferă alternative. Nu este o implementare și nu autorizează publicarea.

## Constrângeri globale

- Numele rămâne Cămara. Documentul folosește și alte denumiri; nu includem rebranding.
- Un FAB principal pe tab; eliminăm declanșatoarele duplicate numai când înlocuitorul funcționează. Rămân acțiunile operaționale: Salvează, Alege, bife, finalizare cumpărături, editare, anulare.
- Nicio migrație de date sau eliminare de venituri/bugete existente în această etapă. Veniturile rămân sursele recurente stocate în `Budget.income_sources`, nu devin tranzacții lunare noi.
- Păstrăm fluxurile offline, gospodăriile izolate, actualizarea prin outbox, sumele în lei și regulile existente de unități.
- Nu afișăm fotografii AI retrase și nu inventăm poze pentru rețetele fără fotografie reală.
- Touch targets minimum 44 px, mod luminos/întunecat, etichete accesibile, Escape, focus inițial/restaurat și tastatură mobilă.
- Textele din brief sunt referința; mesajele suplimentare și limitele propuse mai jos se prezintă pentru revizie înaintea implementării lor.
- Păstrăm modificările Modern Web Guidance deja prezente și necomise în checkout. Nu le resetăm și nu le amestecăm necontrolat cu etapa nouă.
- Fiecare etapă are teste unitare/servicii și E2E proprii; actualizarea testelor nu este amânată până la final.

## Constatări care schimbă implementarea

1. `CaptureHost` are deja FAB și meniu universal. Refactorizăm această infrastructură, nu construim un al doilea FAB în AppShell.
2. `RecipeImage` există în lista de rețete. Verificăm datele și randarea miniaturilor; nu duplicăm componenta sau politica de prioritate recent implementată.
3. Filtrul curent „Ce pot găti” folosește `whatCanICook(..., 0.5)`: înseamnă acoperire parțială. „Gata de gătit” trebuie să însemne zero necesar lipsă pentru porțiile standard.
4. `averageTrip()` grupează deja după `transaction_id`. Cifra 12,31 RON nu dovedește că împărțirea se face pe produse. Investigăm și intrările/datele tranzacțiilor înainte de orice schimbare a formulei.
5. `IncomePanel` deține împreună cardul și formularul. Mai întâi extragem formularul controlabil; apoi putem elimina cardul fără pierderea editorului.
6. `output: "export"` exclude un endpoint Next.js dinamic `/api/import-shopping-list`. Recomand PDF cu text extras pe client, fără server nou. PDF scanat nu este acoperit automat de OCR-ul de bonuri.
7. Nu există o selecție unică a listei active: Acasă și CaptureHost folosesc reguli diferite. Introducem o politică partajată înainte de redirecționarea automată.

## Decizii propuse și limite de acceptare

- **Rutare:** FAB pe cele cinci ecrane principale și pe `/cumparaturi/lista/`. Fără FAB pe editor/import rețetă, autentificare și formulare dedicate; nu acoperim butonul Salvează cu un al doilea flux. `/plan/` și `/buget/diverse/` păstrează comportamentul curent până la o cerință explicită.
- **Lista activă:** selecție locală pe dispozitiv, separată după utilizator/mod și gospodărie. Preferăm ID-ul ales dacă lista este validă; altfel lista cu cele mai multe produse nebifate, apoi ultima actualizare, apoi ID. Nu persistăm implicit selecția în Supabase.
- **Cameră:** input permanent montat în host; `.click()` în același handler al opțiunii, înainte de await/navigare. `capture="environment"` este o indicație pentru browser, nu o garanție de cameră pe toate dispozitivele. Desktop poate afișa file-picker.
- **După captură:** încadrare automată și citire imediată, apoi verificare înainte de salvare. Păstrăm fișierul doar în memorie cât durează sesiunea și oferim reîncadrare/recitire dacă automatizarea nu ajunge. Intrarea veche cu încadrare manuală rămâne disponibilă pentru recuperare.
- **Acasă:** cele trei blocuri încap la 390 × 844 și 393 × 852, cu font implicit și fără tastatură. La 360 × 640, font mărit sau texte foarte lungi permitem scroll; nu tăiem conținutul și nu micșorăm zonele de atingere ca să forțăm criteriul.
- **Stoc:** „Gata de gătit” folosește cantități suficiente și conversii existente; cantitate necunoscută sau unitate incompatibilă nu confirmă acoperirea. Păstrăm excepțiile existente pentru sare, piper și apă și nu tratăm o rețetă fără ingrediente ca fiind gata. Ingredientele opționale urmează regulile existente din recipeNeeds.
- **Import:** propunere de limite: 10 MiB/fișier, 50 pagini PDF, 500 articole, 100.000 caractere de text. Preview editabil obligatoriu înainte de creare. Fără prețuri, cheltuieli sau produse bifate generate din import.
- **PDF scanat/parolat:** explicăm că nu am extras text și oferim lipire text/alt fișier. OCR pentru pagini PDF este extensie separată, nu o promisiune ascunsă în această etapă.
- **Bugete:** eliminarea cardurilor nu elimină accesul la editare, ștergere sau bugetele pe categorii/magazine. Editorul deschis prin creion găzduiește veniturile/alocarea și acces secundar la limitele existente. Când nu există buget, cardul gol are același creion funcțional pentru configurare.

## Review Focus

- Captură anulată/refuzată, revenire din cameră și selectarea aceleiași fotografii: fără OCR duplicat și fără pierderea contextului listei — etapa 3.
- Lista activă dispare, se arhivează sau se schimbă gospodăria: fără redirecționare spre date străine și fără buclă — etapa 1/6.
- Venituri și bugete existente, inclusiv zero surse și plafon depășit: rămân editabile după eliminarea cardului — etapa 2/7.
- Unități incompatibile, stoc insuficient și ingrediente lipsă: nu apar fals la „Gata de gătit” — etapa 5.
- Import întrerupt, fișier invalid și apăsare dublă: zero liste parțiale sau duplicate — etapa 8.

---

## Etapa 1 — Modelul acțiunilor și lista activă partajată

**Fișiere:** modifică `src/components/capture/model.ts`, `events.ts`, `capture-host.tsx`, `src/components/app/shell.tsx`; creează `src/lib/domain/active-shopping-list.ts`, `src/components/shopping/active-list-provider.tsx`; integrează providerul în layout/AppProvider după disponibilitatea gospodăriei. Teste în fișierele omoloage `.test.ts(x)`.

**Interfețe propuse:**
- `actionContext(pathname: string): "home" | "recipes" | "pantry" | "shopping" | "budget" | null`.
- Extinde `CaptureRequest` într-o uniune discriminată care păstrează `manual`, `scan`, `shopping` și adaugă `pantry`, `income`, `budget-edit`, `list-new`, `list-copy`, `list-import`.
- `selectActiveList(lists, preferredId: string | null): string | null`; intrările conțin id, disponibilitate, numărul nebifat și updated_at.
- `useActiveShoppingList(): { activeListId: string | null; selectList(id: string): void; ready: boolean }`.

- [ ] Scrie teste pentru matricea celor cinci tab-uri, query/trailing slash, editor fără FAB, lista detaliată cu context Cumpărături și evenimente vechi compatibile.
- [ ] Rulează testele și confirmă că noua matrice lipsește înainte de implementare.
- [ ] Implementează resolverul pur, selecția partajată și acțiunile tipizate; CaptureHost rămâne singurul proprietar al FAB-ului.
- [ ] Testează lista preferată arhivată/ștearsă, selecția deterministă, schimbarea gospodăriei și lipsa localStorage.
- [ ] Verifică un singur FAB în DOM, etichete contextuale și revenirea focusului; nu scoate încă butoanele a căror destinație nu este implementată.

**Livrabil:** infrastructură contextuală stabilă, fără funcționalități inaccesibile.

## Etapa 2 — Formulare reutilizabile înainte de eliminarea declanșatoarelor

**Fișiere:** `src/app/camara/page.tsx`, `src/components/budget/income-panel.tsx`, `src/app/buget/page.tsx`, `src/components/budget/expenses.tsx`; creează `src/components/pantry/pantry-item-sheet.tsx`, `src/components/budget/income-sheet.tsx`, `src/components/budget/budget-editor-sheet.tsx`.

**Interfețe:** formulare controlate `open`, `onClose`, contextul bugetului/produsului și callback de succes. IncomeSheet primește `budget: Budget | undefined` și `intent: "add" | "edit"`; BudgetEditorSheet păstrează distincția creare/editare și scope-urile existente. Formularul de adăugare venit nu trebuie să mai depindă de randarea cardului IncomePanel.

- [ ] Adaugă teste pentru deschidere din exterior, creare fără buget, adăugare venit la sursele existente și anulare fără scrieri.
- [ ] Rulează testele roșii, apoi extrage formularele păstrând serviciile `addPantryItem`, `createBudget`, `updateBudget` și validările existente.
- [ ] Mută formularul manual din CaptureHost într-o componentă dedicată dacă este necesar pentru a evita două implementări divergente; reutilizează fluxul existent, nu rescrie serviciul de cheltuieli.
- [ ] Verifică protecția la dublu submit, eroare la salvare fără închiderea formularului și numele accesibile ale câmpurilor.
- [ ] Rulează testele existente pentru cămară, venituri/alocare și cheltuieli înainte de eliminarea cardurilor.

**Livrabil:** formularele pot fi deschise de FAB sau creion independent de cardurile vechi.

## Etapa 3 — Cameră directă și Acasă compact

**Fișiere:** `capture-host.tsx`, `src/components/shopping/receipt-capture.tsx`, `src/components/home/home-screen.tsx`, `home-model.ts`, `use-meal-time.ts`; teste `capture-host.test.tsx`, `home-model.test.ts`, `e2e/bonuri.spec.ts`, `e2e/meal-time.spec.ts`, noul `e2e/contextual-actions.spec.ts`.

**Interfață:** `ReceiptCapture` primește opțional `initialFile: File` și `autoRead: boolean`, păstrând `initialListId`, `embedded`, `onSaved`. Fiecare selecție este consumată o singură dată. `selectHomeMeal(...)` returnează masa planificată pentru intervalul curent, altfel prima sugestie existentă, altfel empty state.

- [ ] Testează că opțiunea „Scanează bon” apelează inputul deja montat în handlerul click și nu deschide întâi un alt meniu/formular.
- [ ] Implementează handoff-ul File → încărcare/orientare → încadrare automată → OCR/Gemini → verificare. Reutilizează `loadImage`, `proposeCrop`, `readWithFallback`; nu crea un al doilea motor OCR.
- [ ] Testează anulare cameră, fișier invalid, recitire cu încadrare manuală, offline și context listId. Resetează inputul pentru alegerea aceleiași fotografii; eliberează Blob URL/bitmap la sfârșit.
- [ ] Compactează „Azi la masă” la o singură recomandare; păstrează Alege și accesul la alternative/Plan. Păstrează selectarea porțiilor și scăderea stocului numai la confirmare.
- [ ] Scoate din cardul Bugetul lunii cele două butoane duplicate, păstrând suma, progresul, disponibilul zilnic, ultima tranzacție și Istoric.
- [ ] Verifică prin bounding boxes cele trei blocuri la viewporturile convenite, plus font mărit/360 px fără overflow și fără suprapunere cu FAB/nav. Camera nativă necesită verificare manuală pe Android și iPhone; simularea Playwright nu o dovedește.

**Livrabil:** Acasă cu meniu universal doar aici și intrare directă în captură.

## Etapa 4 — Cămară cu formular esențial

**Fișiere:** `src/app/camara/page.tsx`, `src/components/pantry/pantry-item-sheet.tsx`, `capture-host.tsx`; teste `src/app/camara/page.test.tsx` și `e2e/contextual-actions.spec.ts`.

- [ ] Testează că FAB-ul deschide direct Nume, Cantitate, Unitate, Locație și că nu există un submeniu de alegere.
- [ ] Folosește ProductSearch și serviciul existent; detaliile opționale stau într-un `<details>` pliat implicit. Reutilizează brand/variant picker numai pentru câmpurile realmente suportate de model, fără a inventa stocarea unui preț în PantryItem.
- [ ] Păstrează data expirării, nota și setările existente în zona opțională; editarea unui produs existent nu șterge valori ascunse.
- [ ] Elimină declanșatorul superior, apoi verifică adăugarea offline, produs personalizat și editarea stocului existent.

**Livrabil:** o singură intrare principală și formular scurt, cu toate datele vechi păstrate.

## Etapa 5 — Rețete și filtrul strict „Gata de gătit”

**Fișiere:** `src/app/retete/page.tsx`, `src/lib/domain/recipe-filters.ts`, `recipes.ts`, `src/components/recipes/recipe-photo.tsx`, `recipe-visual.tsx`, `capture-host.tsx`; testele de domeniu existente și `e2e/retete-camara.spec.ts`.

**Interfețe:** extinde `RecipeFilters` cu `readyOnly?: boolean` și contextul cu `readyRecipeIds: Set<string>`. Acest filtru este independent de categoria mesei, nu o categorie nouă care exclude categoriile existente. Calculul reutilizează `whatCanICook` și `missing.length === 0`.

- [ ] Testează rețetă complet acoperită, ingredient insuficient, 500 g versus 1 kg, unitate incompatibilă, cantitate necunoscută, ingrediente opționale, excepțiile pentru baze și rețetă fără ingrediente.
- [ ] Rulează testele roșii, implementează filtrul și afișează chip-ul imediat după Toate, cu `aria-pressed`; permite combinarea cu căutare/categorie/favorite.
- [ ] Mută Adaugă rețetă și Importă în sheet-ul FAB „Rețete”; elimină cele două butoane din header.
- [ ] Verifică miniaturile existente pentru fotografie catalog/gospodărie și absența fotografiei. Păstrează lazy în listă și prioritatea fotografiei principale pe detaliu.
- [ ] Păstrează un singur contor derivat din date, fără valoarea 190 hardcodată. La filtrare, contorul unic poate afișa „X din Y rețete”.
- [ ] E2E: adăugarea/consumarea unui ingredient în cămară actualizează filtrul, inclusiv offline.

**Livrabil:** acces contextual la creare/import și filtru care nu promite ingrediente inexistente.

## Etapa 6 — Cumpărături: deschidere directă, listă nouă și copiere

**Fișiere:** `src/app/cumparaturi/page.tsx`, `lista/page.tsx`, `istoric/page.tsx`, `src/lib/services/shopping.ts`, `capture-host.tsx`; creează `src/components/shopping/list-actions-sheet.tsx`, `list-switcher.tsx`; teste servicii și `e2e/cumparaturi.spec.ts`.

**Interfețe:** `copyShoppingSource(ctx, source: { kind: "list" | "transaction"; id: string }, name: string): Promise<string>`. Pentru istoric se folosesc liniile tranzacției salvate, nu conținutul curent al unei liste recurente schimbate între timp.

- [ ] Testează redirecționarea numai după încărcarea datelor, selecția din dropdown și revenirea fără bucle. Consumă mai întâi intențiile URL existente, precum `?nou=1`, înainte de redirect.
- [ ] Creează lista cu nume datat din clock-ul aplicației; deschide imediat `/cumparaturi/lista/?id=...`, unde titlul este editabil inline. Protejează clickul dublu și numele gol.
- [ ] Implementează copierea listei/arhivei/tranzacției într-o operație atomică; verifică gospodăria, resetează bife, datele bifării și prețurile plătite. Nu copia ajustări sintetice de buget sau cheltuieli manuale ca produse.
- [ ] Testează copierea unei liste recurente și a unei tranzacții vechi după modificarea listei-sursă, erori la mijloc fără listă parțială și sursă inaccesibilă.
- [ ] Elimină butoanele de creare din header/empty state; meniul contextual oferă exact Listă nouă, Copiază o listă mai veche, Importă listă.
- [ ] Actualizează `e2e/helpers.ts:createList` și suitele dependente să treacă prin FAB, fără a păstra artificial butoanele vechi pentru teste.

**Livrabil:** listă activă comună Acasă/FAB/tab și copiere fără pierderea istoricului.

## Etapa 7 — Buget compact și verificarea mediei

**Fișiere:** `src/app/buget/page.tsx`, `src/components/budget/income-panel.tsx`, `income-sheet.tsx`, `budget-editor-sheet.tsx`, `src/lib/domain/budget.ts`, `src/lib/services/queries.ts`; teste `budget.test.ts`, serviciile de integritate și `e2e/income-allocation.spec.ts`, `family-budget.spec.ts`.

- [ ] Adaugă fixture de regresie cu 2 bonuri de 100 și 50 RON, mai multe produse pe fiecare, plus cheltuială manuală de 40 RON: media cumpărăturilor trebuie să fie 75 RON, nu media produselor și nici 95 RON.
- [ ] Urmărește traseul householdSpendRecords → shoppingSpend → averageTrip. Dacă testul trece deja, nu modifica formula; verifică identificatorii tranzacțiilor, ajustările după totalul declarat, filtrul lunii și excluderea cumpărăturilor în curs.
- [ ] Testează bon fără prețuri, tranzacție ștearsă, total declarat fără linii, mai multe categorii pe același bon și lună fără cumpărături: fără dublă numărare și fără NaN.
- [ ] Leagă FAB „Buget” numai la Adaugă cheltuială și Adaugă venit. Nu înlocui veniturile cu o simplă cheltuială negativă.
- [ ] Leagă creionul cardului la editorul veniturilor/alocării/plafonului, inclusiv dacă bugetul nu există. Păstrează acces secundar la limitele pe categorii/magazine și ștergerea lor.
- [ ] Elimină IncomePanel vizual, declanșatoarele superioare și textul duplicat „Mai ai…”. Nu șterge datele sau serviciile aferente.
- [ ] Verifică lună trecută/curentă, migrarea deja suportată de la scope total la familie, zero venituri și alocare peste venituri; păstrează semantica existentă a veniturilor recurente.

**Livrabil:** buget simplificat, toate funcțiile accesibile și media susținută de un test reproductibil.

## Etapa 8 — Import liste TXT, MD, CSV, text și PDF cu text

**Fișiere noi:** `src/lib/domain/shopping-import.ts`, `.test.ts`, `src/lib/services/shopping-import.ts`, `.test.ts`, `src/components/shopping/import-list-sheet.tsx`, `src/lib/import/pdf-text.ts`, workerul PDF dacă pachetul îl necesită. Modifică `package.json`, lockfile și politica service-worker numai cât cere integrarea PDF. Nu adăuga un route handler incompatibil cu exportul static.

**Interfețe propuse:**
- `ImportedShoppingLine = { sourceLine: number; name: string; quantity: number | null; unit: UnitCode | null; warning?: string }`.
- `parseShoppingImport(text: string, format: "text" | "csv"): { items: ImportedShoppingLine[]; warnings: string[] }`.
- `extractPdfText(file: File): Promise<string>`; returnează text simplu și eliberează documentul/workerul inclusiv la eroare/anulare.
- `importShoppingList(ctx, input: { name: string; items: ImportedShoppingLine[] }): Promise<string>`.

- [ ] Testează `- 2 kg cartofi`, `* lapte 1,5 l`, checkbox Markdown, numerotare, CRLF, BOM, diacritice, linii goale și produs fără cantitate. Reutilizează parseQuickAdd; nu interpreta orice virgulă ca separator de produse.
- [ ] Pentru CSV, definește antetele `produs,cantitate,unitate` și separator virgulă sau punct și virgulă; respectă ghilimele și zecimale românești. Fără antet recunoscut oferă eroare clară/preview corectabil, nu ghicește coloane de preț.
- [ ] Testează PDF cu text, fără text, parolat, corupt, prea mare și prea multe pagini. Pin-uiește o versiune pdfjs-dist compatibilă verificată la implementare; worker local, import dinamic, fără CDN și fără executarea codului/atașamentelor din document. Păstrează delimitarea rândurilor; nu concatena orbește textul din coloane.
- [ ] Implementează preview editabil cu selectare/excludere rânduri, denumire listă și total articole. Parsarea nu scrie în Dexie și nu creează produse de catalog automat.
- [ ] Salvează lista, articolele și outbox atomic; include în tranzacția Dexie toate tabelele citite de serviciile reutilizate. Pregătește textul/PDF în afara tranzacției, fără await de rețea sau OCR în interior.
- [ ] Testează eșec la un rând, dublu submit, gospodărie schimbată în timpul preview-ului și anulare: fără import parțial sau în gospodăria greșită. Cantitățile rămân null când lipsesc; nu se inventează 1 bucată.
- [ ] E2E pentru fiecare format acceptat și pentru import după activarea modului offline. Resursele PDF trebuie să fie în cache înainte de promisiunea de offline; testează și eroarea explicată când resursa nu este încă disponibilă.

**Livrabil:** import local verificabil, cu dependența PDF limitată la momentul folosirii. OCR pentru PDF-uri scanate rămâne în afara acestei versiuni și este comunicat explicit.

## Etapa 9 — Integrare, verificare și pregătirea livrării

- [ ] Rulează `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` și întregul `npm run test:e2e`; Chromium disponibil se poate folosi prin configurația locală documentată de onboarding.
- [ ] Rulează `npm run test:e2e:cloud` cu backend local configurat pentru a verifica izolare, sincronizare și lipsa duplicatelor. Dacă infrastructura lipsește, raportează separat verificările nerulate; nu le declara trecute.
- [ ] Verifică vizual fiecare tab în ambele teme, fără listă/stoc/buget, cu date reale lungi, tastatură deschisă și text mărit. Capturile se fac pe zonele schimbate pentru comparație.
- [ ] Verificare manuală Android/iPhone: cameră directă, anulare, aceeași fotografie, EXIF, revenire în aplicație, tastatură, focus și navigare în PWA instalată. Nu echivala emularea Pixel din Chromium cu un telefon real.
- [ ] Confirmă că acțiunile eliminate au înlocuitor accesibil pe mobil și desktop; nu rămân evenimente fără consumator sau dialoguri suprapuse.
- [ ] Revizuiește diff-ul și actualizează documentația fluxurilor. Commit/PR separat pe etapă, fără merge/deploy implicit și fără includerea modificărilor anterioare fără delimitare.

## Ordine, dependențe și efort orientativ

| Pachet | Dependențe | Efort orientativ |
|---|---|---|
| Model contextual + selecție listă | niciuna | mediu |
| Extragere formulare | modelul de acțiuni | mediu |
| Cameră directă + Acasă | 1–2 | mediu, cu verificare pe dispozitive |
| Cămară și Rețete | 1–2 | mediu |
| Cumpărături și copiere | lista activă din 1 | mediu |
| Buget | formularele din 2 | mediu; defectul mediei trebuie reprodus |
| Import text/CSV | Cumpărături | mediu |
| PDF cu text | import + worker/cache | mediu–mare |
| Validare completă | toate | mediu |

Recomand livrare în trei loturi: **A: FAB + formulare + Acasă + Cămară/Rețete; B: Cumpărături + Buget; C: import text/CSV, apoi PDF**. Aceste loturi păstrează ordinea UX din brief, dar separă riscul parserului/PDF de refactorizarea navigării. Nu sunt estimări calendaristice ferme; nu am început implementarea.

## Decizii pentru revizia planului

1. PDF cu text local este varianta recomandată; suportul pentru PDF scanat cere extindere separată.
2. Criteriul fără scroll are viewporturi și condiții explicite, nu este universal pentru orice ecran/font.
3. „Gata de gătit” păstrează excepțiile actuale sare/piper/apă; o politică literală pentru absolut toate ingredientele ar cere schimbarea acestei decizii.
4. Limitele importului și etichetele suplimentare sunt propuneri, nu cerințe pretins preluate din brief.
5. Media se modifică numai după identificarea unei erori reale; formula actuală deja folosește tranzacții.


## Stare după lotul 1

Lotul A/1 este implementat local: model contextual, selecția comună a listei, formularul de adăugare în Cămară, camera directă, Acasă compact și Rețete cu disponibilitate strictă. Formularele avansate de Buget și restructurarea Cumpărăturilor rămân lotului 2; importul rămâne lotului 3. Pașii originali de mai sus sunt păstrați ca plan complet, nu bifați global pentru funcții încă nelivrate.

Rezultatele, limitele, deciziile și comenzile efectiv verificate sunt în `docs/implementation/2026-11-17-lot1-contextual-actions.md`.
