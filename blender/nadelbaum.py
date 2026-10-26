# Nadelbäume passend zu den Laubbäumen (baum.py) — in Blender ausführen, baut Szene "Nadelbaum" neu
import bpy, bmesh, random, math
from mathutils import Vector, Matrix

sc = bpy.data.scenes.get('Nadelbaum') or bpy.data.scenes.new('Nadelbaum')
bpy.context.window.scene = sc
for o in list(sc.objects):
    bpy.data.objects.remove(o)


def mat(name, hexc):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    h = hexc.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = 0.9
    b.inputs['Metallic'].default_value = 0
    m.diffuse_color = (*c, 1)
    return m


NEEDLE = mat('nadel_leaf', '#5f9e45')
PINE = mat('kiefer_leaf', '#52833c')
BARK = mat('nadel_rinde', '#7d4a2c')


def add_hull(bm, pts):
    vs = [bm.verts.new(p) for p in pts]
    r = bmesh.ops.convex_hull(bm, input=vs)
    dead = {g for g in r['geom_interior'] + r['geom_unused'] if isinstance(g, bmesh.types.BMVert)}
    if dead:
        bmesh.ops.delete(bm, geom=list(dead), context='VERTS')


def ring(c, r, n=7, rot=0, jit=0.0, rnd=None):
    return [Vector((c.x + r * (1 + (rnd.uniform(-jit, jit) if rnd else 0)) * math.cos(rot + i * 2 * math.pi / n),
                    c.y + r * (1 + (rnd.uniform(-jit, jit) if rnd else 0)) * math.sin(rot + i * 2 * math.pi / n), c.z)) for i in range(n)]


def sphere(bm, c, rad, sub, j, rnd, flat=0.8):
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=sub, radius=1)
    for v in tmp.verts:
        p = v.co.normalized() * (1 + rnd.uniform(-j, j))
        v.co = Vector((p.x * rad, p.y * rad, p.z * rad * flat)) + c
    me = bpy.data.meshes.new('tmp')
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def finish(name, root, parts):
    for bm, m, nm in parts:
        me = bpy.data.meshes.new(name + nm)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = False
        me.materials.append(m)
        o = bpy.data.objects.new(name + nm, me)
        sc.collection.objects.link(o)
        o.parent = root


def trunk(bm, H, r0, r1, lean, rnd):
    pts = [(Vector((lean.x * t * t, lean.y * t * t, t * H)), r0 + (r1 - r0) * t) for t in (k / 4 for k in range(5))]
    for (c0, a), (c1, b) in zip(pts, pts[1:]):
        add_hull(bm, ring(c0, a) + ring(c1, b))
    for i in range(3):
        a = i * 2 * math.pi / 3 + rnd.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        add_hull(bm, ring(Vector((0, 0, 0.35)), r0 * 0.7) + [d * r0 * 1.9, d * r0 * 1.5 + Vector((0, 0, 0.06)), d * r0 * 0.6])
    return pts[-1][0]


# Tanne nach entwuerfe/Nadelbaum.png: 4 Etagen mit gezackt hängendem Rand, dicker Stamm mit Wurzeln
def tanne(name, seed, ox, tiers):
    rnd = random.Random(seed)
    root = bpy.data.objects.new(name, None)
    sc.collection.objects.link(root)
    root.location = (ox, 0, 0)
    bark, leaf = bmesh.new(), bmesh.new()
    H = rnd.uniform(4.4, 4.9)
    trunk(bark, 1.4, 0.3, 0.2, Vector((0, 0, 0)), rnd)
    base = 1.05
    for k in range(tiers):
        t = k / (tiers - 1)
        z0 = base + t * (H - base - 1.6)
        r = 1.55 * (1 - t * 0.55) * rnd.uniform(0.95, 1.04)
        apex = z0 + (1.5 if k < tiers - 1 else 1.9)
        rot = rnd.uniform(0, 1)
        n = 9
        edge = []
        for i in range(2 * n):
            a = rot + i * math.pi / n
            tip = i % 2 == 0
            rr = r * (1.12 if tip else 0.84) * rnd.uniform(0.94, 1.05)
            zz = z0 + (-0.45 if tip else 0.12) + rnd.uniform(-0.05, 0.05)
            edge.append(Vector((math.cos(a) * rr, math.sin(a) * rr, zz)))
        add_hull(leaf, edge + [Vector((rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), apex))])
    finish(name, root, ((bark, BARK, '_rinde'), (leaf, NEEDLE, '_laub')))


# Kiefer: hoher kahler Stamm, kleine flache Krone aus Büscheln
def kiefer(name, seed, ox):
    rnd = random.Random(seed)
    root = bpy.data.objects.new(name, None)
    sc.collection.objects.link(root)
    root.location = (ox, 0, 0)
    bark, leaf = bmesh.new(), bmesh.new()
    H = rnd.uniform(3.2, 3.6)
    lean = Vector((rnd.uniform(-0.3, 0.3), rnd.uniform(-0.2, 0.2), 0))
    top = trunk(bark, H, 0.2, 0.1, lean, rnd)
    sphere(leaf, top + Vector((0, 0, 0.35)), 0.85, 2, 0.1, rnd, 0.55)
    for i in range(4):
        a = i * math.pi / 2 + rnd.uniform(-0.4, 0.4)
        c = top + Vector((math.cos(a) * 0.75, math.sin(a) * 0.75, rnd.uniform(-0.35, 0.15)))
        add_hull(bark, ring(top - Vector((0, 0, 0.3)), 0.07, 5) + ring(c - Vector((0, 0, 0.1)), 0.04, 5))
        sphere(leaf, c, rnd.uniform(0.48, 0.62), 2, 0.1, rnd, 0.55)
    finish(name, root, ((bark, BARK, '_rinde'), (leaf, PINE, '_laub')))


tanne('pine_a', 5, 0, 4)
tanne('pine_b', 23, 4, 4)
kiefer('pine_c', 11, 8)
