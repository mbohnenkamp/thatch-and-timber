# Rathaus nach entwuerfe/Rathaus.png — in Blender ausführen, baut Szene "Rathaus" neu
# Vorderseite (Tür) zeigt nach -Y, wird im Spiel zu +Z
import bpy, bmesh, math
from mathutils import Vector, Matrix

sc = bpy.data.scenes.get('Rathaus') or bpy.data.scenes.new('Rathaus')
if bpy.context.window:
    bpy.context.window.scene = sc
for o in list(sc.objects):
    bpy.data.objects.remove(o)


def mat(name, hexc, rough=0.9, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    h = hexc.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*c, 1)
    return m


MATS = {
    'stein': mat('rathaus_stein', '#e6d9bb'),
    'stein_dunkel': mat('rathaus_stein_dunkel', '#c9b893'),
    'putz': mat('rathaus_putz', '#f3ebd9'),
    'balken': mat('rathaus_balken', '#76502f'),
    'holz_hell': mat('rathaus_holz_hell', '#9c8263'),
    'dach': mat('rathaus_dach', '#cc4a3b'),
    'dach_dunkel': mat('rathaus_dach_dunkel', '#a93b2f'),
    'laden': mat('rathaus_laden', '#7c3f22'),
    'glas': mat('rathaus_glas', '#2f4357', 0.3),
    'tuer': mat('rathaus_tuer', '#8f5a32'),
    'eisen': mat('rathaus_eisen', '#3a3634', 0.6),
    'gold': mat('rathaus_gold', '#d9a23a', 0.4, 0.3),
    'zifferblatt': mat('rathaus_zifferblatt', '#efe6d2'),
    'rot': mat('rathaus_rot', '#c23a30'),
    'weiss': mat('rathaus_weiss', '#f6f0e4'),
}
BM = {k: bmesh.new() for k in MATS}


