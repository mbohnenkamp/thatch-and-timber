# Wirtshaus nach entwuerfe/Witrshaus.png — baut Szene "Wirtshaus"
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau, window, barrel, bench

b = Bau('Wirtshaus', 'tavern', {
    'stein': '#a7a29a', 'stein_dunkel': '#8a857d', 'putz': '#f3e8d2', 'balken': '#6e4423', 'holz': '#9a6a3c',
    'dach': '#c8443a', 'dach_dunkel': '#a8352d', 'tuer': '#7a4a28', 'glas': ('#f6c35a', 0.5, 0.0, 1.5),
    'laden': '#6e4423', 'eisen': '#3c3a38', 'schild': '#7a4a28', 'bier': '#e9a52a', 'schaum': '#fbf6ea',
})

W, D = 2.2, 1.6
Z1, Z2 = 1.05, 2.0          # Steinsockel bis Z1, Fachwerk bis Z2
b.box('stein', (0, 0, Z1 / 2), (W, D, Z1))
b.box('stein_dunkel', (0, 0, 0.06), (W + 0.08, D + 0.08, 0.12))
# Tür mit Rundbogen und Steinrahmen
b.box('tuer', (0, -D / 2 - 0.02, 0.37), (0.48, 0.05, 0.62))
b.cyl('tuer', (0, -D / 2 - 0.02, 0.68), 0.24, 0.24, 0.05, seg=12, axis='Y')
for k in range(9):
    a = math.pi * k / 8
    b.box('stein_dunkel', (math.cos(a) * 0.32, -D / 2 - 0.04, 0.68 + math.sin(a) * 0.32), (0.13, 0.06, 0.1), ry=-a + math.pi / 2)
for sx in (-1, 1):
    b.box('stein_dunkel', (sx * 0.32, -D / 2 - 0.04, 0.37), (0.12, 0.06, 0.62))
    # Laternen neben der Tür
    b.box('eisen', (sx * 0.55, -D / 2 - 0.08, 0.82), (0.12, 0.1, 0.16))
    b.box('glas', (sx * 0.55, -D / 2 - 0.09, 0.8), (0.08, 0.1, 0.1))
b.box('stein_dunkel', (0, -D / 2 - 0.15, 0.04), (0.6, 0.26, 0.08))
window(b, W / 2, 0.25, 0.6, (1, 0), w=0.22, h=0.28, frame='stein_dunkel')
window(b, 0.75, -D / 2, 0.6, (0, -1), w=0.22, h=0.28, frame='stein_dunkel')

# Fachwerk-Obergeschoss, leicht auskragend
b.box('balken', (0, 0, Z1 + 0.05), (W + 0.16, D + 0.16, 0.1))
b.box('putz', (0, 0, (Z1 + Z2) / 2 + 0.05), (W + 0.08, D + 0.08, Z2 - Z1 - 0.1))
b.box('balken', (0, 0, Z2), (W + 0.16, D + 0.16, 0.1))
for sy in (-1, 1):
    y = sy * (D / 2 + 0.05)
    for x in (-W / 2, -0.38, 0.38, W / 2):
        b.box('balken', (x, y, (Z1 + Z2) / 2), (0.1, 0.05, Z2 - Z1))
    b.box('balken', (0, y, Z1 + 0.32), (W, 0.05, 0.06))
for sx in (-1, 1):
    x = sx * (W / 2 + 0.05)
    for y in (-D / 2, 0, D / 2):
        b.box('balken', (x, y, (Z1 + Z2) / 2), (0.05, 0.1, Z2 - Z1))
    b.beam('balken', (x, -D / 2 + 0.05, Z1 + 0.1), (x, -0.05, Z2 - 0.05), 0.07)
    b.beam('balken', (x, D / 2 - 0.05, Z1 + 0.1), (x, 0.05, Z2 - 0.05), 0.07)
    window(b, x, 0.4 * -sx, 1.55, (sx, 0), w=0.22, h=0.26, shutters='laden')
for x in (-0.72, 0.72):
    window(b, x, -D / 2 - 0.06, 1.55, (0, -1), w=0.22, h=0.26, shutters='laden')
    window(b, x, D / 2 + 0.06, 1.55, (0, 1), w=0.22, h=0.26, shutters='laden')

# Dach mit Zwerchgiebel vorn
pitch = math.radians(42)
b.gable_wall('putz', W + 0.08, D + 0.08, Z2 + 0.04, Z2 + 0.04 + (D / 2 + 0.13) * math.tan(pitch))
apex = b.gable_roof('dach', W, D + 0.08, Z2 + 0.04, pitch, over=0.2, key2='dach_dunkel')
b.box('dach_dunkel', (0, 0, apex + 0.1), (W + 0.44, 0.16, 0.1))
# Schornstein
b.box('stein', (0.7, 0.35, apex - 0.05), (0.28, 0.28, 0.75))
b.box('stein_dunkel', (0.7, 0.35, apex + 0.34), (0.34, 0.34, 0.06))

# Aushängeschild mit Bierkrug links
b.box('balken', (-W / 2 - 0.3, -D / 2 + 0.2, Z1 + 0.5), (0.65, 0.07, 0.07))
b.beam('balken', (-W / 2 - 0.02, -D / 2 + 0.2, Z1 + 0.2), (-W / 2 - 0.35, -D / 2 + 0.2, Z1 + 0.48), 0.05)
for dx in (-0.12, 0.12):
    b.box('eisen', (-W / 2 - 0.45 + dx, -D / 2 + 0.2, Z1 + 0.4), (0.02, 0.02, 0.18))
b.hull('schild', [(-W / 2 - 0.45 + x, -D / 2 + 0.2 + dy, Z1 + z) for dy in (-0.03, 0.03) for x, z in ((-0.2, 0.3), (0.2, 0.3), (0.2, -0.05), (0, -0.18), (-0.2, -0.05))])
for dy in (-0.045, 0.045):
    b.box('bier', (-W / 2 - 0.47, -D / 2 + 0.2 + dy, Z1 + 0.07), (0.15, 0.02, 0.2))
    b.box('schaum', (-W / 2 - 0.47, -D / 2 + 0.2 + dy, Z1 + 0.19), (0.17, 0.02, 0.06))

# Bänke und Fässer
bench(b, (-0.85, -D / 2 - 0.45, 0), 0.7, wood='holz', legs='balken')
bench(b, (0.85, -D / 2 - 0.55, 0), 0.7, wood='holz', legs='balken')
barrel(b, (0.5, -D / 2 - 0.2, 0), wood='holz', iron='eisen')
barrel(b, (0.85, -D / 2 - 0.15, 0), r=0.12, h=0.26, wood='holz', iron='eisen')
b.finish('tavern')
