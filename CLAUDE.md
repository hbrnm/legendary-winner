# CLAUDE.md

Reguli de lucru pentru <NUME> (<ce face, pentru cine>, <tehnologii>).

## 1. Principii
1. Gândește înainte de cod: spune presupunerile; dacă e neclar, întreabă.
2. Simplitate: minimul de cod care rezolvă problema.
3. Modificări chirurgicale: atinge doar ce cere sarcina.
4. Rezultat verificabil: un test care reproduce problema, apoi trece.

Deciziile proprietarei se prezintă ca chestionar cu variante,
cea recomandată prima, marcată „(Recomandat)”.

## 2. Proiect
- Structură: <dosare și ce conțin>.
- Teste: <comanda>. Orice comportament nou vine cu test.
  Testele nu depind de data de azi, de rețea sau de ordinea
  rulării; data se fixează în test.
  Înainte de push: <comanda de test> și <comanda de build>.
- Convenții: ramuri <claude/nume-scurt>; commit-uri cu prefix
  (`feat:`, `fix:`, `test:`, `docs:`); PR-ul spune ce s-a schimbat
  și dovada verificării.
- Date și securitate: <ce e sensibil; cine are voie să citească ce>.
  Nicio cheie secretă în cod.
- Conținut de specialitate: nu inventa <doze / clauze / cifre>;
  scrie „DE COMPLETAT: …” și întreabă.
- UI: <tokeni de culoare, lățime minimă>.
- Texte: <limba, tonul, cum arată un mesaj de eroare>.

## 3. Orchestrator + agenți
<tabelul agenților; ce nu se deleagă; regulile de economie>
