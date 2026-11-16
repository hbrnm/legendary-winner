# Bugetul familiei — cheltuieli manuale

Utilizatorul a aprobat propunerea din conversație și varianta 1: introducerea manuală a cheltuielilor, cu sumă, dată, categorie și descriere; bugete lunare, cheltuit și rămas, împreună cu cumpărăturile existente fără dublare.

Categorii aprobate: Alimentație; Școala și educația copiilor; Haine și încălțăminte; Transport și mașină; Locuință și utilități; Sănătate; Îngrijire personală și curățenie; Activități, sport și divertisment; Vacanțe; Abonamente și servicii; Cadouri și evenimente; Alte cheltuieli.

Varianta aleasă este introducerea manuală. Cheltuielile recurente nu intră în această versiune. Nu adăugăm venituri, conturi bancare, rate sau planificarea plăților viitoare.

Plățile manuale au o tabelă proprie, cu gospodărie, descriere, sumă pozitivă în RON, categorie fixă și data plății. Pot fi modificate și șterse logic. Nu produc produse, prețuri sau intrări în cămară. Serviciile verifică gospodăria activă, data reală și suma cu cel mult două zecimale.

Bugetul familiei și categoriile de cheltuieli includ plățile manuale și cumpărăturile relevante. Produsele alimentare intră la Alimentație, igiena/curățenia la Îngrijire personală și curățenie, restul cumpărăturilor la Alte cheltuieli. Bugetele existente pentru cumpărături și rapoartele de magazine/ieșiri continuă să folosească doar cumpărături. Graficele generale, exportul și indicatorul bugetului familiei de pe Acasă folosesc totalul combinat.

Decizii de implementare: categorii fixe în cod (nu modificăm catalogul produselor); tabelă sincronizată `manual_expenses`; două scopuri suplimentare de buget `familie` și `cheltuiala`. Această variantă separă plățile precum școala/utilitățile de produsele de pe bonuri, păstrând calculul existent al cumpărăturilor.

Păstrăm funcționarea offline, copiile de siguranță, sincronizarea și RLS pe gospodărie. O migrație nouă pregătește serverul; nu executăm comenzi pe producție. Controalele noi sunt disponibile în demo și în cloud după confirmarea migrării. Datele locale așteaptă serverul dacă migrația lipsește.

Verificare: calcule mixte fără dublare, CRUD/validare/izolare, backup, sincronizare, RLS pe Postgres, flux mobil de adăugare/modificare/ștergere, bugete și export. Limitarea Turbopack a mediului se raportează separat; configurația de producție nu se schimbă pentru QA.
