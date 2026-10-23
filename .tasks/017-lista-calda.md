# 017 — Lista de cumpărături mai caldă („carnețelul de pe frigider”)

**Stare:** în lucru — etapele 1–2 gata, urmează etapa 3
**Ramuri:** câte una pe etapă, din `main` (`claude/017-...`).

## Scop
Cererea proprietarului din 23 oct. 2026: secțiunea Cumpărături să sune și să arate ca un carnețel al casei, nu ca o unealtă de productivitate. Proprietarul a aprobat ordinea propusă (23 oct. 2026): întâi textele, apoi bifa și „În coș”, apoi culorile și iconițele, la final fontul de mână și căutarea jos. Doar prezentare: fără schimbări de schemă, date, sincronizare sau calcule.

## Reguli de ton
- Verbe de bucătărie („Pune deoparte”, „Fă o copie”, „Gata”), nu de birou.
- Persoana I când aplicația face ceva („Am pus”, „Am șters”).
- Ce lipsește, ca întrebare („preț?”), nu ca stare („fără preț”).
- Fără diminutive în serie, fără glume la bani sau la erori; banii, calm, fără vină.
- Bugetul e lunar sau săptămânal (`budget.period`): textul spune „luna asta” / „săptămâna asta” după caz.
- Etichetele pentru cititorul de ecran (`aria-label`) rămân descriptive.

## În afara scopului
- Migrații, `src/lib/domain`, `src/lib/db`, `src/lib/sync` (textele „fără preț” din domeniu rămân).
- Celelalte secțiuni (Rețete, Plan, Buget, Cămară), în afară de butonul „Creează prima listă” de pe Acasă, schimbat ca să fie la fel ca pe Cumpărături.

## Etape
| # | Etapa | Stare | Fișiere |
|---|---|---|---|
| 1 | Textele din Cumpărături (tabelul de mai jos) | gata | `cumparaturi/page.tsx`, `cumparaturi/lista/page.tsx`, `cumparaturi/bon/page.tsx`, `shopping/item-sheet.tsx`, `home-screen.tsx`, e2e care citesc textele |
| 2 | Bifa desenată, secțiunea „În coș” (în locul „Ascunde luate”), „Ai tot!”, „Anulează” după punere deoparte și ștergere, fără JetBrains Mono | gata | `cumparaturi/lista/page.tsx`, `ui/toast.tsx`, `globals.css`, `fonts.ts` |
| 3 | Tokeni noi (`--sprout`, `--wood`, `--paper`), cu `contrast.test.ts`; 6–8 iconițe proprii (SVG inline) | de făcut | `globals.css`, `contrast.test.ts`, `components/ui/icons.tsx` |
| 4 | De decis: font de mână pentru 2–3 momente; căutarea jos, lângă total | de făcut | — |

## Decizii (chestionar, 23 oct. 2026)
- Textele din tabel: aprobate toate, cu forme prescurtate („n-ai”, „ce-ți”).
- „S-a terminat în cămară” și „Cumperi des” rămân cum sunt (decizia din 18 oct.).
- Lista refolosită: eticheta „se reia”.
- Arhivarea: „Pune deoparte” · „Puse deoparte” · „Scoate înapoi”.

## Decizii etapa 2 (chestionar, 23 oct. 2026)
- JetBrains Mono iese din toată aplicația (înlocuiește decizia din 014, 18 oct.); sumele și datele în DM Sans cu cifre aliniate.
- Bifatele coboară în „În coș (N)”, strâns, jos; butonul „Ascunde luate / Arată tot” dispare.
- La ultima bifă: „Ai tot! Apasă „Gata” la casă.” în bara de jos, iar „Gata” e evidențiat.
- „Anulează” după „Pune deoparte” și după ștergerea listei (întrebarea „Ștergi lista?” rămâne); vibrație scurtă la bifă pe Android.

## Etapa 1 — textele aprobate
### Ecranul cu liste (`cumparaturi/page.tsx`)
| Înainte | După |
|---|---|
| Listele gospodăriei, la comun | Ce e de luat, pentru toată casa |
| Nicio listă activă | Încă n-ai nicio listă |
| Fă o listă pentru cumpărăturile săptămânale, una pentru piață sau câte una pentru fiecare magazin. | Una pentru săptămână, una pentru piață, sau câte una pe magazin, cum îți vine mai la îndemână. |
| Creează prima listă (și pe Acasă) | Începe o listă |
| Goală | Încă goală |
| 3 din 8 luate | 3 din 8 în coș |
| recurentă | se reia |
| Adaugă un bon fiscal | Pune un bon |
| Istoricul cumpărăturilor | Ce-ai cumpărat până acum |
| Liste arhivate · Arată (3) · Ascunde | Puse deoparte · Arată-le (3) · Ascunde-le |
| Lista e din nou activă. | Am scos lista înapoi. |
| ex. Cumpărături săptămânale | ex. Piața de sâmbătă |
| Magazin obișnuit (opțional) · Oriunde | De obicei iei de la… · De oriunde |
| Listă recurentă — După ce termini cumpărăturile, produsele rămân pe listă, debifate, pentru data viitoare. | O folosesc des — După cumpărături, produsele rămân pe listă, nebifate, gata pentru data viitoare. |

