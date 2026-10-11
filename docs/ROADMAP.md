# Ce urmează

Ordinea o decide proprietarul. Lista de mai jos e ce a rămas în afara versiunii 0.1.

## Înainte de prima publicare
- ~~Aprobarea textelor de rețete și din catalog (`src/data`)~~: aprobate de proprietar, 11 oct. 2026.
- Crearea proiectului Supabase și a celui Vercel de către proprietar ([DEPLOYMENT.md](DEPLOYMENT.md)).
- Verificarea criteriilor de acceptanță în [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## După
- **Notificări push de pe server** (ex. alimente care expiră, cu aplicația închisă). Cer chei VAPID și o funcție pe server. Acum există doar notificări locale, cât aplicația e deschisă.
- **Importul copiei de siguranță** (fișierul JSON exportat din aplicație).
- **Fotografii pentru rețete**. Acum: o ilustrație pe categorie; câmpul `image_url` există.
- **Valori nutriționale**, dintr-o sursă verificată (acum `null`, nu se inventează).
- **Prețuri din cataloagele magazinelor**: doar prin surse permise (parteneriate, fișiere publice); scraping-ul nu se face. Acum: import CSV controlat și introducere manuală.
- **Realtime în E2E-ul local**: testul cloud acoperă acum sincronizarea la cerere, nu notificările Realtime.
