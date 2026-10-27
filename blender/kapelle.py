# Kapelle nach entwuerfe/Kapelle.png — baut Szene "Kapelle"
# Turm vorn links mit Tür, Schiff nach hinten, Dachfirst längs (Y)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau

b = Bau('Kapelle', 'chapel', {
    'stein': '#e8d6b0', 'stein_dunkel': '#d2bd94', 'dach': '#c0503a', 'dach_dunkel': '#a3402d', 'tuer': '#9a5a2e',
    'glas': '#33475c', 'eisen': '#4a4744', 'glocke': ('#6b6762', 0.5, 0.6), 'holz': '#8a5a32', 'gold': ('#c9a24a', 0.4, 0.3),
})


def lancet(cx, cy, cz, face, w=0.14, h=0.42):
    # Spitzbogenfenster: Rahmen und Glas, oben spitz
    fx, fy = face
    for key, ww, hh, out in (('stein_dunkel', w + 0.08, h + 0.08, 0.02), ('glas', w, h, 0.04)):
        pts = []
        for d in (out - 0.015, out + 0.015):
            for u, z in ((-ww / 2, -hh / 2), (ww / 2, -hh / 2), (ww / 2, hh / 2 - ww / 2), (0, hh / 2), (-ww / 2, hh / 2 - ww / 2)):
                pts.append((cx + abs(fy) * u + fx * d, cy + abs(fx) * u + fy * d, cz + z))
        b.hull(key, pts)


# --- Schiff ---
NW, NL, NH = 1.4, 2.3, 1.25
ny0 = -0.55                       # Vorderkante des Schiffs (Turm steht davor)
b.o.x, b.o.y = 0.35, ny0 + NL / 2
b.box('stein', (0, 0, NH / 2), (NW, NL, NH))
b.box('stein_dunkel', (0, 0, 0.06), (NW + 0.08, NL + 0.08, 0.12))
for sx in (-1, 1):
    for y in (-NL / 2 + 0.05, -0.1, NL / 2 - 0.05):
        b.hull('stein_dunkel', [(sx * (NW / 2 + dx), y + dy, z) for dy in (-0.11, 0.11) for dx, z in ((0, 0), (0.22, 0), (0.22, 0.45), (0.1, 0.95), (0, 0.95))])
    for y in (-0.6, 0.45):
        lancet(sx * (NW / 2), y, 0.72, (sx, 0))
pitch = math.radians(45)
b.gable_wall('stein', NW, NL, NH, NH + (NW / 2 + 0.07) * math.tan(pitch), along='Y')
apex = b.gable_roof('dach', NW, NL, NH, pitch, over=0.14, key2='dach_dunkel', along='Y')
for sy in (-1, 1):
    b.hull('stein_dunkel', [(x, sy * (NL / 2 + 0.04) + dy, z) for dy in (-0.05, 0.05) for x, z in ((-NW / 2 - 0.08, NH), (-NW / 2, NH), (0, apex + 0.08), (NW / 2, NH), (NW / 2 + 0.08, NH), (0, apex + 0.16))])
b.o.x = b.o.y = 0

# --- Turm ---
T, TH = 0.95, 2.0
tx, ty = -0.45, -0.75
b.o.x, b.o.y = tx, ty
b.box('stein', (0, 0, TH / 2), (T, T, TH))
b.box('stein_dunkel', (0, 0, 0.08), (T + 0.14, T + 0.14, 0.16))
for sx in (-1, 1):
    b.hull('stein_dunkel', [(sx * (T / 2 + dx), -T / 2 + dy, z) for dy in (-0.12, 0.12) for dx, z in ((0, 0), (0.18, 0), (0.18, 0.5), (0.06, 1.0), (0, 1.0))])
# Tür mit Rundbogen
b.box('tuer', (0, -T / 2 - 0.02, 0.38), (0.36, 0.05, 0.56))
b.cyl('tuer', (0, -T / 2 - 0.02, 0.66), 0.18, 0.18, 0.05, seg=12, axis='Y')
for k in range(9):
    a = math.pi * k / 8
    b.box('stein_dunkel', (math.cos(a) * 0.25, -T / 2 - 0.04, 0.66 + math.sin(a) * 0.25), (0.11, 0.06, 0.09), ry=-a + math.pi / 2)
for sx in (-1, 1):
    b.box('stein_dunkel', (sx * 0.25, -T / 2 - 0.04, 0.38), (0.1, 0.06, 0.56))
for z in (0.25, 0.55):
    b.box('eisen', (0, -T / 2 - 0.05, z), (0.28, 0.02, 0.03))
b.box('stein_dunkel', (0, -T / 2 - 0.2, 0.04), (0.6, 0.3, 0.08))
lancet(0, -T / 2, 1.35, (0, -1), w=0.12, h=0.3)
b.box('stein_dunkel', (0, 0, TH + 0.04), (T + 0.12, T + 0.12, 0.08))
# Glockenstube: vier Eckpfeiler, Glocke am Balken
BH = 0.7
for sx in (-1, 1):
    for sy in (-1, 1):
        b.box('stein', (sx * (T / 2 - 0.1), sy * (T / 2 - 0.1), TH + 0.08 + BH / 2), (0.2, 0.2, BH))
for face in ((0, -1), (0, 1), (1, 0), (-1, 0)):
    fx, fy = face
    b.cyl('stein', (fx * (T / 2 - 0.1), fy * (T / 2 - 0.1), TH + 0.08 + BH - 0.12), 0.27, 0.27, 0.2, seg=12, axis='Y' if fy else 'X')
b.box('stein_dunkel', (0, 0, TH + 0.08 + BH + 0.05), (T + 0.12, T + 0.12, 0.1))
b.box('holz', (0, 0, TH + 0.08 + BH - 0.15), (T - 0.2, 0.06, 0.06))
b.cyl('glocke', (0, 0, TH + 0.08 + BH - 0.35), 0.17, 0.08, 0.3, seg=12)
# Turmhelm
sz = TH + 0.08 + BH + 0.1
b.cyl('dach', (0, 0, sz + 0.06), (T + 0.32) / math.sqrt(2), (T + 0.1) / math.sqrt(2), 0.12, seg=4, rz=math.pi / 4)
b.cyl('dach_dunkel', (0, 0, sz + 0.12 + 0.6), (T + 0.1) / math.sqrt(2), 0.02, 1.2, seg=4, rz=math.pi / 4)
b.box('gold', (0, 0, sz + 1.45), (0.04, 0.04, 0.4))
b.box('gold', (0, 0, sz + 1.53), (0.2, 0.04, 0.04))
b.o.x = b.o.y = 0
b.finish('chapel')
