# Markthalle nach entwuerfe/Marktgebaeude.png — baut Szene "Markt"
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau, barrel, crate, sack

b = Bau('Markt', 'market', {
    'balken': '#6e4423', 'holz': '#9a6a3c', 'stein': '#9d9892', 'dach': '#c8443a', 'dach_dunkel': '#a8352d',
    'rot': '#c8443a', 'weiss': '#f1e6cf', 'sack': '#e3cd9c', 'eisen': '#55585c', 'gruen': '#5fae3a',
    'apfel': '#d23a2a', 'gelb': '#efb42c', 'braun': '#8a3a22', 'erde': '#b99a6a',
})

W, D, H = 3.3, 2.4, 1.25
b.box('erde', (0, 0, 0.01), (W, D, 0.02))
# Pfosten auf Steinsockeln, je Seite drei
posts = [(x, y) for x in (-W / 2, 0, W / 2) for y in (-D / 2, D / 2)]
for x, y in posts:
    b.box('stein', (x, y, 0.13), (0.32, 0.32, 0.26))
    b.box('balken', (x, y, 0.26 + H / 2), (0.18, 0.18, H))
for y in (-D / 2, D / 2):
    b.box('balken', (0, y, H + 0.32), (W + 0.3, 0.2, 0.16))
    for x in (-W / 2, 0, W / 2):
        for s in (-1, 1):
            if (x == -W / 2 and s < 0) or (x == W / 2 and s > 0):
                continue
            b.beam('balken', (x, y, H - 0.1), (x + s * 0.35, y, H + 0.26), 0.09)
pitch = math.radians(34)
apex = b.gable_roof('dach', W, D, H + 0.42, pitch, over=0.25, key2='dach_dunkel')
# Dachstuhl an den Stirnseiten: Zugbalken, Mittelpfosten, Streben
for x in (-W / 2, W / 2):
    b.box('balken', (x, 0, H + 0.4), (0.2, D + 0.3, 0.16))
    b.box('balken', (x, 0, (H + 0.4 + apex) / 2), (0.16, 0.16, apex - H - 0.4))
    for s in (-1, 1):
        b.beam('balken', (x, s * D * 0.42, H + 0.45), (x, 0, apex - 0.25), 0.1)
b.box('balken', (0, 0, apex + 0.06), (W + 0.6, 0.2, 0.14))
for x in (-W / 2 - 0.3, W / 2 + 0.3):
    b.box('balken', (x, 0, apex + 0.12), (0.2, 0.2, 0.3))

# Zwei Stände mit gestreiften Markisen
for cx in (-0.8, 0.8):
    cy = -0.35
    b.box('holz', (cx, cy, 0.3), (1.1, 0.5, 0.6))
    for i in range(3):
        b.box('balken', (cx - 0.5 + i * 0.5, cy - 0.26, 0.3), (0.05, 0.03, 0.6))
    for dx in (-0.55, 0.55):
        b.box('balken', (cx + dx, cy - 0.3, 0.55), (0.06, 0.06, 1.1))
    # Markise schräg nach vorn: Streifen abwechselnd rot und weiß
    n = 8
    for i in range(n):
        x = cx - 0.6 + (i + 0.5) * 1.2 / n
        b.box('rot' if i % 2 == 0 else 'weiss', (x, cy - 0.55, 1.05), (1.2 / n, 0.62, 0.04), rx=-0.45)
        b.box('rot' if i % 2 == 0 else 'weiss', (x, cy - 0.85, 0.86), (1.2 / n, 0.04, 0.16))
    # Ware
    b.box('holz', (cx - 0.25, cy, 0.66), (0.3, 0.22, 0.12))
    b.box('holz', (cx + 0.15, cy + 0.02, 0.66), (0.3, 0.22, 0.12))
    goods = ('gruen', 'apfel') if cx < 0 else ('gelb', 'braun')
    for i, (gx, key) in enumerate(((cx - 0.25, goods[0]), (cx + 0.15, goods[1]))):
        for k in range(4):
            b.box(key, (gx - 0.08 + (k % 2) * 0.14, cy - 0.05 + (k // 2) * 0.1, 0.75), (0.08, 0.08, 0.07))
# Fässer, Kisten, Säcke
barrel(b, (-1.75, -1.0, 0), wood='holz', iron='eisen')
barrel(b, (1.7, -0.85, 0), wood='holz', iron='eisen')
crate(b, (-1.2, -1.15, 0), 0.3)
crate(b, (0.6, -1.1, 0), 0.32)
crate(b, (-1.7, 0.7, 0), 0.28)
sack(b, (-1.45, -1.25, 0))
sack(b, (1.35, -1.05, 0))
b.finish('market')
