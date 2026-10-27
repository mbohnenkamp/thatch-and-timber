# Denkmal nach entwuerfe/Denkmal.png — baut Szene "Denkmal"
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau

b = Bau('Denkmal', 'monument', {
    'stein': '#e2d3b6', 'stein_dunkel': '#cdbb98', 'gold': ('#d9a23a', 0.4, 0.3), 'holz': '#9a5a2e', 'fahne': '#c8473a',
})

# Gestufter Sockel
z = 0
for w, h in ((2.5, 0.28), (2.0, 0.28), (1.5, 0.28)):
    b.box('stein', (0, 0, z + h / 2), (w, w, h))
    b.box('stein_dunkel', (0, 0, z + h - 0.01), (w + 0.02, w + 0.02, 0.02))
    z += h
# Obelisk in drei Stücken, nach oben schmaler
r0, r1, H = 0.36, 0.22, 3.0
for k in range(3):
    za, zb = z + H * k / 3, z + H * (k + 1) / 3
    ra, rb = r0 + (r1 - r0) * k / 3, r0 + (r1 - r0) * (k + 1) / 3
    b.hull('stein', [(sx * r, sy * r, zz) for sx in (-1, 1) for sy in (-1, 1) for r, zz in ((ra, za), (rb, zb - 0.015))])
    b.box('stein_dunkel', (0, 0, zb - 0.008), (2 * rb + 0.01, 2 * rb + 0.01, 0.016))
b.hull('gold', [(sx * r1, sy * r1, z + H) for sx in (-1, 1) for sy in (-1, 1)] + [(0, 0, z + H + 0.42)])

# Fahnen an den Ecken auf kleinen Sockeln
for sx in (-1, 1):
    for sy in (-1, 1):
        x, y = sx * 1.25, sy * 1.25
        b.box('stein', (x, y, 0.2), (0.3, 0.3, 0.4))
        b.cyl('holz', (x, y, 1.05), 0.035, 0.035, 1.3, seg=8)
        b.cyl('gold', (x, y, 1.75), 0.06, 0.0, 0.16, seg=4)
        b.box('gold', (x, y, 0.42), (0.1, 0.1, 0.05))
        # Wimpel zeigt nach außen, leicht geknickt
        d = math.atan2(sy, sx)
        ux, uy = math.cos(d), math.sin(d)
        pts = []
        for t in (-0.01, 0.01):
            px, py = -uy * t, ux * t
            pts += [(x + px + ux * a, y + py + uy * a, zz) for a, zz in ((0.04, 1.62), (0.5, 1.5), (0.04, 1.2))]
        b.hull('fahne', pts)
b.finish('monument')
