#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ikona aplikace: kruh maker (modrá / zelená / oranžová) s vidličkou uprostřed.

    python3 build/ikona-aplikace.py            # zapíše do manifest.json a index.html
    python3 build/ikona-aplikace.py nahled.png # jen náhled 512 px, nic nemění

Návrh vzešel z generovaného obrázku (Hugging Face, Z-Image Turbo, v116); tady je
překreslený geometricky, aby měl přesné barvy aplikace, žádné stíny ani přechody
a dal se kdykoli vyrobit znovu. Do manifestu jde jako 512px PNG (`any` i `maskable`
— kruh má poloměr 31 % strany, bezpečná zóna maskovací ikony je 40 %), do index.html
jako SVG favicon. Z manifestu si ikony bere i build/apk-ikony.py pro APK.
"""
import base64, io, json, re, sys
from PIL import Image, ImageDraw

POZADI = '#0e1116'   # --bg v index.html
MODRA, ZELENA, ORANZ, BILA = '#4ea3ff', '#3fbf7f', '#f0a742', '#e8ecf3'
# geometrie v jednotkách 512px ikony; ZVETSENI zvětší celý motiv kolem středu
# (1,15 → kruh má poloměr 31 % strany, bezpečná zóna maskovací ikony je 40 %)
STRED, R_VNE, R_VNI = 256, 140, 93
ZVETSENI = 1.15


def nakresli(n=512):
    k = 4                                   # vyhlazení: kreslí se 4× větší a zmenší
    s = n * k / 512 * ZVETSENI
    o = (STRED - STRED * ZVETSENI) * n * k / 512   # posun, ať zvětšení drží střed
    im = Image.new('RGB', (n * k, n * k), POZADI)
    d = ImageDraw.Draw(im)
    box = [(STRED - R_VNE) * s + o, (STRED - R_VNE) * s + o, (STRED + R_VNE) * s + o, (STRED + R_VNE) * s + o]
    # úhly v PIL: 0° = vpravo, po směru hodin
    d.pieslice(box, 90, 270, fill=MODRA)    # levá polovina
    d.pieslice(box, 270, 360, fill=ZELENA)  # vpravo nahoře
    d.pieslice(box, 0, 90, fill=ORANZ)      # vpravo dole
    vn = [(STRED - R_VNI) * s + o, (STRED - R_VNI) * s + o, (STRED + R_VNI) * s + o, (STRED + R_VNI) * s + o]
    d.ellipse(vn, fill=POZADI)
    # vidlička: tři hroty, hlava, rukojeť se zaoblenými konci
    r = lambda x0, y0, x1, y1, rad: d.rounded_rectangle(
        [x0 * s + o, y0 * s + o, x1 * s + o, y1 * s + o], radius=rad * s, fill=BILA)
    for x in (236, 252, 268):
        r(x, 202, x + 8, 250, 4)
    d.pieslice([236 * s + o, 226 * s + o, 276 * s + o, 270 * s + o], 0, 180, fill=BILA)
    r(236, 236, 276, 248, 0)
    r(247, 240, 265, 322, 9)
    return im.resize((n, n), Image.LANCZOS)


def favicon_svg():
    # 32px: kruh je silnější a vidlička zjednodušená, jinak by v liště zanikly
    from math import cos, sin, pi
    obl = lambda a0, a1, c: (
        "<path d='M{:.2f} {:.2f}A9 9 0 0 1 {:.2f} {:.2f}' stroke='{}'/>".format(
            16 + 9 * cos(a0), 16 + 9 * sin(a0), 16 + 9 * cos(a1), 16 + 9 * sin(a1), c))
    # SVG oblouk o 180° je nejednoznačný — levá půlka se kreslí na dvakrát
    oblouky = obl(pi / 2, pi, MODRA) + obl(pi, 3 * pi / 2, MODRA) + \
        obl(3 * pi / 2, 2 * pi, ZELENA) + obl(0, pi / 2, ORANZ)
    return ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
            "<rect width='32' height='32' rx='6' fill='%s'/>"
            "<g fill='none' stroke-width='4.2'>%s</g>"
            "<g fill='%s'><rect x='13.6' y='10.5' width='1.3' height='4'/>"
            "<rect x='15.35' y='10.5' width='1.3' height='4'/>"
            "<rect x='17.1' y='10.5' width='1.3' height='4'/>"
            "<rect x='13.6' y='14' width='4.8' height='1.6' rx='.8'/>"
            "<rect x='15.2' y='14.5' width='1.6' height='7' rx='.8'/></g></svg>"
            ) % (POZADI, oblouky, BILA)


def data_uri_png(im):
    b = io.BytesIO()
    # 64 barev bez rozptylu stačí na čtyři plné barvy s vyhlazenými hranami;
    # z 33 kB je 8,5 kB, a manifest nese ikonu dvakrát
    im.quantize(64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(
        b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def prepis(cesta, fce):
    # konce řádků zachovat (.gitattributes: * -text)
    s = io.open(cesta, encoding='utf-8', newline='').read()
    n = fce(s)
    io.open(cesta, 'w', encoding='utf-8', newline='').write(n)
    return s != n


if __name__ == '__main__':
    if len(sys.argv) > 1:
        nakresli().save(sys.argv[1])
        sys.exit(0)
    uri = data_uri_png(nakresli())

    def manifest(s):
        m = json.loads(s)
        for i in m['icons']:
            i['src'] = uri
        m['background_color'] = POZADI
        m['theme_color'] = POZADI
        return json.dumps(m, ensure_ascii=False)

    def index(s):
        svg = favicon_svg().replace('<', '%3C').replace('>', '%3E').replace('#', '%23')
        nove, pocet = re.subn(r'<link rel="icon" href="data:image/svg\+xml,[^"]*">',
                              '<link rel="icon" href="data:image/svg+xml,' + svg + '">', s, 1)
        assert pocet == 1, 'v index.html chybí <link rel="icon">'
        return nove

    print('manifest.json', 'změněn' if prepis('manifest.json', manifest) else 'beze změny')
    print('index.html', 'změněn' if prepis('index.html', index) else 'beze změny')