### Lista deschisă (`cumparaturi/lista/page.tsx`, `product-search.tsx`)
| Înainte | După |
|---|---|
| Adaugă: ex. 2 kg roșii | Ce-ți trebuie? ex. 2 kg roșii |
| 3 din 8 luate · listă recurentă · arhivată | 3 din 8 în coș · se reia · pusă deoparte |
| Lista e goală — Scrie mai sus ce ai de cumpărat… | Foaia e albă — Scrie sus ce-ți trebuie („2 kg cartofi”, „lapte”) sau ia direct dintr-o rețetă ori din planul meselor. |
| important | neapărat |
| fără preț / + preț | preț? / cât a costat? |
| Adăugare rapidă | Poate-ți mai trebuie |
| S-a terminat în cămară · Cumperi des | (rămân) |
| 84 lei cheltuit · estimat total 140 lei | 84 lei dați până acum · cam 140 lei în total |
| 2 fără preț cunoscut | 2 încă fără preț |
| Rămân 120 lei din buget | Mai ai 120 lei luna asta / săptămâna asta |
| Depășește bugetul cu 35 lei | Ai trecut de buget cu 35 lei |
| Setează un buget | Pune-ți un buget |
| Redenumește · Redenumește lista | Schimbă numele · Schimbă numele listei |
| Duplică lista · Lista a fost duplicată. | Fă o copie · Gata copia. |
| Arhivează · Lista a fost arhivată. | Pune deoparte · Am pus-o deoparte. |
| Scoate din arhivă | Scoate înapoi |
| Compară magazinele · Cât ar costa lista | Unde iese mai ieftin · Cât ar costa lista |
| Fă-o recurentă (se refolosește săptămânal) · Nu mai e recurentă | Păstreaz-o pentru data viitoare · Nu o mai relua |
| Lista a fost ștearsă. | Am șters lista. |
| Ai terminat cumpărăturile? · Finalizează | Gata la cumpărături? · Gata, am terminat |
| N produse bifate nu au preț. Le poți completa acum, ca bugetul să fie exact, sau mai târziu din istoric. | La N produse n-ai pus prețul. Le pui acum sau mai încolo, din istoric, cum îți vine. |
| Lista se arhivează. Cheltuielile apar în Buget. | Pun lista deoparte, iar banii îi trec la Buget. |
| Lista recurentă se golește de bifări și e gata pentru data viitoare. | Debifez tot și lista te așteaptă data viitoare. |
| Gata! Ai cheltuit X; N produse au intrat în cămară. | Gata! Ai dat X. Am pus N produse în cămară. |

### Produsul și bonul (`item-sheet.tsx`, `bon/page.tsx`)
| Înainte | După |
|---|---|
| Prețul la raft nu e valid. Scrie de exemplu 7,99. | Prețul nu arată a preț. Scrie-l așa: 7,99. |
| Prețul nu e valid. Scrie de exemplu 12,50. (și „Estimarea…”) | Prețul nu arată a preț. Scrie-l așa: 12,50. |
| Scrie numele produsului. | Cum se numește produsul? |
| Cantitatea trebuie să fie mai mare decât zero. | Cantitatea trebuie să fie peste zero (de exemplu 0,5 sau 2). |
| Citesc bonul… Durează câteva secunde. | Mă uit pe bon… Câteva secunde. |
| Sumele nu se potrivesc cu totalul bonului. Verifică liniile marcate. | Ceva nu bate cu totalul de pe bon. Uită-te la rândurile marcate. |

## Rezumat pe etape
### Etapa 1 (23 oct. 2026)
- Textele din tabel, pe ecranele de Cumpărături, pe fereastra produsului, pe bon și la butonul de pe Acasă.
- Pe lângă tabel, pentru consecvență: „Mă uit pe bon… N%” (cititorul de pe telefon), „Prețul estimat nu arată a preț…” (ca să știi care câmp), „Pun lista deoparte; le poți muta înainte în altă listă.”, „Am pus un produs în cămară” la singular, „20 de produse” (cu `count()`), „Îl pui” la singular, eticheta barei de buget după perioadă.
- Mesajele din `src/lib/services` (folosite și în alte secțiuni) au rămas.
- `npm test` 610/610, `npm run build`, `npm run test:e2e` 46/46. `e2e-cloud` (2 texte actualizate) nu a rulat aici: cere Supabase local.

### Etapa 2 (23 oct. 2026)
- Fără JetBrains Mono: fișierele și licența scoase, `font-mono` scos din 14 ecrane, `tokens.test.ts` îl interzice.
- Lista: bifa desenată (`CheckMark`, `.draw-check` în `globals.css`); produsul bifat rămâne 0,5 s pe loc, apoi coboară în „În coș (N)”; „Pe raioane / Pe magazine” grupează doar ce mai e de luat; „Ai tot!” și „Gata” evidențiat la ultima bifă; vibrație la bifă.
- `restoreDeletedList` (serviciu nou) pentru „Anulează” după ștergere; „Anulează” și după „Pune deoparte”.
- Teste: `services.test.ts` (lista ștearsă revine cu produsele), `tokens.test.ts` (fără mono), e2e nou în `cumparaturi.spec.ts`; testele care căutau produse bifate deschid „În coș” (`openBasket`).
- Pe drum: #103 a reparat sincronizarea (formularul trimitea și câmpurile neschimbate) și CI-ul de pe `main`.
- `npm test` 614/614, `npm run build`, `npm run test:e2e` 47/47 (de două ori; o primă rulare a avut o cădere în `demo-model.spec.ts:134` pe care n-am mai putut-o reproduce), `npm run test:e2e:cloud` 3/3.

## Cum verific la final
`npm test`, `npm run build`, `npm run test:e2e` verzi; pe 360 px, în ambele moduri, lista se folosește cu degetul mare.

## Următorul pas
Etapa 3: chestionarul pentru tokenii noi (`--sprout`, `--wood`, `--paper`) și iconițele proprii.
