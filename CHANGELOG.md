# Istoricul versiunilor

## Nepublicat
### Adăugat
- „Compară magazinele”: cât ar costa produsele nebifate din listă la fiecare magazin, doar cu prețurile de acolo (#17).
- Densități aprobate pentru zahăr, făină și griș: lingurile din rețete devin grame pe listă, în cămară și în cost; migrația `20261012000002_grams_per_ml`.

## 0.1.1 — 12 oct. 2026
Stabilizare: corectitudinea estimărilor și a datelor ([docs/AUDIT_0.1.1.md](docs/AUDIT_0.1.1.md)).

### Reparat
- Estimarea unei linii din listă folosește prețul din magazinul ei, apoi din aceeași sursă („alt magazin”). Prețurile de la piață nu mai estimează un coș de supermarket. Promoțiile intră doar dacă nu există alt preț și sunt marcate. Prețurile mai vechi de 90 de zile sunt marcate „preț vechi”. Fișa produsului spune de unde vine estimarea (#13).
- Pe Buget, numărul produselor fără preț din listele deschise nu mai poate fi greșit sau negativ (#14).
- Rețetele cer legume la bucată, iar produsele se vând la kg. Acum lista pune cantitatea corectă (10 cepe → 1,5 kg, nu 1 kg), cămara le scade, iar costul le include. Greutățile aproximative pe bucată sunt aprobate de proprietar; migrația `20261012000001_piece_grams` (#16).

### Teste și documentație
- Sincronizarea întreruptă între pagini se reia fără pierderi (#12).
- Auditul 0.1.1, starea reală a criteriilor, migrațiile din producție, roadmap-ul 0.2.0 (#15).

## 0.1.0 — 11 oct. 2026
Prima versiune completă, publicată la https://appcamara.vercel.app (Vercel, cu proiectul Supabase „Camara”).

### Securitate
- Funcțiile din baza de date nu mai pot fi chemate fără cont. Funcțiile de trigger nu mai pot fi chemate direct de nimeni. Toate funcțiile au `search_path` fix (migrația `20261011000002_harden_functions`).

### Adăugat
- Liste de cumpărături comune: adăugare rapidă cu cantitate, grupare pe raioane și magazine, bifare, prețul plătit, finalizarea turei, istoric, liste recurente, duplicare, arhivare, ștergere cu anulare.
- Rețete: 86 în catalog, rețete proprii, porții, ingrediente în listă, favorite, „am gătit” (scade din cămară).
- Planul săptămânii: mese pe zile, copierea săptămânii, lista generată din plan.
- Buget: bugete pe total, sursă, categorie sau magazin; cheltuiala reală fără dublă numărare; produsele fără preț arătate separat.
- Prețuri introduse de gospodărie (plătite, văzute, promoții) și comparație între magazine și piețe.
- Cămara: locuri de depozitare, expirare, „ce pot găti”.
- Gospodării cu membri și roluri, invitații prin link, transferul proprietății.
- Catalog: 471 de produse, 20 de categorii, 13 magazine; administrare și import CSV pentru administratorii aplicației.
- Local-first (IndexedDB) cu sincronizare Supabase; PWA instalabilă, funcționează fără internet; mod demonstrativ fără Supabase.
- Copie de siguranță a datelor gospodăriei (fișier JSON) și importul ei („Încarcă o copie”). Importul nu șterge nimic: adaugă ce lipsește și păstrează modificările mai noi de pe dispozitiv.
- Teste: unitare și de servicii, RLS pe Postgres real, E2E demonstrativ și E2E cu Supabase local.

### Reparat (înainte de prima publicare)
- Aplicația rămânea în „Se încarcă” când nu exista o sesiune.
- Enter în căutarea de produse, apăsat înainte să se încarce catalogul, adăuga textul ca produs nou (dublură).
