export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoise(rng) {
  const vals = new Float32Array(256 * 256);
  for (let i = 0; i < vals.length; i++) vals[i] = rng();
  const v = (x, z) => vals[(z & 255) * 256 + (x & 255)];
  const s = (t) => t * t * (3 - 2 * t);

  function noise(x, z) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const fx = s(x - x0), fz = s(z - z0);
    const a = v(x0, z0), b = v(x0 + 1, z0), c = v(x0, z0 + 1), d = v(x0 + 1, z0 + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  function fbm(x, z, octaves = 4) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }

  return { noise, fbm };
}
