# Kalorie — pokyny pro Claude Code

Pravidla projektu jsou v `SKILL.md` (stejný text jako skill `kalorie-projekt`), aktuální
stav a historie rozhodnutí v `PREDANI.md` — přečti před první změnou.

@SKILL.md

## Cloudová session (Claude Code na webu / v aplikaci)

Hook `.claude/hooks/session-start.sh` při startu nainstaluje závislosti, vyrobí fixtures
a pustí server na `http://127.0.0.1:8811`. Regrese: `cd testy && bash runall.sh`
(~20 min; jednotlivá sada `node testNN.js`). Chromium je v kontejneru předinstalované,
`prostredi.js` ho najde samo — `playwright install` nespouštěj.
