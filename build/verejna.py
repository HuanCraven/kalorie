#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Vyrobí veřejnou verzi aplikace do zadané složky.

    python build/verejna.py ../kalorie-verejna

Aplikace má JEDEN zdroj kódu a dvě podoby. Tenhle skript je to jediné místo,
kde se přepínač `VEREJNA` překlápí — v `index.html` musí zůstat `false`, jinak
by Huan sám přišel o fotky jídla a o synchronizaci a nedozvěděl by se proč.

Veřejná verze se nasazuje VĚDOMĚ, ne při každém pushi. Kamarádi jedou na
zamrzlém snímku; když se tady něco rozbije, nerozbije se to i jim.

Skript odmítne pracovat, když v souboru najde něco, co vypadá jako API klíč.
Statický web nic neskryje — co je v souboru, má návštěvník k dispozici.
"""
import io
import os
import re
import shutil
import sys

# Soubory, které aplikace k běhu potřebuje. Zdroje, testy a dokumentace
# se nekopírují — kamarádům jsou k ničemu a jen by mátly.
SOUBORY = ['index.html', 'sw.js', 'manifest.json', 'zxing.js', 'zaklad.js', 'jidla.js']

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def preloz(text):
    """Překlopí přepínač. Selže hlasitě, když se řádek v index.html přejmenuje."""
    novy, poctu = re.subn(r'const VEREJNA = false;', 'const VEREJNA = true;', text)
    if poctu != 1:
        raise SystemExit('CHYBA: v index.html jsem nenašel právě jeden `const VEREJNA = false;` '
                         '(našel jsem %d). Přepínač se přejmenoval?' % poctu)
    return novy


def hlidej_klice(text, jmeno):
    """Veřejný soubor nesmí nést klíč. Hledá se tvar klíče, ne jeho jméno —
       na jméno proměnné se dá zapomenout, na `sk-ant-` ne."""
    nalez = re.search(r'sk-ant-[A-Za-z0-9_-]{10,}', text)
    if nalez:
        raise SystemExit('CHYBA: v %s je něco, co vypadá jako API klíč (%s…). '
                         'Nic nekopíruji.' % (jmeno, nalez.group(0)[:18]))


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    cil = os.path.abspath(sys.argv[1])
    if not os.path.isdir(cil):
        raise SystemExit('CHYBA: cílová složka %s neexistuje. Naklonuj tam napřed '
                         'veřejný repozitář.' % cil)
    if os.path.abspath(KOREN) == cil:
        raise SystemExit('CHYBA: cíl je zdrojová složka. To by přepsalo osobní verzi.')

    verze = None
    for jm in SOUBORY:
        zdroj = os.path.join(KOREN, jm)
        if not os.path.exists(zdroj):
            raise SystemExit('CHYBA: chybí %s' % zdroj)
        if jm == 'index.html':
            text = io.open(zdroj, encoding='utf-8').read()
            hlidej_klice(text, jm)
            text = preloz(text)
            m = re.search(r"APP_VERSION = '([^']+)'", text)
            verze = m.group(1) if m else '?'
            io.open(os.path.join(cil, jm), 'w', encoding='utf-8', newline='').write(text)
        else:
            if jm.endswith(('.js', '.json')):
                hlidej_klice(io.open(zdroj, encoding='utf-8').read(), jm)
            shutil.copyfile(zdroj, os.path.join(cil, jm))
        print('  %s' % jm)

    print('\nVeřejná verze %s je v %s' % (verze, cil))
    print('Zkontroluj, commitni a pushni AŽ TEHDY, když ji chceš pustit ven:')
    print('  cd %s && git add -A && git commit -m "verze %s" && git push' % (cil, verze))


if __name__ == '__main__':
    main()
