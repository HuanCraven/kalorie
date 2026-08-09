#!/usr/bin/env python3
# Vygeneruje tri ikony zkratek (512x512 PNG) v barvach aplikace Kalorie.
# Bez zavislosti - vlastni scanline rasterizer se 4x4 supersamplingem a zapis PNG pres zlib.
import zlib, struct, math, base64, json, sys

S = 512          # velikost ikony
SUB = 4          # podvzorkovani na osu
BG = (0x12, 0x15, 0x1a)
FG = (0xe8, 0xec, 0xf3)
ACC = (0x4e, 0xa3, 0xff)


def coverage(polys):
    """Pokryti 0..1 pro kazdy pixel. Tvary se SJEDNOCUJI (bere se maximum),
    takze prekryv dvou obdelniku nedela diru jako u sudo-licheho pravidla."""
    cov = [[0.0] * S for _ in range(S)]
    for poly in polys:
        d = _coverage1(poly)
        for y in range(S):
            cr, dr = cov[y], d[y]
            for x in range(S):
                if dr[x] > cr[x]:
                    cr[x] = dr[x]
    return cov


def _coverage1(poly):
    cov = [[0.0] * S for _ in range(S)]
    edges = []
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if y0 != y1:
            edges.append((x0 * SUB, y0 * SUB, x1 * SUB, y1 * SUB))
    if not edges:
        return cov
    hi = S * SUB
    for sy in range(hi):
        yc = sy + 0.5
        xs = []
        for x0, y0, x1, y1 in edges:
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        if not xs:
            continue
        xs.sort()
        row = cov[sy // SUB]
        for i in range(0, len(xs) - 1, 2):
            a, b = xs[i], xs[i + 1]
            if b <= a:
                continue
            a = max(a, 0.0)
            b = min(b, float(hi))
            if b <= a:
                continue
            pa, pb = int(a // SUB), int((b - 1e-9) // SUB)
            for px in range(pa, pb + 1):
                lo = max(a, px * SUB)
                up = min(b, (px + 1) * SUB)
                if up > lo:
                    row[px] += (up - lo) / (SUB * SUB)
    return cov


def rect(x, y, w, h, r=0):
    """Obdelnik, volitelne se zaoblenymi rohy."""
    if r <= 0:
        return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
    r = min(r, w / 2, h / 2)
    pts = []
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0),
                       (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for k in range(17):
            a = math.radians(a0 + k * 90 / 16)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def circle(cx, cy, r, seg=96):
    return [(cx + r * math.cos(2 * math.pi * i / seg),
             cy + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]


def compose(vrstvy):
    """vrstvy = [(polys, barva)] malovane pres sebe na pozadi."""
    img = [[BG[0], BG[1], BG[2]] * S for _ in range(S)]
    px = [[list(BG) for _ in range(S)] for _ in range(S)]
    for polys, col in vrstvy:
        cov = coverage(polys)
        for y in range(S):
            crow, prow = cov[y], px[y]
            for x in range(S):
                c = crow[x]
                if c <= 0:
                    continue
                c = 1.0 if c > 1 else c
                p = prow[x]
                p[0] = round(p[0] + (col[0] - p[0]) * c)
                p[1] = round(p[1] + (col[1] - p[1]) * c)
                p[2] = round(p[2] + (col[2] - p[2]) * c)
    return px


def png(px):
    raw = bytearray()
    for y in range(S):
        raw.append(0)
        for p in px[y]:
            raw += bytes((p[0], p[1], p[2], 255))
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', S, S, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
            + chunk(b'IEND', b''))


# ---- vidlicka a nuz (Zapsat jidlo) ---------------------------------------
def ikona_jidlo():
    # vidlicka: tri zuby nahore, pod nimi krcek a drzadlo (tvary se sjednocuji)
    # mezery mezi zuby 12 px, aby nesplynuly, az to telefon zmensi na ~48 px
    zuby = [rect(128, 78, 18, 132, 9), rect(158, 78, 18, 132, 9), rect(188, 78, 18, 132, 9)]
    krcek = rect(128, 186, 78, 74, 24)
    drzadlo = rect(151, 240, 32, 200, 16)
    vidlicka = zuby + [krcek, drzadlo]
    # nuz: cepel se sesikmenou spickou + drzadlo stejne sirky jako u vidlicky
    cepel = [(318, 78), (350, 116), (350, 262), (318, 262)]
    nuz = [cepel, rect(318, 240, 32, 200, 16)]
    return [(vidlicka, FG), (nuz, ACC)]


# ---- sklenice (Zapsat napoj) ---------------------------------------------
def ikona_napoj():
    sklo = [[(168, 92), (344, 92), (322, 430), (190, 430)]]
    vnitrek = [[(186, 118), (326, 118), (308, 404), (204, 404)]]
    napoj = [[(196, 196), (316, 196), (308, 404), (204, 404)]]
    return [(sklo, FG), (vnitrek, BG), (napoj, ACC)]


# ---- cinka (Zapsat cviceni) ----------------------------------------------
def ikona_cviceni():
    osa = [rect(150, 238, 212, 36, 10)]
    kotouce = [rect(96, 176, 54, 160, 18), rect(362, 176, 54, 160, 18)]
    cepicky = [rect(64, 214, 34, 84, 14), rect(414, 214, 34, 84, 14)]
    return [(osa, FG), (kotouce, ACC), (cepicky, FG)]


IKONY = {'jidlo': ikona_jidlo, 'napoj': ikona_napoj, 'cviceni': ikona_cviceni}

# poradi odpovida poradi zkratek v manifest.json
PORADI = ['jidlo', 'napoj', 'cviceni']

if __name__ == '__main__':
    ven = sys.argv[1] if len(sys.argv) > 1 else '.'
    out = {}
    for nazev in PORADI:
        data = png(compose(IKONY[nazev]()))
        open('%s/%s.png' % (ven, nazev), 'wb').write(data)
        out[nazev] = 'data:image/png;base64,' + base64.b64encode(data).decode()
        print(nazev, len(data), 'B')
    json.dump(out, open('%s/ikony.json' % ven, 'w'))

    if '--do-manifestu' in sys.argv:
        import io, os
        cesta = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'manifest.json')
        m = json.load(io.open(cesta, encoding='utf-8'))
        for zk, klic in zip(m['shortcuts'], PORADI):
            zk['icons'] = [{'src': out[klic], 'sizes': '512x512', 'type': 'image/png'}]
        io.open(cesta, 'w', encoding='utf-8', newline='\n').write(
            json.dumps(m, ensure_ascii=False, separators=(', ', ': ')))
        print('manifest.json aktualizovan — nezapomen zvysit APP_VERSION a cache v sw.js')
