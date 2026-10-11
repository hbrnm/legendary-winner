# Istoricul versiunilor

## 0.1.0 — nepublicată (ramura `claude/camara-v1`)
Prima versiune completă.

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
- Copie de siguranță a datelor gospodăriei (fișier JSON).
- Teste: unitare și de servicii, RLS pe Postgres real, E2E demonstrativ și E2E cu Supabase local.

### Reparat (înainte de prima publicare)
- Aplicația rămânea în „Se încarcă” când nu exista o sesiune.
- Enter în căutarea de produse, apăsat înainte să se încarce catalogul, adăuga textul ca produs nou (dublură).
