# Ce urmează

Ordinea o decide proprietarul. Stările: **implementat** (în `main`), **verificat local** (teste unitare și E2E demonstrativ), **verificat pe Supabase local** (`test:db`, `test:e2e:cloud`), **verificat în producție**, **planificat**, **blocat** (de o decizie a proprietarului).

## 0.1.0 — publicată (11 oct. 2026)
- Prima publicare: Supabase „Camara” și Vercel (https://appcamara.vercel.app). Verificat în producție: criteriile 1, 3, 20 și 21 ([IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)).
- Textele rețetelor și ale catalogului au fost aprobate de proprietar pe 11 oct. 2026.
- Sincronizarea fără redescărcare (PR #9, #10): verificată în producție, cu 0 rânduri de catalog la o sincronizare fără schimbări.
- iPhone fără zoom și fără derulare orizontală (PR #7): verificat local (`e2e/responsive.spec.ts`).

## 0.1.1 — stabilizare (vezi [AUDIT_0.1.1.md](AUDIT_0.1.1.md))
| Ce | Stare |
| --- | --- |
| Testul de reluare a sincronizării întrerupte (PR #12) | implementat |
| Prețuri după magazin și sursă, promoții și prețuri vechi marcate (PR #13) | implementat |
| Numărul produselor fără preț din Buget (PR #14) | implementat |
| Greutatea pe bucată: listă, cămară, cost (`.tasks/004`, PR #16) | implementat; migrația și valorile aplicate în producție |
| Observațiile editoriale din rețete | blocat: aprobarea proprietarului |

## 0.2.0 — propuneri, după valoarea pentru utilizator și complexitate
Stare (16 oct. 2026): comparația pe magazine e implementată (PR #17); fotografiile rețetelor sunt gata: în producție, cu 28 de imagini AI în catalog, verificate pe telefoane ([.tasks/008](../.tasks/008-fotografii-retete.md)). În lucru: importul rețetelor ([.tasks/009](../.tasks/009-import-retete.md)), etapa 1 gata. Cu planul gata: prețurile din bonurile fiscale, cu OCR pe telefon ([.tasks/005](../.tasks/005-bonuri-fiscale.md)), și variantele comerciale ([.tasks/007](../.tasks/007-variante-comerciale.md)). Monitorul Prețurilor: oprit de proprietar (12 oct. 2026), după proba din [.tasks/006](../.tasks/006-monitorul-preturilor.md). Urmează: Open Prices.

1. **Variante comerciale** (ambalaj, brand, EAN), apoi prețul pe kg din ambalaj ([AUDIT_0.1.1.md](AUDIT_0.1.1.md), secțiunea 4). Valoare mare, complexitate medie. Planificat (decizii 12 oct. 2026): [.tasks/007](../.tasks/007-variante-comerciale.md).
2. ~~**Comparația pe magazine a unei liste întregi**~~: implementată (PR #17).
3. ~~**Densități pentru lingurile de zahăr și făină**~~: implementate (PR #19).
4. **Realtime în E2E-ul local**: testul cloud acoperă acum sincronizarea la cerere, nu notificările Realtime. Valoare medie (încredere), complexitate medie.
5. **Notificări push de pe server** (alimente care expiră, cu aplicația închisă). Cer chei VAPID și o funcție pe server. Acum există doar notificări locale. Valoare medie, complexitate mare.
6. **Prețuri din cataloagele magazinelor**, doar din surse permise (parteneriate, fișiere publice, Open Food Facts pentru produse, nu pentru prețuri). Fără scraping. Valoare mare, complexitate mare și dependentă de parteneri.
7. ~~**Fotografii pentru rețete**~~: implementate ([.tasks/008](../.tasks/008-fotografii-retete.md)). Rămân **valori nutriționale** dintr-o sursă verificată (acum `null`). Valoare medie, cer surse și drepturi.
