#!/usr/bin/env python3
# Ze snímku obrazovky ověří, že pod stavovou lištou a pod gesty je barva aplikace,
# ne černý (nebo bílý) rámeček z motivu Androidu. Volá build/apk-zkouska.sh.
import sys
from PIL import Image

im = Image.open(sys.argv[1]).convert('RGB')
w, h = im.size
# povolené: pozadí aplikace (--bg) a spodní navigace (nav v index.html)
ok = [(0x0e, 0x11, 0x16), (0x16, 0x1a, 0x21)]
spatne = []
# střed lišty — vlevo bývají hodiny, vpravo ikony
for kde, xy in (('nahoře', (w // 2, 8)), ('dole', (w // 2, h - 4))):
    px = im.getpixel(xy)
    if min(max(abs(a - b) for a, b in zip(px, c)) for c in ok) > 6:
        spatne.append('%s #%02x%02x%02x' % ((kde,) + px))
print('lišty: ' + (', '.join(spatne) or 'v barvě aplikace'))
sys.exit(1 if spatne else 0)
