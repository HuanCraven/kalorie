#!/usr/bin/env python3
# Vygeneruje testovací fixtures do složky KAL_DIR (jinak temp): alco.bin (AlcoDroid záloha),
# nutri.csv (NutriDatabaze, 1136 položek), bc.y4m (video s EAN-13 pro fake kameru).
# Spustit jednou před ./runall.sh v novém prostředí. Potřeba: python3, npm i @zxing/library.
import struct, datetime, random, array, os, tempfile

# Stejná složka, jakou používá testy/prostredi.js — přepsatelná proměnnou KAL_DIR.
DIR = os.environ.get('KAL_DIR') or os.path.join(tempfile.gettempdir(), 'kalorie-testy')
os.makedirs(DIR, exist_ok=True)

random.seed(7)
# ---- alco.bin ----
buf = bytearray(b'\x00\x00\x03\xe8')
def rec(name, ml, abv, dt):
    b = bytearray(b'\x00\x00\x03\xea')
    nb = name.encode('utf-8')
    b += struct.pack('>H', len(nb)) + nb + b'\x00\x00'
    b += struct.pack('>d', ml) + struct.pack('>d', abv)
    b += struct.pack('>q', int(dt.timestamp()*1000))
    return b
recs = [rec('Víno', 750, 12.0, datetime.datetime(2026,5,19,21,30)),
        rec('Pivo 11°', 1300, 4.5, datetime.datetime(2026,7,31,19,0))]
d0 = datetime.date(2026,5,20)
for i, off in enumerate(sorted(random.sample(range(0,72), 45))):
    d = d0 + datetime.timedelta(days=off)
    nm, ml, abv = [('Pivo 12°',500,5.0),('Pivo 10°',500,4.0),('Víno',200,12.5)][i%3]
    recs.append(rec(nm, ml, abv, datetime.datetime(d.year,d.month,d.day,20,15)))
for r in recs: buf += r
open(os.path.join(DIR, 'alco.bin'),'wb').write(bytes(buf))

# ---- nutri.csv ----
rows = [('Agar',336,0.6,83.4,0,0,0.28), ('Ananas',50,0.5,10.6,0.2,2.0,0),
        ('Rohlík bílý',351,11.4,'',1.4,2.2,1.2), ('Langoš',285,6.1,'',12.3,1.5,0.9),
        ('Hamburger',248,13.0,'',7.4,1.1,1.0),
        ('Chléb slunečnicový',262,8.6,44.1,5.2,5.8,1.3), ('Bageta rustikální',268,8.9,53.3,1.6,2.8,1.4),
        ('Chléb vícezrnný',249,9.1,43.9,3.6,6.5,1.2), ('Rohlík grahamový',289,9.6,55.8,2.6,4.6,1.3)]
i = 1
while len(rows) < 1136:
    rows.append((f'Potravina {i:04d}', 100+i%300, 5+(i%20), 10+(i%40), 2+(i%15), i%8, round((i%50)/10,1)))
    i += 1
with open(os.path.join(DIR, 'nutri.csv'),'w',encoding='utf-8') as f:
    f.write('origFdNm;ENERC [kcal];PROT [g];CHO [g];FAT [g];FIBT [g];NACL [g]\n')
    for r in rows: f.write(';'.join(str(x) for x in r) + '\n')

# ---- bc.y4m (EAN-13 8593893770317) ----
L = {'0':'0001101','1':'0011001','2':'0010011','3':'0111101','4':'0100011',
     '5':'0110001','6':'0101111','7':'0111011','8':'0110111','9':'0001011'}
R = {k: v.translate(str.maketrans('01','10')) for k,v in L.items()}
G = {k: R[k][::-1] for k in R}
FIRST = {'0':'LLLLLL','1':'LLGLGG','2':'LLGGLG','3':'LLGGGL','4':'LGLLGG',
         '5':'LGGLLG','6':'LGGGLL','7':'LGLGLG','8':'LGLGGL','9':'LGGLGL'}
code = '8593893770317'
pat = '101'
for i, c in enumerate(code[1:7]): pat += (L if FIRST[code[0]][i]=='L' else G)[c]
pat += '01010'
for c in code[7:]: pat += R[c]
pat += '101'
W, H, MOD = 640, 480, 5
x0 = (W-95*MOD)//2
y = array.array('B', [255]*(W*H))
for yy in range(120, 360):
    for i, b in enumerate(pat):
        if b=='1':
            for m in range(MOD): y[yy*W + x0 + i*MOD + m] = 0
u = array.array('B', [128]*((W//2)*(H//2)))
with open(os.path.join(DIR, 'bc.y4m'),'wb') as f:
    f.write(b'YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420\n')
    for _ in range(50):
        f.write(b'FRAME\n'); y.tofile(f); u.tofile(f); u.tofile(f)
print('fixtures hotové v', DIR, '— alco.bin, nutri.csv, bc.y4m')
