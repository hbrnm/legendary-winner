# Verificarea reorganizării Cămara

Implementarea urmează specificația aprobată și păstrează numele real al gospodăriei, identitatea Cămara și cele 12 categorii de cheltuieli.

## Comportamente verificate

- „Am plătit” păstrează produsele nebifate, pregătește listele recurente, adaugă stocul cunoscut și înregistrează o singură cheltuială.
- Totalul declarat este separat de prețurile produselor. Diferența apare la Nealocat; cantitățile și prețurile unitare necunoscute nu sunt inventate.
- Scanarea reconciliază denumirile libere și aliasurile compatibile, păstrează variantele alese, salvează atomic și protejează reluarea aceleiași trimiteri.
- Revenirea de la scanarea unei liste la introducerea manuală deschide plata listei, fără cheltuială manuală suplimentară.
- „Am gătit” și „S-a terminat → Pe listă” actualizează atomic stocul și outbox-ul; stocul nu devine negativ.
- Captura și editarea păstrează locul, magazinul, sursa, categoria, data și nota. Filtrele de rețete se combină; De post este explicit.
- Datele vechi, backupurile, gospodăriile separate, totalurile peste limita lunii, lipsa internetului, tastatura, dialogurile imbricate și contrastul au teste de regresie.

## Dovezi

- `npm test`: 758 teste în 73 fișiere, toate trecute.
- `npm run test:db`: 72 teste PostgreSQL, inclusiv migrații și RLS, toate trecute.
- `npm run lint`, `npm run typecheck`: verificate fără erori.
- Build static: 25 pagini exportate. Turbopack este blocat de portul intern în mediul Codex; verificarea locală folosește același compilator Tailwind și Next Webpack. Configurația și sursa CSS de producție sunt păstrate.
- Scenariile browser sunt în `e2e/`, inclusiv `household-ia.spec.ts`. 76 scenarii verificate: 75 au trecut în rularea completă; verificarea la 600 px a primit temporar 404 în timpul înlocuirii buildului și a trecut apoi pe artefactele stabile (1/1), fără modificarea aplicației.
- Capturi demonstrative: `docs/previews/household-ia/`.

## Revizie și decizii

O revizie independentă a găsit patru probleme importante: contabilizare peste limita lunii, dublarea rândurilor libere la scanare, lipsa atomicității/protecției la retrimiterea bonului și metadate manuale needitabile. Toate au corecturi și teste de regresie observate întâi eșuate, apoi trecute.

Totalurile sunt proiectate la data finalizării cumpărăturii pentru a corespunde istoricului; data observației de preț rămâne păstrată. Textul verde este puțin mai închis decât accentul salvie pentru contrast. Produsele fără cantitate/unitate sunt păstrate în tranzacție și semnalate pentru completarea stocului; nu intră automat în cămară. Un produs liber fără aceste date devine produs propriu când sunt completate datele necesare. Linkul unui bon finalizat deschide registrul general, unde detaliile rămân accesibile.

## Lansare

Aplicați înaintea noii interfețe migrațiile `20261117000001_household_capture.sql` și `20261117000002_recipe_post.sql`. Pe serverele fără coloanele noi, sincronizarea păstrează scrierile locale în așteptare. Nu ștergeți outbox-ul pentru a depăși această stare.

PR-ul și verificările locale nu reprezintă aplicarea migrațiilor sau lansarea în producție. Autentificarea Google este în afara acestui PR.
