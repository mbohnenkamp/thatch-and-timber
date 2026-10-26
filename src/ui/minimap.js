// Übersichtskarte oben rechts: Gelände, Wald, Felsen, Straßen, Gebäude und der sichtbare Ausschnitt.
// Antippen springt dorthin.
const COLORS = {
  water: [74, 132, 178], deep: [52, 98, 150], sand: [214, 196, 140],
  tree: [46, 98, 44], rock: [150, 146, 138], ore: [180, 105, 70], coal: [50, 46, 44], field: [214, 180, 80], road: [150, 118, 78], path: [160, 140, 100],
};
const BUILDING = '#f2e3c2';

export class Minimap {
  constructor(root, game, rig) {
    this.game = game;
    this.rig = rig;
    this.N = game.grid.size;
    const wrap = (this.el = document.createElement('div'));
    wrap.id = 'minimap';
    const c = (this.canvas = document.createElement('canvas'));
    c.width = c.height = this.N;
    wrap.appendChild(c);
    root.appendChild(wrap);
    this.ctx = c.getContext('2d');
    this.base = this.ctx.createImageData(this.N, this.N);
    this.baseT = Infinity;
    this.t = 0;
    game.on('territory', () => { this.baseT = Infinity; });

    const jump = (e) => {
      const r = c.getBoundingClientRect();
      this.rig.target.x = ((e.clientX - r.left) / r.width) * this.N;
      this.rig.target.z = ((e.clientY - r.top) / r.height) * this.N;
      this.rig.clamp();
    };
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      c.setPointerCapture(e.pointerId);
      jump(e);
    });
    c.addEventListener('pointermove', (e) => { if (c.hasPointerCapture(e.pointerId)) jump(e); });
    wrap.addEventListener('wheel', (e) => e.stopPropagation());
  }

  // Gelände ändert sich selten (Bäume, Straßen) -> nur alle paar Sekunden neu
  drawBase() {
    const g = this.game.grid, N = this.N, d = this.base.data;
    const res = this.game.resources;
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        const i = g.idx(x, z), h = g.tileHeight(x, z);
        let col;
        if (g.water[i]) col = h < g.waterLevel - 0.4 ? COLORS.deep : COLORS.water;
        else if (g.field[i] >= 0) col = COLORS.field;
        else if (g.road[i] >= 2) col = COLORS.road;
        else if (g.road[i] === 1) col = COLORS.path;
        else {
          const n = g.resource[i] >= 0 ? res[g.resource[i]] : null;
          if (n && !n.gone && n.type === 'tree' && n.amount > 0) col = COLORS.tree;
          else if (n && !n.gone && COLORS[n.type] && n.type !== 'tree') col = COLORS[n.type];
          else if (h < g.waterLevel + 0.15) col = COLORS.sand;
          else {
            const k = Math.min(1, Math.max(0, h / 5));
            col = [96 + k * 50 - g.slope(x, z) * 20, 150 - k * 30, 70 + k * 10];
          }
        }
        const o = (z * N + x) * 4, k = this.game.territory[i] ? 1 : 0.6;
        d[o] = col[0] * k; d[o + 1] = col[1] * k; d[o + 2] = col[2] * k; d[o + 3] = 255;
      }
  }

  update(dt) {
    this.t += dt;
    if (this.t < 0.25) return;
    this.baseT += this.t;
    this.t = 0;
    if (this.baseT > 3) {
      this.baseT = 0;
      this.drawBase();
    }
    const ctx = this.ctx;
    ctx.putImageData(this.base, 0, 0);
    ctx.fillStyle = BUILDING;
    for (const b of this.game.buildings) {
      if (b.removed) continue;
      ctx.globalAlpha = b.done ? 1 : 0.55;
      ctx.fillRect(b.x - 0.5, b.z - 0.5, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Sichtbarer Ausschnitt als gedrehtes Rechteck um das Kamerazentrum
    const { target, dist, az } = this.rig;
    const w = dist * 1.3, h = dist * 0.9;
    ctx.save();
    ctx.translate(target.x, target.z);
    ctx.rotate(-az);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(1, this.N / 110);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();

    const bar = document.getElementById('topbar');
    if (bar) this.el.style.top = `${bar.offsetHeight + 8}px`;
  }
}
