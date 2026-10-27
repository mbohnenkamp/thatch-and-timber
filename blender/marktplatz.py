# Marktplatz nach entwuerfe/Marktplatz.png — baut Szene "Marktplatz"
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau, bench

b = Bau('Marktplatz', 'plaza', {
    'pflaster': '#c9bfae', 'pflaster_dunkel': '#aea392', 'rand': '#958b7c', 'stein': '#a49e95', 'wasser': ('#2e4a66', 0.2),
    'holz': '#8a5a32', 'balken': '#6e4423', 'seil': '#c9a46a', 'gruen': '#4f8f2e', 'rot': '#e0582a', 'gelb': '#f0b22a',
})

S = 4.2
b.box('rand', (0, 0, 0.03), (S, S, 0.06))
# Pflaster: Platten im Raster, leicht unterschiedlich groß und hell
n = 9
step = (S - 0.2) / n
for i in range(n):
    for j in range(n):
        x = -S / 2 + 0.1 + (i + 0.5) * step
        y = -S / 2 + 0.1 + (j + 0.5) * step
        key = 'pflaster_dunkel' if (i * 7 + j * 3) % 5 == 0 else 'pflaster'
        shrink = 0.04 + ((i + j) % 3) * 0.015
        b.box(key, (x, y, 0.075), (step - shrink, step - shrink, 0.03))

# Brunnen in der Mitte
R = 0.55
for k in range(14):
    a = 2 * math.pi * k / 14
    for z, rr in ((0.16, R), (0.34, R - 0.02)):
        b.box('stein', (math.cos(a) * rr, math.sin(a) * rr, z), (0.2, 0.26, 0.18), rz=a)
b.cyl('wasser', (0, 0, 0.3), R - 0.1, R - 0.1, 0.04, seg=14)
for sx in (-1, 1):
    b.box('balken', (sx * (R + 0.02), 0, 0.65), (0.1, 0.1, 1.0))
    b.beam('balken', (sx * (R + 0.02), -0.15, 0.25), (sx * (R + 0.02), 0, 0.5), 0.06)
b.box('balken', (0, 0, 1.12), (2 * R + 0.25, 0.1, 0.1))
b.cyl('seil', (0, 0, 1.12), 0.07, 0.07, 0.3, seg=8, axis='X')
b.box('seil', (0, 0, 0.88), (0.02, 0.02, 0.45))
b.cyl('holz', (0, 0, 0.62), 0.09, 0.07, 0.16, seg=8)

# Vier Bänke um den Brunnen
for x, y, rz in ((-1.15, -1.0, 0.0), (1.15, -1.0, 0.0), (-1.15, 1.0, 0.0), (1.15, 1.0, 0.0)):
    bench(b, (x, y, 0.09), 0.85, rz=math.atan2(-y, -x) + math.pi / 2, wood='holz', legs='balken')

# Blumenkübel an den Seitenmitten
for x, y in ((0, -S / 2 + 0.3), (0, S / 2 - 0.3), (-S / 2 + 0.3, 0), (S / 2 - 0.3, 0)):
    b.cyl('stein', (x, y, 0.25), 0.3, 0.26, 0.34, seg=8)
    b.rock('gruen', (x, y, 0.38), 0.24, 0.16, n=9)
    for k in range(5):
        a = 2 * math.pi * k / 5
        b.box('rot' if k % 2 else 'gelb', (x + math.cos(a) * 0.13, y + math.sin(a) * 0.13, 0.55), (0.08, 0.08, 0.05))
b.finish('plaza')
