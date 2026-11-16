# Bugetul familiei — introducere manuală

Din **Buget → Adaugă cheltuială**, înregistrezi o plată cu descriere, sumă în lei, data plății și categorie. Școala copiilor, hainele, transportul, locuința, sănătatea și celelalte categorii sunt disponibile direct. Plățile pot fi modificate și șterse cu confirmare. Data este cea a unei plăți deja făcute, nu o programare pentru viitor.

În formularul de buget:
- **Toate cheltuielile familiei** adună cumpărăturile și plățile introduse manual.
- **O categorie de cheltuieli** urmărește aceeași categorie atât pentru manuale, cât și pentru cumpărăturile încadrate acolo.
- Scopurile existente pentru cumpărături, alimente, produse, surse și magazine continuă să includă doar cumpărături. Bugetele deja salvate nu se convertesc automat în bugete ale familiei.

Produsele alimentare sunt grupate la Alimentație; igiena și curățenia la Îngrijire personală și curățenie; celelalte produse la Alte cheltuieli. Categoriile produselor rămân disponibile separat în raport. O plată manuală nu generează produse în cămară, prețuri sau ture de cumpărături. Dacă ai înregistrat deja o cumpărătură pe listă/bon, nu o adăuga și ca plată manuală.

Selectorul lunii schimbă totalul, graficul și lista plăților manuale. Poți modifica și o plată mai veche. Bugetele active afișează perioada lor curentă. Exportul CSV include plățile manuale și distinge tipul înregistrării; media unei ieșiri și împărțirea pe magazine folosesc numai cumpărături.

Datele sunt ale gospodăriei. Se salvează offline, se sincronizează între membri și intră în copia de siguranță. Cheltuielile recurente nu sunt incluse în această versiune.

## Activare în cloud

Migrația `supabase/migrations/20261116000001_family_budget.sql` creează tabela `manual_expenses`, regulile RLS, triggerele și scopurile suplimentare ale bugetelor. Nu modifică sau convertește cumpărăturile existente și nu introduce prețuri/date de exemplu în cloud.

Migrația trebuie verificată și aplicată înainte de activarea funcției în cloud. Codul nou ascunde controalele pentru un server încă nemigrat; datele noi importate local așteaptă în coadă până când serverul acceptă tabela și scopurile. În demo, funcția este disponibilă imediat. Publicarea și comenzile pe producție necesită acord explicit separat.

Pentru lansare sunt incluse și două migrații de corecție ale problemelor preexistente dezvăluite de suita RLS:

- `20261116000002_invitation_acceptance.sql`: permite acceptarea prin funcția autorizată, păstrând interdicția de a falsifica acceptarea sau de a modifica rolul/expirarea prin UPDATE direct; elimină accesul RPC la funcția de trigger.
- `20261116000003_delete_account_alias.sql`: corectează coliziunea dintre o variabilă și un alias SQL în funcția existentă de ștergere a contului, fără schimbarea regulilor sau a predicatelor de ștergere. Migrația definește funcția; nu șterge conturi.

Suita completă de bază de date trece acum 70/70 pe Postgres temporar local. La lansare se citesc întâi istoricul și definițiile din proiectul Camara și se aplică numai migrațiile lipsă. Nu se reexecută migrațiile deja aplicate și nu se reîncarcă seed-ul.
