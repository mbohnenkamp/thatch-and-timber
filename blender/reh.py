# Reh im Stil des Schafs — in Blender ausführen, baut Szene "Reh" neu.
# Aufbau wie beim Schaf: Wurzel "deer", Kopf "deer_head", Beine "deer_leg_*" (Gelenk oben), Blick nach -Y
import bpy, bmesh, random, math
from mathutils import Vector

rnd = random.Random(8)
sc = bpy.data.scenes.get('Reh') or bpy.data.scenes.new('Reh')
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


M = dict(fell=mat('reh_fell', '#a8683a'), hell=mat('reh_hell', '#ead8bd'), dunkel=mat('reh_dunkel', '#3a2a22'),
         geweih=mat('reh_geweih', '#d8c3a0'), auge=mat('reh_auge', '#111111', 0.3))


def obj(name, bm, m, parent, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.parent = parent
    o.location = loc
    return o


def empty(name, parent, loc):
    e = bpy.data.objects.new(name, None)
    sc.collection.objects.link(e)
    e.parent = parent
    e.location = loc
    return e


def hull(name, pts, m, parent, loc=(0, 0, 0)):
    bm = bmesh.new()
    for p in pts:
        bm.verts.new(p)
    r = bmesh.ops.convex_hull(bm, input=bm.verts)
    dead = {g for g in r['geom_interior'] + r['geom_unused'] if isinstance(g, bmesh.types.BMVert)}
    if dead:
        bmesh.ops.delete(bm, geom=list(dead), context='VERTS')
    return obj(name, bm, m, parent, loc)


def sym(pts):
    return [(s * x, y, z) for (x, y, z) in pts for s in ((1, -1) if x else (1,))]


def jit(pts, j=0.015):
    return [(x + rnd.uniform(-j, j) * (1 if x else 0), y + rnd.uniform(-j, j), z + rnd.uniform(-j, j)) for (x, y, z) in pts]


root = empty('deer', None, (0, 0, 0))
# Rumpf: schlank, Brust etwas höher als die Kruppe
hull('deer_rumpf', sym(jit([
    (0.17, -0.42, 0.98), (0.2, -0.3, 0.78), (0.15, -0.35, 1.12),
    (0.21, 0.0, 0.8), (0.19, 0.0, 1.1), (0.2, 0.32, 0.82), (0.17, 0.4, 1.06), (0.12, 0.5, 0.95),
    (0.0, -0.48, 0.92), (0.0, 0.52, 0.98), (0.0, 0.05, 0.72), (0.0, 0.05, 1.15)])), M['fell'], root)
hull('deer_bauch', sym([(0.14, -0.22, 0.74), (0.15, 0.25, 0.76), (0.1, -0.1, 0.7), (0.1, 0.15, 0.71)]), M['hell'], root)
hull('deer_spiegel', sym([(0.1, 0.5, 0.86), (0.1, 0.53, 1.0), (0.05, 0.56, 0.93)]), M['hell'], root)
hull('deer_hals', sym(jit([(0.1, -0.32, 1.02), (0.12, -0.42, 0.88), (0.08, -0.62, 1.38), (0.09, -0.52, 1.36)], 0.01)), M['fell'], root)

head = empty('deer_head', root, (0, -0.6, 1.4))
hull('deer_kopf', sym([(0.09, 0.06, 0.08), (0.1, 0.05, -0.06), (0.07, -0.16, 0.02), (0.06, -0.2, -0.08),
                       (0.035, -0.29, -0.04), (0.03, -0.28, -0.11), (0.0, 0.08, 0.12)]), M['fell'], head)
hull('deer_maul', sym([(0.035, -0.27, -0.05), (0.03, -0.3, -0.09), (0.025, -0.26, -0.12)]), M['dunkel'], head)
for s, t in ((1, 'R'), (-1, 'L')):
    hull('deer_ohr' + t, [(s * 0.07, 0.04, 0.08), (s * 0.07, 0.0, 0.08), (s * 0.07, 0.02, 0.12),
                          (s * 0.17, 0.05, 0.22), (s * 0.19, 0.02, 0.24), (s * 0.15, 0.02, 0.2), (s * 0.12, 0.06, 0.16)], M['fell'], head)
    hull('deer_auge' + t, [(s * (0.088 + dx), -0.1 + dy, 0.03 + dz) for dx in (0, 0.012) for dy in (-0.018, 0.018) for dz in (-0.018, 0.018)], M['auge'], head)
    # kleines Gehörn: Stange mit einer Gabel
    hull('deer_stange' + t, [(s * 0.04, 0.0, 0.1), (s * 0.06, 0.0, 0.1), (s * 0.05, 0.02, 0.11), (s * 0.07, 0.03, 0.3), (s * 0.08, 0.02, 0.3)], M['geweih'], head)
    hull('deer_gabel' + t, [(s * 0.065, 0.0, 0.2), (s * 0.075, 0.01, 0.2), (s * 0.07, -0.08, 0.27)], M['geweih'], head)
hull('deer_nase', [(dx, -0.3 + dy, -0.06 + dz) for dx in (-0.02, 0.02) for dy in (0, 0.012) for dz in (-0.012, 0.012)], M['dunkel'], head)

tail = empty('deer_tail', root, (0, 0.52, 1.02))
hull('deer_wedel', sym([(0.04, 0.0, 0.02), (0.05, 0.06, -0.02), (0.03, 0.08, -0.1), (0.0, 0.03, 0.04)]), M['fell'], tail)

for nm, x, y, hind in (('deer_leg_fl', -0.12, -0.32, False), ('deer_leg_fr', 0.12, -0.32, False),
                       ('deer_leg_bl', -0.12, 0.36, True), ('deer_leg_br', 0.12, 0.36, True)):
    L = empty(nm, root, (x, y, 0.82))
    top = 0.075 if hind else 0.06
    knee = (0.0, 0.05 if hind else -0.01, -0.4)
    hull(nm + '_oben', sym([(top, top, 0.05), (top, -top, 0.05), (0.035, 0.035 + knee[1], knee[2]), (0.035, -0.035 + knee[1], knee[2])]), M['fell'], L)
    hull(nm + '_unten', sym([(0.032, 0.032 + knee[1], knee[2]), (0.032, -0.032 + knee[1], knee[2]), (0.025, 0.025, -0.74), (0.025, -0.025, -0.74)]), M['fell'], L)
    hull(nm + '_huf', sym([(0.028, 0.03, -0.74), (0.028, -0.03, -0.74), (0.03, 0.03, -0.82), (0.03, -0.05, -0.82)]), M['dunkel'], L)
