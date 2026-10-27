# Gemeinsame Bausteine für die Gebäude-Skripte (ab Mine, 27.10.2026).
# Ein Modell = eine Szene; je Material ein Mesh, alles unter einem Leerobjekt.
# Vorderseite nach -Y (im Spiel +Z). Maßstab wie das Rathaus: im Spiel 0,38, also 2,6 Einheiten = 1 Feld.
import bpy, bmesh, math, random
from mathutils import Vector, Matrix


def mat(name, hexc, rough=0.9, metal=0.0, emit=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    h = hexc.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*c, 1)
        b.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*c, 1)
    return m


class Bau:
    def __init__(self, scene, prefix, colors):
        # colors: {schluessel: '#hex' oder ('#hex', rough, metal, emit)}
        self.sc = bpy.data.scenes.get(scene) or bpy.data.scenes.new(scene)
        if bpy.context.window:
            bpy.context.window.scene = self.sc
        for o in list(self.sc.objects):
            bpy.data.objects.remove(o)
        self.prefix = prefix
        self.mats = {k: mat(f'{prefix}_{k}', *(v if isinstance(v, tuple) else (v,))) for k, v in colors.items()}
        self.bm = {k: bmesh.new() for k in self.mats}
        self.rng = random.Random(7)
        # Verschiebung für alles, was danach gebaut wird (z. B. ein Haus neben dem Ofen)
        self.o = Vector((0, 0, 0))

    def box(self, key, c, size, rz=0.0, rx=0.0, ry=0.0):
        m = Matrix.Translation(Vector(c) + self.o) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Diagonal((*size, 1))
        bmesh.ops.create_cube(self.bm[key], size=1, matrix=m)

    def cyl(self, key, c, r1, r2, depth, seg=8, axis='Z', rz=0.0):
        rot = {'Z': Matrix(), 'X': Matrix.Rotation(math.pi / 2, 4, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 4, 'X')}[axis]
        bmesh.ops.create_cone(self.bm[key], cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth,
                              matrix=Matrix.Translation(Vector(c) + self.o) @ Matrix.Rotation(rz, 4, 'Z') @ rot)

    def hull(self, key, pts):
        bm = self.bm[key]
        vs = [bm.verts.new(Vector(p) + self.o) for p in set(tuple(p) for p in pts)]
        bmesh.ops.convex_hull(bm, input=vs)

    def beam(self, key, a, b, t):
        a, b = Vector(a), Vector(b)
        self.hull(key, [tuple(p + Vector((dx, dy, dz))) for p in (a, b)
                        for dx in (-t / 2, t / 2) for dy in (-t / 2, t / 2) for dz in (-t / 2, t / 2)])

    def rock(self, key, c, r, h=None, n=9):
        # Kantiger Brocken aus zufälligen Punkten auf einer abgeflachten Kugel
        h = h or r
        pts = []
        for i in range(n):
            a = self.rng.uniform(0, 2 * math.pi)
            e = self.rng.uniform(-0.2, 1.0)
            rr = r * self.rng.uniform(0.75, 1.05)
            pts.append((c[0] + math.cos(a) * rr * math.cos(e * 1.2), c[1] + math.sin(a) * rr * math.cos(e * 1.2), c[2] + max(0, math.sin(e * 1.4)) * h))
        pts += [(c[0] + dx * r * 0.7, c[1] + dy * r * 0.7, c[2]) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
        self.hull(key, pts)

    def gable_roof(self, key, w, d, z_eave, pitch, over=0.25, thick=0.12, key2=None, along='X'):
        # Satteldach, First entlang X (Standard) oder Y; gibt die Firsthöhe zurück
        half = d / 2 if along == 'X' else w / 2
        apex = z_eave + (half + over * 0.5) * math.tan(pitch)
        L = (half + over * 0.5) / math.cos(pitch) + over
        length = (w if along == 'X' else d) + over * 2
        for s, k in ((-1, key), (1, key2 or key)):
            ridge = Vector((0, 0, apex + 0.05))
            if along == 'X':
                down = Vector((0, s * math.cos(pitch), -math.sin(pitch)))
                c = ridge + down * (L / 2)
                self.box(k, c, (length, L, thick), rx=-s * pitch)
            else:
                down = Vector((s * math.cos(pitch), 0, -math.sin(pitch)))
                c = ridge + down * (L / 2)
                self.box(k, c, (L, length, thick), ry=s * pitch)
        return apex

    def gable_wall(self, key, w, d, z, apex, along='X', inset=0.0):
        # Dreieckige Giebelwände an den Stirnseiten
        if along == 'X':
            for sx in (-1, 1):
                x = sx * (w / 2 - inset)
                self.hull(key, [(x + dx, y, zz) for dx in (-0.05, 0.05) for y, zz in ((-d / 2, z), (d / 2, z), (0, apex))])
        else:
            for sy in (-1, 1):
                y = sy * (d / 2 - inset)
                self.hull(key, [(x, y + dy, zz) for dy in (-0.05, 0.05) for x, zz in ((-w / 2, z), (w / 2, z), (0, apex))])

    def finish(self, name):
        root = bpy.data.objects.new(name, None)
        self.sc.collection.objects.link(root)
        for k, bm in self.bm.items():
            if not bm.verts:
                bm.free()
                continue
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
            me = bpy.data.meshes.new(f'{self.prefix}_{k}')
            bm.to_mesh(me)
            bm.free()
            for p in me.polygons:
                p.use_smooth = False
            me.materials.append(self.mats[k])
            o = bpy.data.objects.new(f'{self.prefix}_{k}', me)
            self.sc.collection.objects.link(o)
            o.parent = root
        return root


# --- Kleinteile, die mehrere Modelle brauchen ---

def barrel(b, c, r=0.16, h=0.36, wood='holz', iron='eisen'):
    b.cyl(wood, (c[0], c[1], c[2] + h / 2), r * 0.9, r * 0.9, h, seg=10)
    b.cyl(wood, (c[0], c[1], c[2] + h / 2), r, r, h * 0.55, seg=10)
    for z in (0.12, 0.88):
        b.cyl(iron, (c[0], c[1], c[2] + h * z), r * 0.97, r * 0.97, 0.03, seg=10)


def crate(b, c, s=0.3, rz=0.0, wood='holz', dark='balken'):
    b.box(wood, (c[0], c[1], c[2] + s / 2), (s, s, s), rz=rz)
    b.box(dark, (c[0], c[1], c[2] + s / 2), (s + 0.02, s + 0.02, 0.04), rz=rz)
    b.box(dark, (c[0], c[1], c[2] + s - 0.02), (s + 0.02, s + 0.02, 0.04), rz=rz)


def sack(b, c, r=0.13, key='sack'):
    b.hull(key, [(c[0] + math.cos(a) * r, c[1] + math.sin(a) * r, c[2] + z) for a in (0, 1.6, 3.2, 4.7) for z in (0, 0.2)]
           + [(c[0] + math.cos(a) * r * 0.4, c[1] + math.sin(a) * r * 0.4, c[2] + 0.32) for a in (0, 2.1, 4.2)])


def bench(b, c, length=0.8, rz=0.0, wood='holz', legs='balken'):
    ca, sa = math.cos(rz), math.sin(rz)
    b.box(wood, (c[0], c[1], c[2] + 0.24), (length, 0.22, 0.05), rz=rz)
    for s in (-1, 1):
        d = s * (length / 2 - 0.1)
        b.box(legs, (c[0] + ca * d, c[1] + sa * d, c[2] + 0.11), (0.07, 0.18, 0.22), rz=rz)


def window(b, cx, cy, cz, face, w=0.3, h=0.36, frame='balken', glass='glas', shutters=None, bars='balken'):
    fx, fy = face
    along = (abs(fy), abs(fx))
    at = lambda u, out: (cx + along[0] * u + fx * out, cy + along[1] * u + fy * out)
    size = lambda a, d: (along[0] * a + abs(fx) * d, along[1] * a + abs(fy) * d)
    b.box(frame, (*at(0, 0.025), cz), (*size(w + 0.1, 0.05), h + 0.1))
    b.box(glass, (*at(0, 0.05), cz), (*size(w, 0.02), h))
    b.box(bars, (*at(0, 0.06), cz), (*size(0.03, 0.02), h))
    b.box(bars, (*at(0, 0.06), cz), (*size(w, 0.02), 0.03))
    if shutters:
        for s in (-1, 1):
            b.box(shutters, (*at(s * (w / 2 + 0.1), 0.05), cz), (*size(0.14, 0.03), h + 0.06))
