import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const timeUniform = { value: 0 };

// Lässt Gras und Baumkronen im Wind schwanken (Ausschlag wächst mit der Höhe)
export function addSway(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 swayPos = instanceMatrix[3].xyz;
      #else
        vec3 swayPos = vec3(0.0);
      #endif
      float sway = (sin(uTime * 1.6 + swayPos.x * 0.6 + swayPos.z * 0.4) + 0.4 * sin(uTime * 3.1 + swayPos.z)) * ${strength.toFixed(3)} * max(transformed.y, 0.0);
      transformed.x += sway;
      transformed.z += sway * 0.5;`,
    );
  };
  material.customProgramCacheKey = () => `sway${strength}`;
  return material;
}

const hash = (x, z, k) => {
  const s = Math.sin(x * 127.1 + z * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

// Grasbüschel und Blumen; pro Feld merkbar, damit Gebäude sie verdecken können
const AUTUMN_GRASS = new THREE.Color('#e8c27a');
const SNOW_GRASS = new THREE.Color('#e9eef2');

export class Grass {
  constructor(scene, grid) {
    this.grid = grid;
    // Büschel aus fünf spitzen, leicht nach außen geneigten Halmen
    const blade = new THREE.ConeGeometry(0.022, 0.24, 3, 1, true).translate(0, 0.12, 0);
    const tuft = mergeGeometries([0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2;
      return blade.clone().rotateX(i ? 0.35 : 0).rotateY(a).translate(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03);
    }));
    const flower = new THREE.IcosahedronGeometry(0.035, 0).translate(0, 0.14, 0);
    const grassMat = (this.grassMat = addSway(new THREE.MeshLambertMaterial({ color: 0xffffff }), 0.35));
    const flowerMat = (this.flowerMat = addSway(new THREE.MeshLambertMaterial({ color: 0xffffff }), 0.35));

    const spots = [];
    const N = grid.size, wl = grid.waterLevel;
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        const i = grid.idx(x, z);
        const h = grid.tileHeight(x, z);
        if (grid.water[i] || grid.resource[i] >= 0 || h < wl + 0.25 || h > 4.8 || grid.slope(x, z) > 1) continue;
        for (let k = 0; k < 3; k++) {
          if (hash(x, z, k) > 0.8) continue;
          spots.push({ x: x + 0.15 + hash(x, z, k + 5) * 0.7, z: z + 0.15 + hash(x, z, k + 9) * 0.7, tile: i, k: hash(x, z, k + 13) });
        }
      }

    // In Kartenstücke von 16x16 Feldern aufteilen: Stücke außerhalb des Bildes werden nicht gezeichnet
    const CHUNK = 16;
    const chunks = new Map();
    for (const p of spots) {
      const key = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
      if (!chunks.has(key)) chunks.set(key, []);
      chunks.get(key).push(p);
    }
    this.byTile = new Map();
    this.group = new THREE.Group();
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    const petals = ['#ffffff', '#f4d03f', '#c39bd3', '#f1948a'];
    let flowerNo = 0;

    const fill = (mesh, list, scaleOf, colorOf) => {
      list.forEach((p, i) => {
        d.position.set(p.x, grid.heightAt(p.x, p.z), p.z);
        d.rotation.set(0, p.k * 20, 0);
        d.scale.setScalar(scaleOf(p));
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        mesh.setColorAt(i, colorOf(p));
        if (!this.byTile.has(p.tile)) this.byTile.set(p.tile, []);
        this.byTile.get(p.tile).push({ mesh, i, matrix: d.matrix.clone() });
      });
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.boundingSphere.radius += 0.5;
      this.group.add(mesh);
    };
    for (const list of chunks.values()) {
      fill(new THREE.InstancedMesh(tuft, grassMat, list.length), list,
        (p) => 0.8 + p.k * 0.6, (p) => c.setHSL(0.23 + p.k * 0.06, 0.5, 0.42 + p.k * 0.1));
      const flowers = list.filter((p) => p.k < 0.08);
      if (flowers.length) fill(new THREE.InstancedMesh(flower, flowerMat, flowers.length), flowers, () => 1, () => c.set(petals[flowerNo++ % petals.length]));
    }
    scene.add(this.group);
    this.hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  // Herbst: gelblich, Blumen verblüht; Winter: bereift
  setSeason(autumn, snow) {
    this.grassMat.color.setRGB(1, 1, 1).lerp(AUTUMN_GRASS, autumn).lerp(SNOW_GRASS, snow);
    this.flowerMat.visible = autumn + snow < 0.5;
  }

  setTile(x, z, visible) {
    const list = this.byTile.get(this.grid.idx(x, z));
    if (!list) return;
    for (const e of list) {
      e.mesh.setMatrixAt(e.i, visible ? e.matrix : this.hidden);
      e.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

// Wasser mit Wellen und Himmelsspiegelung
export function createWater(renderer, grid, skyColor) {
  const N = grid.size;
  const pmrem = new THREE.PMREMGenerator(renderer);
  // Himmel mit Verlauf: oben kräftig, am Horizont hell -> Ufer und flache Blickwinkel spiegeln heller
  const skyScene = new THREE.Scene();
  const skyGeo = new THREE.SphereGeometry(10, 32, 16);
  const top = new THREE.Color(skyColor).multiplyScalar(0.7), horizon = new THREE.Color('#eef5fa');
  const colors = [];
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const c = horizon.clone().lerp(top, Math.max(0, pos.getY(i) / 10));
    colors.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  skyScene.add(new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const envMap = pmrem.fromScene(skyScene, 0.02).texture;
  pmrem.dispose();

  // Geländehöhen als Textur, damit das Wasser seine Tiefe kennt (Uferschaum, Farbe nach Tiefe)
  const S = N + 1;
  const data = new Uint8Array(S * S);
  for (let z = 0; z < S; z++)
    for (let x = 0; x < S; x++) data[z * S + x] = Math.round(Math.min(1, Math.max(0, grid.corner(x, z) / 12)) * 255);
  const heights = new THREE.DataTexture(data, S, S, THREE.RedFormat);
  heights.magFilter = heights.minFilter = THREE.LinearFilter;
  heights.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({
    color: '#2a6fae', roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.82, envMap,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.uniforms.uHeights = { value: heights };
    shader.uniforms.uSize = { value: S };
    shader.uniforms.uLevel = { value: grid.waterLevel };
    shader.vertexShader = 'uniform float uTime;\nvarying vec2 vXZ;\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', `
        float wx = position.x * 1.3 + uTime * 1.4;
        float wz = position.z * 1.1 + uTime * 1.1;
        float vx = (position.x + position.z) * 3.1 + uTime * 2.3;
        float vz = (position.x - position.z) * 2.7 - uTime * 1.9;
        float dx = 1.3 * cos(wx) * 0.12 + 3.1 * cos(vx) * 0.04 + 2.7 * cos(vz) * 0.04;
        float dz = -1.1 * sin(wz) * 0.12 + 3.1 * cos(vx) * 0.04 - 2.7 * cos(vz) * 0.04;
        vec3 objectNormal = normalize(vec3(-dx, 1.0, -dz));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        transformed.y += (sin(wx) + cos(wz)) * 0.035;
        vXZ = position.xz;`);
    shader.fragmentShader = `uniform float uTime, uSize, uLevel;\nuniform sampler2D uHeights;\nvarying vec2 vXZ;\n${GLSL_NOISE}\n` + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float ground = texture2D(uHeights, (vXZ + 0.5) / uSize).r * 12.0;
      float depth = uLevel - ground;
      // flach: türkis und durchsichtig, tief: dunkelblau
      vec3 shallow = vec3(0.30, 0.66, 0.74), deep = vec3(0.10, 0.33, 0.58);
      diffuseColor.rgb = mix(shallow, deep, smoothstep(0.04, 0.5, depth));
      diffuseColor.a = mix(0.45, 0.88, smoothstep(0.0, 0.6, depth));
      float wave = sin((vXZ.x + vXZ.y) * 3.1 + uTime * 2.3) * cos((vXZ.x - vXZ.y) * 2.7 - uTime * 1.9) * 0.6
        + sin(vXZ.x * 0.9 + vXZ.y * 0.55 + uTime * 1.2) * 0.4;
      diffuseColor.rgb *= 0.9 + 0.25 * smoothstep(0.25, 0.95, wave);
      // Uferschaum: schmales, bewegtes Band dort, wo das Wasser flach wird
      float edge = 0.1 + 0.05 * sin(uTime * 1.3 + tNoise(vXZ * 1.5) * 6.0);
      float foam = (1.0 - smoothstep(0.0, edge, depth)) * smoothstep(0.35, 0.65, tNoise(vXZ * 3.0 + uTime * 0.3));
      foam = max(foam, 1.0 - smoothstep(0.0, 0.04, depth));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.98, 1.0), foam * 0.85);
      diffuseColor.a = max(diffuseColor.a, foam * 0.9);`,
    );
  };
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(N, N, N, N).rotateX(-Math.PI / 2).translate(N / 2, grid.waterLevel, N / 2),
    mat,
  );
  mesh.receiveShadow = true;
  return mesh;
}

