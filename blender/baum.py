# Laubbäume nach entwuerfe/Baum.png — in Blender ausführen, baut Szene "Baum" neu
import bpy, bmesh, random, math
from mathutils import Vector

sc = bpy.data.scenes.get('Baum') or bpy.data.scenes.new('Baum')
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


LEAF = mat('baum_leaf', '#7fae45')
BARK = mat('baum_rinde', '#9a5f36')


def add_hull(bm, pts):
    vs = [bm.verts.new(p) for p in pts]
    r = bmesh.ops.convex_hull(bm, input=vs)
    dead = {g for g in r['geom_interior'] + r['geom_unused'] if isinstance(g, bmesh.types.BMVert)}
    if dead:
        bmesh.ops.delete(bm, geom=list(dead), context='VERTS')


def ring(c, r, n=7, rot=0):
    return [Vector((c.x + r * math.cos(rot + i * 2 * math.pi / n), c.y + r * math.sin(rot + i * 2 * math.pi / n), c.z)) for i in range(n)]


def sphere(bm, c, rad, sub, j, rnd):
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=sub, radius=1)
    rot = rnd.uniform(0, 6.3)
    for v in tmp.verts:
        p = v.co.normalized() * rad * (1 + rnd.uniform(-j, j))
        v.co = Vector((p.x * math.cos(rot) - p.y * math.sin(rot), p.x * math.sin(rot) + p.y * math.cos(rot), p.z * 0.92)) + c
    me = bpy.data.meshes.new('tmp')
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def tree(name, seed, ox):
    rnd = random.Random(seed)
    root = bpy.data.objects.new(name, None)
    sc.collection.objects.link(root)
    root.location = (ox, 0, 0)
    bark, leaf = bmesh.new(), bmesh.new()
    lean = Vector((rnd.uniform(-0.35, 0.35), rnd.uniform(-0.15, 0.15), 0))
    H = rnd.uniform(1.9, 2.3)

    # Stamm: leicht gebogen, unten breiter
    pts = [(Vector((lean.x * t * t, lean.y * t * t, t * H)), 0.42 - 0.2 * t) for t in (k / 4 for k in range(5))]
    for (c0, r0), (c1, r1) in zip(pts, pts[1:]):
        add_hull(bark, ring(c0, r0) + ring(c1, r1))

    # Wurzelansätze
    for i in range(4):
        a = i * math.pi / 2 + rnd.uniform(-0.3, 0.3)
        d = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-d.y, d.x, 0)) * 0.1
        add_hull(bark, ring(Vector((0, 0, 0.55)), 0.26) + [d * 0.7, d * 0.55 + side + Vector((0, 0, 0.06)), d * 0.55 - side + Vector((0, 0, 0.06)), d * 0.2])

    # Krone: große Hauptkugel oben, kleinere Büschel rundum
    top = pts[-1][0]
    crown = [(top + Vector((0, 0, 1.2)), 1.2, 2)]
    n = rnd.randint(5, 7)
    for i in range(n):
        a = i * 2 * math.pi / n + rnd.uniform(-0.35, 0.35)
        dist = rnd.uniform(1.05, 1.35)
        crown.append((top + Vector((math.cos(a) * dist, math.sin(a) * dist, rnd.uniform(-0.45, 0.8))), rnd.uniform(0.6, 0.85), 2))

    # Äste zu den unteren Büscheln
    for c, r, s in crown[1:]:
        if c.z - top.z < 0.2:
            base = Vector((lean.x * 0.5, lean.y * 0.5, H * 0.7))
            tip = base + (c - base) * 0.75
            add_hull(bark, ring(base, 0.13, 5) + ring(tip, 0.07, 5))

    for c, r, s in crown:
        sphere(leaf, c, r, s, 0.09, rnd)

    for bm, m, nm in ((bark, BARK, '_rinde'), (leaf, LEAF, '_laub')):
        me = bpy.data.meshes.new(name + nm)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = False
        me.materials.append(m)
        o = bpy.data.objects.new(name + nm, me)
        sc.collection.objects.link(o)
        o.parent = root


for i, (nm, sd) in enumerate((('tree_a', 3), ('tree_b', 17), ('tree_c', 42))):
    tree(nm, sd, i * 6)
