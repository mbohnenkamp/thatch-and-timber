# Schmelzhütte nach entwuerfe/Schmelzhuette.png — baut Szene "Schmelzhuette"
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau, window

b = Bau('Schmelzhuette', 'smelter', {
    'stein': '#d5c8ae', 'stein_dunkel': '#b3a58b', 'ofen': '#c9c1b2', 'ofen_dunkel': '#a49c8e', 'balken': '#6e4423',
    'dach': '#c8553a', 'dach_dunkel': '#a8432d', 'tuer': '#7a4a28', 'glas': '#2f4357', 'eisen': '#4e4a47',
    'glut': ('#ff8a2a', 0.6, 0.0, 3.0), 'dunkel': '#2a1a12', 'erz': '#a8442f', 'kohle': '#2b2826', 'erde': '#b99a6a',
})

# --- Haus (lokal um seine Mitte gebaut) ---
W, D, H = 2.3, 1.5, 0.95
b.o.x, b.o.y = -0.35, 0.35
b.box('stein', (0, 0, H / 2), (W, D, H))
b.box('stein_dunkel', (0, 0, 0.07), (W + 0.08, D + 0.08, 0.14))
for dx in (-W / 2, -0.2, W / 2):
    for dy in (-D / 2, D / 2):
        b.box('balken', (dx, dy, H / 2), (0.12, 0.12, H))
        b.box('stein_dunkel', (dx, dy, 0.1), (0.2, 0.2, 0.2))
b.box('balken', (0, 0, H + 0.04), (W + 0.12, D + 0.12, 0.09))
b.box('tuer', (-0.6, -D / 2 - 0.02, 0.38), (0.36, 0.05, 0.72))
for z in (0.2, 0.55):
    b.box('eisen', (-0.6, -D / 2 - 0.05, z), (0.3, 0.02, 0.04))
window(b, -1.0, -D / 2, 0.55, (0, -1), w=0.18, h=0.24)
pitch = math.radians(36)
b.gable_wall('stein', W, D, H + 0.08, H + 0.08 + (D / 2 + 0.09) * math.tan(pitch))
apex = b.gable_roof('dach', W, D, H + 0.08, pitch, over=0.18, key2='dach_dunkel')
b.box('balken', (0, 0, apex + 0.08), (W + 0.4, 0.14, 0.12))
for sx in (-1, 1):
    b.box('balken', (sx * (W / 2 + 0.22), 0, apex + 0.1), (0.14, 0.16, 0.22))
b.o.x = b.o.y = 0

# --- Ofen vorn rechts ---
ox, oy = 0.75, -0.55
b.box('ofen_dunkel', (ox, oy, 0.08), (1.25, 1.1, 0.16))
b.hull('ofen', [(ox + dx * w, oy + dy * d, z) for dx in (-1, 1) for dy in (-1, 1) for w, d, z in ((0.58, 0.5, 0.16), (0.48, 0.42, 1.05))])
b.box('eisen', (ox, oy, 1.02), (1.0, 0.88, 0.1))
for dx in (-0.4, 0.4):
    b.box('eisen', (ox + dx, oy - 0.45, 1.02), (0.06, 0.03, 0.06))
# Feueröffnung mit Bogen
b.box('dunkel', (ox, oy - 0.43, 0.42), (0.5, 0.06, 0.5))
b.cyl('dunkel', (ox, oy - 0.43, 0.67), 0.25, 0.25, 0.06, seg=12, axis='Y')
for i in range(5):
    b.rock('glut', (ox - 0.16 + i * 0.08, oy - 0.5, 0.18), 0.07, 0.06, n=6)
for k in range(9):
    a = math.pi * k / 8
    b.box('ofen_dunkel', (ox + math.cos(a) * 0.32, oy - 0.47, 0.67 + math.sin(a) * 0.32), (0.13, 0.06, 0.1), ry=-a + math.pi / 2)
# Schlot, nach oben schmaler
b.hull('ofen', [(ox + dx * w, oy + dy * w, z) for dx in (-1, 1) for dy in (-1, 1) for w, z in ((0.42, 1.07), (0.24, 1.6))])
b.box('ofen', (ox, oy, 2.15), (0.42, 0.42, 1.1))
for z in (1.75, 2.1, 2.45):
    b.box('ofen_dunkel', (ox, oy, z), (0.44, 0.44, 0.04))
b.box('eisen', (ox, oy, 2.75), (0.5, 0.5, 0.12))
b.box('dunkel', (ox, oy, 2.8), (0.3, 0.3, 0.06))

# --- Haufen ---
b.box('erde', (0, -1.0, 0.01), (2.4, 0.7, 0.02))
for x, y, r in ((-0.9, -0.95, 0.2), (-1.15, -1.1, 0.15), (-0.7, -1.15, 0.13), (-1.05, -0.75, 0.14), (-0.85, -0.7, 0.12)):
    b.rock('kohle', (x, y, 0), r * 1.5, r * 1.6, n=9)
for x, y, r in ((1.55, -1.1, 0.2), (1.75, -0.85, 0.15), (1.3, -1.3, 0.13), (1.75, -1.3, 0.12)):
    b.rock('erz', (x, y, 0), r * 1.5, r * 1.6, n=9)
b.finish('smelter')
