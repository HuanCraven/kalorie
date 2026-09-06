#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Vyrobí katalog.json ze zaklad.js a jidla.js.

    python build/katalog.py

Proč to vůbec je: veřejná verze aplikace je zamrzlá — kamarádi jedou na snímku,
který se sám neaktualizuje. Katalog jídel se ale zlepšovat má. Když leží ve
vlastním souboru, jde přidat potravinu, aniž by se sáhlo na kód programu.

Aplikace si katalog stáhne při každém spuštění (service worker jede síť napřed)
a uloží ho u sebe. Když je offline, vezme uložený; při úplně prvním spuštění bez
sítě zbydou vestavěné zaklad.js a jidla.js. Selhat se tedy nedá.
"""
import io
import json
import os
import re
import time

KOREN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def vytahni(soubor, promenna):
    """Ze souboru `window.X = [...]` vytáhne to pole. Číst JS regulárem je ošklivé,
       ale oba soubory generuje build-jidla.js do jednoho řádku a tvar je pevný."""
    text = io.open(os.path.join(KOREN, soubor), encoding='utf-8').read()
    m = re.search(r'window\.' + promenna + r'\s*=\s*(\[.*\]);?\s*$', text, re.S)
    if not m:
        raise SystemExit('CHYBA: v %s jsem nenašel window.%s = [...]' % (soubor, promenna))
    return json.loads(m.group(1))


def main():
    zaklad = vytahni('zaklad.js', 'ZAKLAD')
    jidla = vytahni('jidla.js', 'JIDLA')
    katalog = {
        'verze': time.strftime('%Y-%m-%d'),
        'zdroje': ('Základní potraviny jsou referenční hodnoty na 100 g. '
                   'Hotová jídla jsou počítaná ze surovin podle receptur, ne opsaná odjinud.'),
        'zaklad': zaklad,
        'jidla': jidla,
    }
    cil = os.path.join(KOREN, 'katalog.json')
    io.open(cil, 'w', encoding='utf-8', newline='').write(
        json.dumps(katalog, ensure_ascii=False, separators=(',', ':')))
    print('katalog.json: %d základních potravin, %d hotových jídel, verze %s'
          % (len(zaklad), len(jidla), katalog['verze']))


if __name__ == '__main__':
    main()