// Rauchwolken aus Schornsteinen
export class Smoke {
  constructor(scene, max = 90) {
    this.mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.07, 0),
      new THREE.MeshLambertMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.55, depthWrite: false }),
      max,
    );
    this.mesh.frustumCulled = false;
    this.puffs = [];
    this.max = max;
    this.d = new THREE.Object3D();
    scene.add(this.mesh);
  }

  emit(pos) {
    if (this.puffs.length >= this.max) return;
    this.puffs.push({ x: pos.x, y: pos.y, z: pos.z, age: 0, life: 2.6 + Math.random() });
  }

  update(dt) {
    const d = this.d;
    this.puffs = this.puffs.filter((p) => (p.age += dt) < p.life);
    this.puffs.forEach((p, i) => {
      const k = p.age / p.life;
      d.position.set(p.x + p.age * 0.08, p.y + p.age * 0.35, p.z + Math.sin(p.age * 2) * 0.03);
      d.scale.setScalar((0.6 + k * 1.6) * (1 - k * k));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.count = this.puffs.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Wege als schmale Bänder zwischen benachbarten Wegfeldern (statt ganzer Felder)
const PATH = new THREE.Color('#9c7f55');
const ROAD_A = new THREE.Color('#a39b8c');
const ROAD_B = new THREE.Color('#8b8374');

export class Roads {
  constructor(scene, grid) {
    this.grid = grid;
    this.mesh = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.dirty = true;
  }

  rebuild() {
    const g = this.grid;
    const pos = [], col = [];
    const c = new THREE.Color();
    const y = (x, z) => g.heightAt(x, z) + 0.04;
    const quad = (ax, az, bx, bz, w, color) => {
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
      const nx = (-dz / len) * w / 2, nz = (dx / len) * w / 2;
      const p = [[ax + nx, az + nz], [bx + nx, bz + nz], [bx - nx, bz - nz], [ax - nx, az - nz]];
      // zwei Dreiecke, Vorderseite nach oben
      for (const k of [0, 1, 2, 0, 2, 3]) {
        pos.push(p[k][0], y(p[k][0], p[k][1]), p[k][1]);
        col.push(color.r, color.g, color.b);
      }
    };
    for (let z = 0; z < g.size; z++)
      for (let x = 0; x < g.size; x++) {
        const level = g.road[g.idx(x, z)];
        if (!level || g.building[g.idx(x, z)] >= 0) continue;
        const h = Math.sin(x * 12.9 + z * 78.2) * 43758.5;
        const base = level === 2 ? (h - Math.floor(h) > 0.5 ? ROAD_A : ROAD_B) : PATH;
        const w = level === 2 ? 0.56 : 0.36;
        const cx = x + 0.5, cz = z + 0.5;
        c.copy(base);
        quad(cx - w / 2, cz, cx + w / 2, cz, w, c);
        for (let dz = -1; dz <= 1; dz++)
          for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dz) || !g.inBounds(x + dx, z + dz)) continue;
            const n = g.idx(x + dx, z + dz);
            if (!g.road[n] || g.building[n] >= 0) continue;
            if (dx && dz && (g.road[g.idx(x + dx, z)] || g.road[g.idx(x, z + dz)])) continue;
            const nw = Math.min(w, g.road[n] === 2 ? 0.56 : 0.36);
            quad(cx, cz, cx + dx * 0.5, cz + dz * 0.5, nw, c);
          }
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    this.dirty = false;
  }
}

// Gemeinsame Rausch-Funktion für Gelände- und Wasser-Shader
const GLSL_NOISE = `
  float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float tNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

// Gelände: fein unterteilt und weich gerundet; Farbe pro Bildpunkt aus Höhe, Steigung und Rauschen
export const terrainUniforms = { uSnow: { value: 0 }, uAutumn: { value: 0 } };

export function createTerrain(grid, map, sub = 2) {
  const N = grid.size, R = N * sub;
  const geo = new THREE.PlaneGeometry(N, N, R, R).rotateX(-Math.PI / 2).translate(N / 2, 0, N / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, grid.heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const c = (hex) => new THREE.Color(hex);
  // Eigenes Gebiet: 1 = innen; außen wird das Land leicht abgedunkelt
  const area = new THREE.DataTexture(new Uint8Array(N * N * 4).fill(255), N, N);
  area.magFilter = area.minFilter = THREE.LinearFilter;
  area.needsUpdate = true;
  const uniforms = {
    uArea: { value: area },
    uSize: { value: N },
    uWater: { value: grid.waterLevel },
    uGrassA: { value: c(map.grass[0]) },
    uGrassB: { value: c(map.grass[1]) },
    uDirt: { value: c('#8a6d48') },
    uRock: { value: c('#8b867c') },
    uSand: { value: c('#d8c690') },
    uBed: { value: c('#8d8466') },
    uSnowColor: { value: c('#dfe4ea') },
    uDry: { value: c('#b8a04a') },
    ...terrainUniforms,
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec3 vTPos;\nvarying vec3 vTNorm;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vTPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vTNorm = normalize(mat3(modelMatrix) * normal);`,
    );
    shader.fragmentShader = `
      varying vec3 vTPos;
      varying vec3 vTNorm;
      uniform float uWater, uSnow, uAutumn, uSize;
      uniform sampler2D uArea;
      uniform vec3 uGrassA, uGrassB, uDirt, uRock, uSand, uBed, uSnowColor, uDry;
      ${GLSL_NOISE}
    ` + shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec2 p = vTPos.xz;
      float n1 = tNoise(p * 0.18), n2 = tNoise(p * 0.9), n3 = tNoise(p * 4.3);
      float slope = 1.0 - clamp(vTNorm.y, 0.0, 1.0);
      // Wiese mit großen und kleinen Farbflecken
      vec3 col = mix(uGrassA, uGrassB, clamp(n1 * 0.55 + n2 * 0.55 - 0.05, 0.0, 1.0));
      col *= 0.9 + 0.2 * n3;
      // kleine trockene Erdstellen
      float dirt = smoothstep(0.72, 0.82, tNoise(p * 0.32 + 17.0) * 0.8 + n3 * 0.2);
      col = mix(col, uDirt, dirt * 0.45);
      // Herbst: Wiese wird strohig
      col = mix(col, uDry, uAutumn * (0.35 + 0.25 * n2));
      // Fels an steilen Hängen und hoch oben
      float rock = max(smoothstep(0.3, 0.36, slope + (n2 - 0.5) * 0.14), smoothstep(4.8, 5.1, vTPos.y + n2 * 0.5));
      col = mix(col, uRock * (0.85 + 0.3 * n3), rock);
      // Sandstrand knapp über dem Wasser, Seegrund darunter
      float sand = 1.0 - smoothstep(uWater + 0.1, uWater + 0.32, vTPos.y + (n2 - 0.5) * 0.12);
      col = mix(col, uSand * (0.95 + 0.1 * n3), sand);
      col = mix(col, uBed, 1.0 - smoothstep(uWater - 0.25, uWater, vTPos.y));
      // Schnee auf Gipfeln und (im Winter) auf allen flachen Flächen
      float peak = smoothstep(7.0, 7.6, vTPos.y + n2 * 0.6);
      float winter = uSnow * smoothstep(0.35, 0.75, vTNorm.y + (n2 - 0.5) * 0.3) * step(uWater + 0.05, vTPos.y);
      col = mix(col, uSnowColor * (0.96 + 0.06 * n3), max(peak, winter));
      float inside = smoothstep(0.3, 0.7, texture2D(uArea, p / uSize).r);
      col *= mix(0.62, 1.0, inside);
      diffuseColor.rgb = col;`,
    );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.setTerritory = (t) => {
    const d = area.image.data;
    for (let i = 0; i < t.length; i++) d[i * 4] = t[i] ? 255 : 0;
    area.needsUpdate = true;
  };
  return mesh;
}
