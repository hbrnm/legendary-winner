# Demo public și emblemă Ritm

Obiectiv autorizat: utilizatorii pot încerca aplicația fără cont înainte de înregistrare; emblemă nouă aliniată cu Ritm; publicare în producție prin GitHub solicitată explicit.

- [x] Selecție explicită demo/cloud în browser, înainte de pornirea autentificării/sincronizării. Preferință locală, parametri demo=1/demo=0 pentru intrare/ieșire prin navigare completă.
- [x] Baza camara-demo rămâne separată de bazele conturilor. Nu se importă automat date demo în cont. Sesiunile conturilor nu sunt șterse.
- [x] CTA proeminent „Încearcă fără cont” deasupra formularului existent; banner demo cu revenire la cont, date păstrate local. Invitațiile reale nu sunt apelate în demo.
- [x] Emblemă originală generată: borcan/C în caisă, capac lavandă, fundal grafit; exporturi192/512/180, favicon și înlocuirea simbolului vechi în interfață.
- [x] Teste unitare pentru selecție/persistență/izolare, integrarea providerului cu Supabase configurat și browser pe o configurație cloud locală fără servicii reale.
- [ ] Verificări, revizie independentă și publicare prin PR/main, fără migrații sau modificări ale bazei de producție.

Decizie: păstrăm formularul de autentificare accesibil și adăugăm intrarea demo înaintea lui, fără un pas suplimentar pentru cei care au cont. Folosim motorul și datele demonstrative existente; numerele vin din datele locale. Datele demo se păstrează la revenire, până la ștergerea datelor site-ului; ieșirea din demo nu le șterge.

CI are deja pe main un eșec test:db la protecția invitațiilor, documentat în PR115. Nu modificăm protecțiile DB pentru această etapă.

Verificări: 671 teste unitare trecute; build static și lint trecute; 2 scenarii browser trecute pe build cu Supabase configurat (fără cont real). Revizia independentă a verificat izolarea demo/cloud; regresiile pentru autentificare în demo și schimbarea preferinței între taburi sunt acoperite. Selecția modului rămâne fixă pe durata providerului. Linkurile din email ies explicit din demo.

Verificări finale locale: npm test — 671/671; npm run lint, npm run typecheck și npm run build — reușite; suita e2e standard — 71/71; scenariile demo cu cloud configurat — 2/2. Publicarea urmează prin PR/main.
