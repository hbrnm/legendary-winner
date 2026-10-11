# Fișiere de sarcină

Pentru lucrările mari (mai multe etape sau sesiuni). Câte un fișier `NNN-nume-scurt.md` (ex. `001-jurnal-export.md`). Se actualizează după fiecare etapă; la reluarea unei sesiuni se citește întâi. Lucrările mici nu au nevoie de fișier.

Șablon:

```markdown
# NNN — Titlu

**Stare:** în lucru | în așteptare (pe cine/ce) | gata
**Ramura:** claude/…

## Scop
Ce vrea proprietarul, în 2–3 rânduri. Deciziile lui, cu data.

## În afara scopului
Ce nu se atinge în această lucrare.

## Etape
| # | Etapa | Stare | Commit |
|---|---|---|---|
| 1 | … | gata / în lucru / de făcut | abc1234 |

## Rezumat pe etape
### Etapa 1 (data)
Ce s-a făcut, ce s-a verificat (`npm test` și `npm run build`, CI), ce a rămas deschis.

## Cum verific la final
Testul sau pasul care dovedește că lucrarea e gata.

## Următorul pas
Un singur rând, concret.