def box(key, c, size, rz=0.0, rx=0.0, ry=0.0):
    m = Matrix.Translation(Vector(c)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(BM[key], size=1, matrix=m)


def cyl(key, c, r1, r2, depth, seg=8, axis='Z', rz=0.0):
    rot = {'Z': Matrix(), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
    bmesh.ops.create_cone(BM[key], cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth,
                          matrix=Matrix.Translation(Vector(c)) @ Matrix.Rotation(rz, 4, 'Z') @ rot)


def hull(key, pts):
    bm = BM[key]
    vs = [bm.verts.new(p) for p in set(pts)]
    bmesh.ops.convex_hull(bm, input=vs)


def beam(key, a, b, t):
    # Balken von Punkt a nach Punkt b (beide in der Ebene einer Wand), Querschnitt t
    a, b = Vector(a), Vector(b)
    d = b - a
    hull(key, [tuple(p + Vector(o)) for p in (a, b) for o in
               [(dx, dy, dz) for dx in (-t / 2, t / 2) for dy in (-t / 2, t / 2) for dz in (-t / 2, t / 2)]])


W, D = 4.6, 2.4
X, Y = W / 2, D / 2
Z0, Z1, Z2, Z3 = 0.22, 1.5, 1.62, 2.8        # Sockel, Erdgeschoss, Balkenlage, Traufe
PITCH = math.radians(40)
APEX = Z3 + 0.1 + (Y + 0.06) * math.tan(PITCH)

# --- Erdgeschoss aus Stein ---
box('stein_dunkel', (0, 0, Z0 / 2), (W + 0.14, D + 0.14, Z0))
box('stein', (0, 0, (Z0 + Z1) / 2), (W, D, Z1 - Z0))
# Eckquader, abwechselnd lang und kurz
for sx in (-1, 1):
    for sy in (-1, 1):
        for i, z in enumerate([Z0 + 0.14 + k * 0.26 for k in range(5)]):
            long_ = i % 2 == 0
            box('stein_dunkel', (sx * (X - (0.2 if long_ else 0.13) + 0.02), sy * (Y - 0.13 + 0.02), z), (0.4 if long_ else 0.26, 0.26, 0.22))
            box('stein_dunkel', (sx * (X - 0.13 + 0.02), sy * (Y - (0.13 if long_ else 0.2) + 0.02), z), (0.26, 0.26 if long_ else 0.4, 0.22))

# Tür mit Rundbogen
door_w, door_top = 0.8, 0.98
box('tuer', (0, -Y - 0.02, (Z0 + door_top) / 2), (door_w, 0.06, door_top - Z0))
cyl('tuer', (0, -Y - 0.02, door_top), door_w / 2, door_w / 2, 0.06, seg=16, axis='Y')
box('balken', (0, -Y - 0.055, (Z0 + door_top + door_w / 2) / 2), (0.03, 0.01, door_top + door_w / 2 - Z0 - 0.04))
for z in (0.45, 0.85):
    box('eisen', (0, -Y - 0.06, z), (door_w - 0.06, 0.012, 0.05))
for sx in (-0.08, 0.08):
    cyl('eisen', (sx, -Y - 0.065, 0.66), 0.045, 0.045, 0.012, seg=10, axis='Y')
for sx in (-1, 1):
    for k in range(3):
        box('stein_dunkel', (sx * (door_w / 2 + 0.09), -Y - 0.04, Z0 + 0.13 + k * 0.25), (0.2 if k % 2 else 0.16, 0.1, 0.24))
for k in range(9):
    a = math.pi * k / 8
    r = door_w / 2 + 0.09
    box('stein_dunkel', (math.cos(a) * r, -Y - 0.04, door_top + math.sin(a) * r), (0.18, 0.1, 0.13), ry=-a + math.pi / 2)
# Stufen
box('stein_dunkel', (0, -Y - 0.32, 0.06), (1.5, 0.5, 0.12))
box('stein_dunkel', (0, -Y - 0.2, 0.17), (1.25, 0.28, 0.12))


def window(cx, cy, cz, face, w=0.3, h=0.36, shutters=False, frame='stein_dunkel'):
    # face: Richtung der Wand nach außen, (0,-1) vorn, (1,0) rechts ...
    fx, fy = face
    along = (abs(fy), abs(fx))      # Richtung entlang der Wand
    def at(u, out):
        return (cx + along[0] * u + fx * out, cy + along[1] * u + fy * out)
    size = lambda a, b: (along[0] * a + abs(fx) * b, along[1] * a + abs(fy) * b)
    p = at(0, 0.025)
    box(frame, (*p, cz), (*size(w + 0.1, 0.05), h + 0.1))
    p = at(0, 0.05)
    box('glas', (*p, cz), (*size(w, 0.02), h))
    box('balken', (*p, cz), (*size(0.03, 0.03), h))
    box('balken', (*p, cz), (*size(w, 0.03), 0.03))
    if shutters:
        for s in (-1, 1):
            p = at(s * (w / 2 + 0.1), 0.05)
            box('laden', (*p, cz), (*size(0.14, 0.03), h + 0.06))


for x in (-X * 0.66, X * 0.66):
    window(x, -Y, 0.95, (0, -1))
    window(x, Y, 0.95, (0, 1))
for s in (-1, 1):
    window(s * X, 0.45, 0.95, (s, 0))

# --- Obergeschoss in Fachwerk ---
box('balken', (0, 0, (Z1 + Z2) / 2), (W + 0.16, D + 0.16, Z2 - Z1))
box('putz', (0, 0, (Z2 + Z3) / 2), (W + 0.06, D + 0.06, Z3 - Z2))
box('balken', (0, 0, Z3 + 0.05), (W + 0.16, D + 0.16, 0.1))
MID = X * 0.6
posts = [-X - 0.02, -MID, -0.55, 0.55, MID, X + 0.02]
for sy in (-1, 1):
    y = sy * (Y + 0.05)
    for x in posts:
        box('balken', (x, y, (Z2 + Z3) / 2), (0.1, 0.05, Z3 - Z2))
    box('balken', (0, y, Z2 + 0.32), (W, 0.05, 0.07))     # Brüstungsriegel
    # Streben: Wappenfeld und äußere Felder
    for a, b in (((-0.5, Z2), (-0.12, Z3)), ((0.5, Z2), (0.12, Z3))):
        beam('balken', (a[0], y, a[1]), (b[0], y, b[1]), 0.07)
for sx in (-1, 1):
    x = sx * (X + 0.05)
    for y in (-Y, -0.45, 0.45, Y):
        box('balken', (x, y, (Z2 + Z3) / 2), (0.05, 0.1, Z3 - Z2))
    box('balken', (x, 0, Z2 + 0.32), (0.05, D, 0.07))
    beam('balken', (x, -Y, Z2 + 0.3), (x, -0.5, Z3), 0.07)
    beam('balken', (x, Y, Z2 + 0.3), (x, 0.5, Z3), 0.07)
    window(sx * (X + 0.03), 0, 2.2, (sx, 0), shutters=True, frame='balken')
for x in (-(X + MID) / 2, -(MID + 0.55) / 2, (MID + 0.55) / 2, (X + MID) / 2):
    window(x, -Y - 0.03, 2.2, (0, -1), w=0.28, h=0.34, shutters=True, frame='balken')
    window(x, Y + 0.03, 2.2, (0, 1), w=0.28, h=0.34, shutters=True, frame='balken')

# Wappen über der Tür: roter Schild mit weißem Turm
sy = -Y - 0.09
hull('rot', [(x, sy + dy, z) for dy in (0, 0.04) for x, z in
             ((-0.26, 2.62), (0.26, 2.62), (0.26, 2.3), (0.18, 2.12), (0.0, 2.0), (-0.18, 2.12), (-0.26, 2.3))])
box('weiss', (0, sy - 0.01, 2.3), (0.16, 0.02, 0.26))
for x in (-0.06, 0.0, 0.06):
    box('weiss', (x, sy - 0.01, 2.46), (0.04, 0.02, 0.06))

# --- Giebel und Dach ---
for sx in (-1, 1):
    x = sx * (X + 0.03)
    hull('putz', [(x + dx, y, z) for dx in (-0.04, 0.04) for y, z in ((-Y - 0.06, Z3 + 0.1), (Y + 0.06, Z3 + 0.1), (0, APEX))])
    xo = x + sx * 0.05
    box('balken', (xo, 0, (Z3 + 0.1 + APEX) / 2), (0.05, 0.1, APEX - Z3 - 0.1))
    beam('balken', (xo, -0.9, Z3 + 0.1), (xo, 0, APEX - 0.15), 0.07)
    beam('balken', (xo, 0.9, Z3 + 0.1), (xo, 0, APEX - 0.15), 0.07)
    # Giebelpfosten an den Firstenden
    box('holz_hell', (sx * (X + 0.12), 0, APEX + 0.12), (0.2, 0.2, 0.42))
    box('balken', (sx * (X + 0.12), 0, APEX + 0.35), (0.25, 0.25, 0.05))

L = (Y + 0.06) / math.cos(PITCH) + 0.32
for s, key in ((-1, 'dach'), (1, 'dach_dunkel')):
    ridge = Vector((0, 0, APEX + 0.08))
    down = Vector((0, s * math.cos(PITCH), -math.sin(PITCH)))
    c = ridge + down * (L / 2) + Vector((0, s * math.sin(PITCH), math.cos(PITCH))) * 0.06
    box(key, c, (W + 0.44, L, 0.12), rx=-s * PITCH)
box('dach_dunkel', (0, 0, APEX + 0.16), (W + 0.48, 0.18, 0.1))

# --- Dachreiter mit Uhr und Glocke ---
T = 0.72
tz0 = APEX - 0.3
box('holz_hell', (0, 0, tz0 + 0.55), (T, T, 1.1))
box('balken', (0, 0, tz0 + 1.12), (T + 0.08, T + 0.08, 0.08))
cyl('balken', (0, -T / 2 - 0.02, tz0 + 0.62), 0.3, 0.3, 0.04, seg=20, axis='Y')
cyl('zifferblatt', (0, -T / 2 - 0.045, tz0 + 0.62), 0.25, 0.25, 0.02, seg=20, axis='Y')
box('eisen', (0.06, -T / 2 - 0.06, tz0 + 0.66), (0.13, 0.01, 0.025), ry=-0.6)
box('eisen', (-0.05, -T / 2 - 0.06, tz0 + 0.68), (0.025, 0.01, 0.15), ry=0.5)
cz = tz0 + 1.16
for sx in (-1, 1):
    for sy in (-1, 1):
        box('holz_hell', (sx * (T / 2 - 0.06), sy * (T / 2 - 0.06), cz + 0.3), (0.1, 0.1, 0.6))
box('balken', (0, 0, cz + 0.63), (T + 0.08, T + 0.08, 0.07))
cyl('gold', (0, 0, cz + 0.3), 0.19, 0.08, 0.32, seg=12)
cyl('gold', (0, 0, cz + 0.49), 0.05, 0.05, 0.08, seg=8)
cyl('dach', (0, 0, cz + 1.05), (T + 0.2) / math.sqrt(2) * 1.05, 0.0, 0.8, seg=4, rz=math.pi / 4)
cyl('eisen', (0, 0, cz + 1.6), 0.025, 0.025, 0.3, seg=6)
cyl('eisen', (0, 0, cz + 1.8), 0.06, 0.0, 0.16, seg=6)

# --- Fahnen links und rechts der Tür ---
for sx in (-1, 1):
    x, y = sx * 0.78, -Y - 0.28
    box('stein_dunkel', (x, y, 0.12), (0.2, 0.2, 0.24))
    cyl('balken', (x, y, 1.05), 0.028, 0.028, 1.65, seg=8)
    cyl('eisen', (x, y, 1.93), 0.05, 0.0, 0.12, seg=6)
    hull('rot', [(x + sx * dx, y + dy, z) for dy in (-0.01, 0.01) for dx, z in
                 ((0.03, 1.8), (0.27, 1.8), (0.27, 1.22), (0.15, 1.32), (0.03, 1.22))])

root = bpy.data.objects.new('townhall', None)
sc.collection.objects.link(root)
for k, bm in BM.items():
    if not bm.verts:
        bm.free()
        continue
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    me = bpy.data.meshes.new('townhall_' + k)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(MATS[k])
    o = bpy.data.objects.new('townhall_' + k, me)
    sc.collection.objects.link(o)
    o.parent = root
