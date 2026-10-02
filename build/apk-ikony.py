#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ikony pro APK z ikon webové aplikace v manifest.json.

    python3 build/apk-ikony.py www/manifest.json android/app/src/main/res

Bez toho by aplikace měla ikonu Capacitoru. Manifest nese dvě ikony 512 px jako
data: URI — obyčejnou (`any`) a s ochrannou zónou pro ořez (`maskable`). Obyčejná
jde do starých ikon, maskovací do popředí adaptivní ikony Androidu 8+.
"""
import base64, io, json, os, sys
from PIL import Image

manifest, res = sys.argv[1], sys.argv[2]
m = json.load(io.open(manifest, encoding='utf-8'))
pozadi = m.get('background_color', '#12151a')


def ikona(ucel):
    for i in m.get('icons', []):
        if ucel in (i.get('purpose') or 'any').split():
            data = i['src'].split(',', 1)[1]
            return Image.open(io.BytesIO(base64.b64decode(data))).convert('RGBA')
    return None


obyc = ikona('any')
mask = ikona('maskable') or obyc
if obyc is None:
    sys.exit('v manifestu není ikona')

# hustota: (stará ikona, popředí adaptivní ikony)
HUSTOTY = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216),
           'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}
for h, (stara, popredi) in HUSTOTY.items():
    d = os.path.join(res, 'mipmap-' + h)
    os.makedirs(d, exist_ok=True)
    for jm in ('ic_launcher.png', 'ic_launcher_round.png'):
        obyc.resize((stara, stara), Image.LANCZOS).save(os.path.join(d, jm))
    # maskovací ikona má bezpečnou zónu 80 %, adaptivní 66/108 ≈ 61 % — zmenší se,
    # ať se okraje loga neořízly
    platno = Image.new('RGBA', (popredi, popredi), (0, 0, 0, 0))
    vnitr = int(popredi * 0.78)
    platno.paste(mask.resize((vnitr, vnitr), Image.LANCZOS), ((popredi - vnitr) // 2,) * 2)
    platno.save(os.path.join(d, 'ic_launcher_foreground.png'))

hodnoty = os.path.join(res, 'values')
os.makedirs(hodnoty, exist_ok=True)
io.open(os.path.join(hodnoty, 'ic_launcher_background.xml'), 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">%s</color>\n</resources>\n' % pozadi)
print('ikony hotové:', ', '.join(HUSTOTY))
