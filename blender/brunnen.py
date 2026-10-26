# Dorfbrunnen nach entwuerfe/Dorfbrunnen.png — in Blender ausführen, baut Szene "Brunnen" neu
import bpy, bmesh, random, math
from mathutils import Vector, Matrix

rnd = random.Random(4)
sc = bpy.data.scenes.get('Brunnen') or bpy.data.scenes.new('Brunnen')
bpy.context.window.scene = sc
for o in list(sc.objects):
    bpy.data.objects.remove(o)


def mat(name, hexc, rough=0.9):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    h = hexc.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0
    m.diffuse_color = (*c, 1)
    return m


MATS = {
    'stein_hell': mat('brunnen_stein_hell', '#c9c9c6'),
    'stein_dunkel': mat('brunnen_stein_dunkel', '#a3a3a1'),
    'holz': mat('brunnen_holz', '#9a5a30'),
    'schindel_a': mat('brunnen_schindel_a', '#b8743f'),
    'schindel_b': mat('brunnen_schindel_b', '#a2612f'),
    'seil': mat('brunnen_seil', '#e3c597'),
    'eisen': mat('brunnen_eisen', '#5d6066', 0.6),
    'wasser': mat('brunnen_wasser', '#24323a', 0.2),
}
BM = {k: bmesh.new() for k in MATS}


def box(key, c, size, rz=0.0, rx=0.0, ry=0.0):
    m = Matrix.Translation(c) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(BM[key], size=1, matrix=m)


def cyl(key, c, r1, r2, depth, seg=8, axis='Z'):
    rot = {'Z': Matrix(), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
    bmesh.ops.create_cone(BM[key], cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth, matrix=Matrix.Translation(c) @ rot)


# Steinkranz: 3 Reihen versetzte Blöcke, oben eine breitere Abdeckreihe
R, N = 0.85, 12
for row in range(3):
    for i in range(N):
        a = (i + 0.5 * (row % 2)) * 2 * math.pi / N
        chord = 2 * R * math.sin(math.pi / N)
        k = 'stein_hell' if rnd.random() < 0.55 else 'stein_dunkel'
        box(k, Vector((math.cos(a) * (R - 0.12), math.sin(a) * (R - 0.12), 0.11 + row * 0.215)),
            (0.24 * rnd.uniform(0.95, 1.05), chord * 0.93, 0.2 * rnd.uniform(0.94, 1.0)), rz=a)
for i in range(N):
    a = (i + 0.25) * 2 * math.pi / N
    chord = 2 * (R + 0.04) * math.sin(math.pi / N)
    box('stein_hell', Vector((math.cos(a) * (R - 0.11), math.sin(a) * (R - 0.11), 0.72)), (0.3, chord * 0.94, 0.13), rz=a)
cyl('wasser', Vector((0, 0, 0.5)), 0.62, 0.62, 0.02, seg=16)

# Gestell: zwei Pfosten, Querbalken mit Seilrolle, Kurbel
H = 2.25
for s in (1, -1):
    box('holz', Vector((s * 0.74, 0, 0.75 + (H - 0.75) / 2 - 0.1)), (0.14, 0.14, H - 0.75 + 0.2))
    box('holz', Vector((s * 0.74, 0, H - 0.02)), (0.2, 0.9, 0.08))   # Pfette unter dem Dach
    for t in (1, -1):   # Kopfbänder
        box('holz', Vector((s * 0.74, t * 0.2, H - 0.22)), (0.07, 0.4, 0.07), rx=t * 0.75)
cyl('holz', Vector((0.08, 0, 1.55)), 0.06, 0.06, 1.86, axis='X')
for i in range(5):
    cyl('seil', Vector((-0.1 + i * 0.05, 0, 1.55)), 0.09, 0.09, 0.04, seg=10, axis='X')
box('holz', Vector((0.98, 0, 1.44)), (0.06, 0.06, 0.28))
box('holz', Vector((1.07, 0, 1.31)), (0.22, 0.06, 0.06))

# Seil und Eimer
cyl('seil', Vector((0, 0, 1.32)), 0.015, 0.015, 0.38, seg=6)
cyl('holz', Vector((0, 0, 0.98)), 0.13, 0.16, 0.26, seg=10)
for z in (0.9, 1.06):
    cyl('eisen', Vector((0, 0, z)), 0.165 if z < 1 else 0.145, 0.165 if z < 1 else 0.145, 0.03, seg=10)
for s in (1, -1):
    box('eisen', Vector((s * 0.12, 0, 1.17)), (0.02, 0.02, 0.18), ry=-s * 0.5)
box('eisen', Vector((0, 0, 1.25)), (0.12, 0.02, 0.02))

# Satteldach mit Schindeln, First entlang X
pitch = 0.62
for side in (1, -1):
    for row in range(2):
        for i in range(6):
            k = 'schindel_a' if rnd.random() < 0.5 else 'schindel_b'
            d = 0.18 + row * 0.42
            y = side * math.cos(pitch) * d
            z = H + 0.42 - math.sin(pitch) * d + rnd.uniform(-0.01, 0.01)
            box(k, Vector((-0.95 + i * 0.38, y, z)), (0.37, 0.48, 0.06), rx=-side * pitch + rnd.uniform(-0.04, 0.04))
box('holz', Vector((0, 0, H + 0.5)), (2.4, 0.14, 0.12))

root = bpy.data.objects.new('well', None)
sc.collection.objects.link(root)
for k, bm in BM.items():
    me = bpy.data.meshes.new('well_' + k)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(MATS[k])
    o = bpy.data.objects.new('well_' + k, me)
    sc.collection.objects.link(o)
    o.parent = root
