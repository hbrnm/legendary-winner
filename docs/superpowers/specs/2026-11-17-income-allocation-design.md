# Venituri lunare și buget alocat

În Buget, gospodăria poate înregistra surse lunare recurente cu nume și sumă: salariu soț, salariu soție, alte venituri. Sursele pot fi adăugate, modificate și eliminate; totalul se recalculează imediat.

Plafonul pentru cheltuieli rămâne ales separat. Exemplu: venituri 3.000 + 2.000 = 5.000 lei; plafon 4.000 lei; nealocat 1.000 lei. Dacă plafonul depășește veniturile, afișăm diferența clar, fără a împiedica salvarea. Nu numim suma nealocată „economii” deoarece nu este un transfer confirmat.

## Abordare

Au fost discutate două variante: totalul veniturilor devine automat plafonul, sau plafonul se alege separat. Utilizatorul a ales a doua variantă. Veniturile nu sunt tranzacții și nu se adaugă la cheltuieli. Prima versiune folosește surse lunare recurente, nu un registru al încasărilor pe date.

În aplicația existentă păstrăm bugetele pe categorii și plafonul folosit pe Acasă. Datele surselor se salvează pe bugetul lunar al familiei, cu aceleași reguli de acces și sincronizare; nu sunt necesare conturi bancare, roluri noi sau date de autentificare. Introducerea veniturilor și alegerea plafonului se salvează împreună, fără dublarea bugetelor existente.

Butonul Salvează din editarea bugetului trebuie să rămână vizibil și utilizabil pe telefon, inclusiv cu tastatura deschisă; erorile de sumă se afișează lângă câmp. Verificăm modificarea, persistența după reîncărcare și sincronizarea.
