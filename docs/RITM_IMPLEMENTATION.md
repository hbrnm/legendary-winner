# Cămara — implementarea Ritm

Referință aprobată: https://www.figma.com/design/AMRsTaHFmcfSCTZSLKMMxk?node-id=13-137

Designul este implementat în aplicația web/PWA existentă. Modificările sunt locale pe ramura `claude/material-3-redesign`, peste lucrările anterioare; nu s-a făcut push sau publicare.

## Comportament

- Acasă afișează bugetul gospodăriei, lista activă cu cele mai multe produse rămase și numărul real de produse expirate sau care expiră în următoarele trei zile.
- Cardul listei deschide lista respectivă; cardul cămării deschide inventarul. Într-o gospodărie goală, adăugarea rapidă creează o listă folosind serviciul existent.
- Bifarea produselor actualizează sumarul; datele persistă la reîncărcare. Planul zilei, adăugarea rapidă, expirările detaliate, sugestiile și istoricul rămân accesibile prin derulare.
- Cele cinci secțiuni păstrează fluxurile existente: editare, planificare, cumpărături, bonuri, bugete și inventar. Nu se schimbă schema bazei locale, autentificarea sau sincronizarea Supabase.
- Bara de navigare este plutitoare pe telefon, cu spațiu rezervat și safe-area; rămâne laterală pe tabletă și desktop. Lista de cumpărături păstrează modul dedicat, fără bara principală.

## Decizii de implementare

- Paleta și formele din Figma sunt tokenuri comune: caisă pentru acțiuni/buget, lavandă pentru cumpărături, albastru pentru cămară; erorile păstrează un roșu separat.
- Sistemul Apple este primul font pe iPhone/macOS; DM Sans local rămâne rezervă offline pe alte sisteme. Fără dependențe sau fonturi externe noi.
- Folosim componentele și pictogramele existente ale aplicației, păstrând identitatea Cămara. Nu afișăm status-bar sau home-indicator false în pagina web.
- Valorile din machetă sunt înlocuite cu date reale; diagrama statică nu este importată ca imagine. Modului demonstrativ îi rămâne avertizarea vizibilă.
- Cardurile își adaptează înălțimea pentru nume, prețuri necunoscute și mai multe liste; numele lungi sunt limitate vizual la două rânduri.

## Uniformizare completă a ecranelor

Etapa de uniformizare acoperă și paginile secundare: editor și import de rețete, detaliul rețetei, planul săptămânii și ferestrele lui, bonurile fotografiate/scrise și verificarea lor, istoricul, prețurile și categoriile Diverse, administrarea, gospodăria și setările, backup-ul, invitațiile, autentificarea și paginile offline/legale.

Formularele folosesc controale cu raza de 16 px, listele grupate/cardurile 28 px, antetele de detaliu 32 px bold și ferestrele 24 px bold. Segmentele sunt tonale, cu navigarea de tastatură păstrată; la patru opțiuni folosesc două coloane pe telefoanele sub 480 px pentru a evita suprapunerile. Paginile independente folosesc componenta StandalonePage și același gradient. Meniul mobil activ rămâne fără fundal: pictogramă caisă și text lavandă.

Vezi [auditul și dovezile verificării](ritm-screen-audit.md). Fluxurile care cer cont real au fost adaptate în sursă; verificarea locală în demo nu confirmă autentificarea sau serviciile Supabase live.

## Verificare

Rezultatele finale se găsesc în `docs/superpowers/plans/2026-11-15-ritm.md`.

Capturi locale: `/workspace/camara-ritm/` — Acasă luminos/întunecat și desktop, Rețete, Buget și Cămară. Datele sunt din gospodăria demonstrativă, cu data fixată la 8 martie 2026.

Handoff-ul și ZIP-ul Material 3 pregătite anterior sunt instantanee istorice și nu conțin această etapă Ritm.
