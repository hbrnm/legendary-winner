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

Nu s-au executat comenzi pe producție. În testarea pe schema din repository, migrația mai veche `20261101000002_invitations_update.sql` blochează `accept_invitation`: triggerul refuză actualizarea câmpurilor `accepted_at`/`accepted_by` chiar și din funcția de acceptare. Aceasta blochează pregătirea suitelor `rls.test.ts`, `product-variants.test.ts`, `receipt-aliases.test.ts` și `recipe-photos.test.ts`, inclusiv fără migrația bugetului (confirmat pe schema inițială). Testele RLS noi pentru cheltuieli folosesc apartenență pregătită direct în fixture și trec. Problema invitațiilor trebuie rezolvată separat înainte de a considera întregul lanț de migrații verificat pentru lansare.
