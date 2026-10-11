# claude-starter

Șablon de pornire pentru proiecte noi lucrate cu Claude Code, după metoda din OncoSentinel. Ghidul complet: [`docs/playbook-claude-code.md`](docs/playbook-claude-code.md).

## Ce conține
| Fișier | La ce folosește |
| --- | --- |
| `CLAUDE.md` | Regulile proiectului; se completează ce e între `<…>` |
| `.claude/agents/` | Cei patru agenți: `explorare`, `testare`, `executie`, `verificare` |
| `.claude/settings.json` | Claude nu poate citi `.env` (permisiuni impuse) |
| `.tasks/README.md` | Șablonul pentru lucrările mari, pe etape |
| `docs/playbook-claude-code.md` | Cum se lucrează: ciclul unei etape, siguranță, economie |

## Cum pornești un proiect nou
1. Pe GitHub, în acest repo: **Use this template → Create a new repository**.
2. Pornește o sesiune Claude Code pe repo-ul nou și scrie: „Completează `CLAUDE.md` și agenții pentru acest proiect, după `docs/playbook-claude-code.md`, cu întrebările ca chestionar.”
3. Verifică mediul cloud: setup script (ex. `npm ci`) și nicio cheie secretă în variabile (playbook, secțiunile 2 și 5).
