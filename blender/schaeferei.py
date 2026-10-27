# Schäferhütte nach entwuerfe/Schaeferhuette.png — baut Szene "Schaeferei"
# Der Pferch ist Teil des Modells; das Spiel lässt seinen eigenen Zaun dann weg.
import sys, os, math, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau, window

b = Bau('Schaeferei', 'sheepfarm', {
    'holz': '#8f6238', 'holz_hell': '#a7774a', 'balken': '#6e4423', 'stein': '#8e8a84', 'stroh': '#e6bf4a',
    'stroh_dunkel': '#cfa53a', 'tuer': '#7a4a28', 'glas': '#2f4357', 'eisen': '#3c3a38', 'erde': '#a58556', 'heu': '#e9c552',
})

# --- Hütte links ---
W, D, H = 1.5, 1.4, 0.95
b.o.x, b.o.y = -0.8, 0.0
b.box('stein', (0, 0, 0.11), (W + 0.06, D + 0.06, 0.22))
b.box('holz', (0, 0, 0.22 + (H - 0.22) / 2), (W, D, H - 0.22))
for z in (0.42, 0.62, 0.82):
    b.box('holz_hell', (0, -D / 2 - 0.01, z), (W, 0.02, 0.03))
for dx in (-W / 2, W / 2):
    for dy in (-D / 2, D / 2):
        b.box('balken', (dx, dy, H / 2 + 0.1), (0.12, 0.12, H - 0.2))
b.box('balken', (0, 0, H), (W + 0.1, D + 0.1, 0.08))
b.box('tuer', (-0.25, -D / 2 - 0.02, 0.55), (0.36, 0.05, 0.66))
for z in (0.35, 0.72):
    b.box('eisen', (-0.25, -D / 2 - 0.05, z), (0.3, 0.02, 0.035))
b.box('holz', (-0.25, -D / 2 - 0.18, 0.08), (0.46, 0.26, 0.08))
window(b, 0.35, -D / 2, 0.62, (0, -1), w=0.24, h=0.24)
pitch = math.radians(38)
b.gable_wall('holz', W, D, H + 0.04, H + 0.04 + (W / 2 + 0.05) * math.tan(pitch), along='Y')
apex = b.gable_roof('stroh', W, D, H + 0.04, pitch, over=0.16, thick=0.2, key2='stroh_dunkel', along='Y')
# Zottiger Rand: kleine Stroh-Zacken an der Traufe
for s in (-1, 1):
    for i in range(7):
        y = -D / 2 - 0.2 + i * (D + 0.4) / 6
        b.box('stroh_dunkel', (s * (W / 2 + 0.16), y, H - 0.02), (0.14, 0.12, 0.12), rz=0.3 * i)
b.cyl('balken', (0, 0, apex + 0.1), 0.1, 0.1, D + 0.6, seg=6, axis='Y')
b.o.x = b.o.y = 0

# --- Pferch rechts ---
px0, px1, py0, py1 = 0.15, 1.85, -0.75, 0.95
b.box('erde', ((px0 + px1) / 2, (py0 + py1) / 2, 0.01), (px1 - px0, py1 - py0, 0.02))
corners = [(px0, py0), (px1, py0), (px1, py1), (px0, py1)]
for i in range(4):
    a, c = mathutils.Vector((*corners[i], 0)), mathutils.Vector((*corners[(i + 1) % 4], 0))
    if i == 3:
        continue                      # zur Hütte hin offen
    steps = max(1, round((c - a).length / 0.55))
    for k in range(steps + 1):
        p = a.lerp(c, k / steps)
        b.box('balken', (p.x, p.y, 0.3), (0.1, 0.1, 0.6))
    for z in (0.28, 0.5):
        b.beam('holz', (a.x, a.y, z), (c.x, c.y, z), 0.06)

# --- Heu, Schemel, Eimer ---
for x, y, z in ((-1.55, -1.05, 0), (-1.2, -1.15, 0), (-1.4, -1.1, 0.24)):
    b.box('heu', (x, y, z + 0.12), (0.34, 0.24, 0.24))
    b.box('balken', (x, y, z + 0.12), (0.03, 0.25, 0.25))
b.cyl('holz', (-0.6, -1.0, 0.24), 0.11, 0.11, 0.04, seg=8)
for a in (0, 2.1, 4.2):
    b.box('balken', (-0.6 + math.cos(a) * 0.07, -1.0 + math.sin(a) * 0.07, 0.11), (0.03, 0.03, 0.22))
b.cyl('holz', (-0.25, -1.05, 0.11), 0.1, 0.08, 0.22, seg=10)
b.cyl('eisen', (-0.25, -1.05, 0.18), 0.105, 0.105, 0.025, seg=10)
b.finish('sheepfarm')
