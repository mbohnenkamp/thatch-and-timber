# Erz- und Kohlemine nach entwuerfe/Mine.png — baut die Szenen "Erzmine" und "Kohlemine"
# (gleiches Modell, nur der Haufen vor dem Stollen hat eine andere Farbe)
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib, bau
importlib.reload(bau)
from bau import Bau, barrel, crate

COLORS = {
    'fels': '#8b8680', 'fels_dunkel': '#6f6a64', 'gras': '#7da23a', 'stein': '#d8ccb4', 'stein_dunkel': '#a99c86',
    'balken': '#6e4423', 'holz': '#8f6238', 'dach': '#c8553a', 'dach_dunkel': '#a8432d', 'tuer': '#7a4a28',
    'glas': '#2f4357', 'eisen': '#55585c', 'dunkel': '#1d1a17', 'erz': '#b5482e', 'kohle': '#2b2826',
}


def build(scene, prefix, heap):
    b = Bau(scene, prefix, COLORS)
    # --- Felshügel hinten ---
    for x, y, r, h in ((0.6, 1.0, 1.0, 2.1), (-0.3, 1.2, 0.9, 1.6), (1.5, 0.6, 0.8, 1.5), (1.2, 1.3, 0.8, 1.8),
                       (-0.9, 0.9, 0.7, 1.2), (0.2, 0.4, 0.75, 1.3), (1.75, -0.1, 0.5, 0.8), (-0.4, 0.4, 0.6, 1.0)):
        b.rock('fels' if r > 0.7 else 'fels_dunkel', (x, y, 0), r, h, n=11)
    for x, y, z, r in ((0.6, 1.0, 1.7, 0.5), (-0.3, 1.2, 1.2, 0.45), (1.2, 1.3, 1.4, 0.4), (1.5, 0.6, 1.05, 0.35)):
        b.rock('gras', (x, y, z), r, 0.22, n=8)

    # --- Stolleneingang mit Balkenrahmen ---
    sx, sy = 0.55, -0.15
    b.box('dunkel', (sx, sy + 0.25, 0.55), (0.85, 0.5, 1.1))
    for dx in (-0.5, 0.5):
        b.box('balken', (sx + dx, sy, 0.6), (0.16, 0.16, 1.2))
        b.beam('balken', (sx + dx, sy - 0.02, 0.95), (sx + dx * 0.55, sy - 0.02, 1.13), 0.08)
    b.box('balken', (sx, sy, 1.26), (1.3, 0.2, 0.16))
    # Gleis aus dem Stollen nach vorn
    for i in range(7):
        b.box('holz', (sx, sy + 0.3 - i * 0.28, 0.03), (0.6, 0.1, 0.05))
    for dx in (-0.18, 0.18):
        b.box('eisen', (sx + dx, sy - 0.55, 0.08), (0.04, 1.9, 0.04))
    # Lore
    lx, ly = sx, sy - 0.75
    b.hull('holz', [(lx + dx * w, ly + dy * d, z) for dx in (-1, 1) for dy in (-1, 1) for w, d, z in ((0.2, 0.26, 0.2), (0.27, 0.33, 0.52))])
    b.box('dunkel', (lx, ly, 0.5), (0.4, 0.52, 0.05))
    for dx in (-0.27, 0.27):
        for dy in (-0.33, 0.33):
            b.box('eisen', (lx + dx, ly + dy, 0.36), (0.04, 0.04, 0.34))
        for dy in (-0.18, 0.18):
            b.cyl('eisen', (lx + dx * 0.8, ly + dy, 0.13), 0.09, 0.09, 0.05, seg=10, axis='X')
    for i in range(4):
        b.rock(heap, (lx - 0.1 + (i % 2) * 0.18, ly - 0.08 + (i // 2) * 0.16, 0.5), 0.1, 0.08, n=7)

    # --- Haufen neben dem Stollen ---
    for x, y, r in ((1.45, -0.55, 0.32), (1.75, -0.85, 0.25), (1.2, -0.95, 0.22), (1.55, -0.2, 0.26), (1.9, -0.45, 0.18), (1.35, -1.25, 0.12), (1.85, -1.1, 0.1)):
        b.rock(heap, (x, y, 0), r * 1.3, r * 1.4, n=9)

    # --- Steinhütte links ---
    hx, hy, W, D, H = -1.1, -0.35, 1.15, 1.1, 0.85
    b.box('stein', (hx, hy, H / 2), (W, D, H))
    b.box('stein_dunkel', (hx, hy, 0.06), (W + 0.08, D + 0.08, 0.12))
    for dx in (-1, 1):
        for dy in (-1, 1):
            b.box('balken', (hx + dx * (W / 2), hy + dy * (D / 2), H / 2), (0.1, 0.1, H))
    b.box('balken', (hx, hy, H), (W + 0.1, D + 0.1, 0.08))
    b.box('tuer', (hx - 0.2, hy - D / 2 - 0.02, 0.3), (0.32, 0.05, 0.6))
    b.box('balken', (hx - 0.2, hy - D / 2 - 0.04, 0.62), (0.42, 0.05, 0.07))
    b.box('glas', (hx + 0.27, hy - D / 2 - 0.02, 0.48), (0.22, 0.04, 0.22))
    b.box('balken', (hx + 0.27, hy - D / 2 - 0.04, 0.48), (0.3, 0.03, 0.03))
    b.box('balken', (hx + 0.27, hy - D / 2 - 0.04, 0.48), (0.03, 0.03, 0.3))
    pitch = math.radians(38)
    apex = H + 0.08 + (D / 2 + 0.12) * math.tan(pitch)
    for sx_ in (-1, 1):
        x = hx + sx_ * W / 2
        b.hull('stein', [(x + dx, hy + y, z) for dx in (-0.04, 0.04) for y, z in ((-D / 2, H), (D / 2, H), (0, apex - 0.06))])
    L = (D / 2 + 0.12) / math.cos(pitch) + 0.15
    for s, k in ((-1, 'dach'), (1, 'dach_dunkel')):
        cy = hy + s * (math.cos(pitch) * L / 2)
        cz = apex + 0.04 - math.sin(pitch) * L / 2
        b.box(k, (hx, cy, cz), (W + 0.3, L, 0.1), rx=-s * pitch)
    b.box('stein_dunkel', (hx - 0.35, hy + 0.15, apex + 0.05), (0.2, 0.2, 0.5))
    barrel(b, (hx + 0.75, hy - 0.55, 0), wood='holz', iron='eisen')
    crate(b, (hx + 0.35, hy - 0.8, 0), 0.24, wood='holz', dark='balken')
    b.finish(prefix)


build('Erzmine', 'mine_ore', 'erz')
build('Kohlemine', 'mine_coal', 'kohle')
