# Cămara — Ritm

Direcția aprobată: https://www.figma.com/design/AMRsTaHFmcfSCTZSLKMMxk?node-id=13-137

Implementăm designul în PWA existentă, nu o aplicație SwiftUI separată. Carduri modulare din Google Health, titluri ierarhizate, gradient discret și navigare plutitoare inspirate de Apple Health. Grafit #090a0d, carduri #202125, caisă #f3b68e, lavandă #bdb2f4, albastru #a5c8ff. Mod luminos: fundal #f6f4f1, carduri albe, accente mai închise pentru contrast.

Acasă: buget real într-un card principal, două carduri pentru lista activă și expirări, apoi planul zilei. Păstrăm adăugarea rapidă, sugestiile, istoricul și detaliile expirărilor. Nicio cifră demonstrativă din Figma nu se fixează în cod. Titlurile și controalele din cele cinci destinații folosesc aceleași tokenuri și forme. Sistemul Apple este primul font pe iPhone; DM Sans local rămâne rezervă offline.

Datele, autentificarea, sincronizarea și serviciile existente se păstrează. Fără dependențe noi. Zone de atingere de cel puțin 44 px, focus vizibil, formulare utilizabile cu tastatura, suport reduced-motion. Navigare laterală pe tabletă și desktop. Bara plutitoare respectă safe-area și nu acoperă acțiuni sau ultimul conținut. Lista în mod cumpărături păstrează navigarea ascunsă și acțiunile dedicate.

Fără publicare, push, migrații sau modificări ale datelor de producție în această etapă.
