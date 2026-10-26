// Alle Klänge werden live erzeugt (Web Audio), es gibt keine Audiodateien.
const PREFS_KEY = 'siedler-dorf-audio';
const SCALE = [0, 2, 5, 7, 9, 12, 14, 17]; // pentatonisch auf D
const BASE = 293.66;

class Audio {
  constructor() {
    this.ctx = null;
    this.listener = { x: 0, z: 0, az: 0 };
    this.lastPlayed = {};
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch { /* Standardwerte */ }
    this.soundOn = prefs.soundOn ?? true;
    this.musicOn = prefs.musicOn ?? true;
    this.snow = 0;
    this.night = 0;
  }

  // Jahreszeit und Tageszeit für Wind, Vögel, Grillen
  setAmbience(snow, night) {
    this.snow = snow;
    this.night = night;
    if (!this.windGain) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0.25 + snow * 0.35, t, 1);
    this.windFilter.frequency.setTargetAtTime(380 + snow * 420, t, 1);
    if (this.cricketGain) this.cricketGain.gain.setTargetAtTime(night > 0.6 && snow < 0.5 ? 0.45 : 0, t, 2);
  }

  // Grillen als leise Dauerschleife, nur nachts hörbar
  startCrickets(buf) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = 0.1;
    src.loopEnd = buf.duration - 0.1;
    this.cricketGain = this.ctx.createGain();
    this.cricketGain.gain.value = 0;
    src.connect(this.cricketGain).connect(this.ambient);
    src.start();
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.soundOn ? 1 : 0;
    this.master.connect(ctx.destination);
    this.sfx = this.bus(0.7);
    this.ambient = this.bus(0.35);
    this.music = this.bus(this.musicOn ? 0.22 : 0);

    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Echte Aufnahmen (MotionElements, lizenziert von Marco — nicht weitergeben).
    // Fehlt eine Datei, bleibt der erzeugte Klang.
    this.samples = {};
    for (const [key, file] of Object.entries({ sheep: 'sheep.wav', crickets: 'crickets.m4a', owl: 'owl.m4a' })) {
      fetch(`${import.meta.env.BASE_URL}sounds/${file}`)
        .then((res) => res.arrayBuffer())
        .then((data) => ctx.decodeAudioData(data))
        .then((buf) => {
          this.samples[key] = buf;
          if (key === 'crickets') this.startCrickets(buf);
        })
        .catch(() => { /* erzeugter Ersatz */ });
    }

    this.startWind();
    this.nextBird = ctx.currentTime + 2;
    this.musicTime = ctx.currentTime + 1;
    this.step = 0;
    this.note = 2;
    setInterval(() => this.schedule(), 200);
  }

  bus(volume) {
    const g = this.ctx.createGain();
    g.gain.value = volume;
    g.connect(this.master);
    return g;
  }

  savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ soundOn: this.soundOn, musicOn: this.musicOn })); } catch { /* egal */ }
  }

  toggleSound() {
    this.soundOn = !this.soundOn;
    if (this.ctx) this.master.gain.setTargetAtTime(this.soundOn ? 1 : 0, this.ctx.currentTime, 0.05);
    this.savePrefs();
    return this.soundOn;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.music.gain.setTargetAtTime(this.musicOn ? 0.22 : 0, this.ctx.currentTime, 0.3);
    this.savePrefs();
    return this.musicOn;
  }

  setListener(x, z, az, dist) {
    Object.assign(this.listener, { x, z, az, dist });
  }

  // --- Bausteine ---

  env(gainNode, t, attack, decay, peak) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(out, type, freq, t, attack, decay, peak, freqEnd) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + decay);
    this.env(g, t, attack, decay, peak);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  burst(out, t, dur, peak, filterType, freq, freqEnd, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, 0.004, dur, peak);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // --- Geräusche ---

  play(name, x, z) {
    if (!this.ctx || !this.soundOn) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastPlayed[name] || 0) < 0.07) return;

    let out = this.sfx, volume = 1;
    if (x !== undefined) {
      const L = this.listener;
      const dx = x - L.x, dz = z - L.z;
      const range = 12 + (L.dist || 20) * 0.6;
      volume = 1 - Math.hypot(dx, dz) / range;
      if (volume <= 0.02) return;
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, (dx * Math.cos(L.az) - dz * Math.sin(L.az)) / 10));
      const g = this.ctx.createGain();
      g.gain.value = volume * volume;
      g.connect(panner).connect(this.sfx);
      out = g;
    }
    this.lastPlayed[name] = now;
    const t = now + 0.01;
    const r = 0.9 + Math.random() * 0.2;

    switch (name) {
      case 'chop':
        this.burst(out, t, 0.09, 0.5, 'bandpass', 900 * r, 0, 2);
        this.tone(out, 'sine', 160 * r, t, 0.003, 0.12, 0.6, 60);
        break;
      case 'stone':
        this.burst(out, t, 0.06, 0.4, 'highpass', 2500 * r);
        this.tone(out, 'triangle', 1400 * r, t, 0.002, 0.08, 0.25, 900);
        break;
      case 'saw':
        this.burst(out, t, 0.18, 0.28, 'bandpass', 2600 * r, 1900, 4);
        this.burst(out, t + 0.22, 0.18, 0.24, 'bandpass', 2300 * r, 2900, 4);
        break;
      case 'hammer':
        this.tone(out, 'square', 700 * r, t, 0.002, 0.05, 0.12, 400);
        this.burst(out, t, 0.05, 0.35, 'bandpass', 1800 * r, 0, 3);
        break;
      case 'pick':
        this.tone(out, 'triangle', 900 * r, t, 0.005, 0.1, 0.18, 650);
        this.burst(out, t, 0.08, 0.12, 'highpass', 3000);
        break;
      case 'splash':
        this.burst(out, t, 0.35, 0.35, 'lowpass', 2400 * r, 300, 1);
        break;
      case 'scythe':
        this.burst(out, t, 0.22, 0.3, 'highpass', 5000 * r, 1800);
        break;
      case 'grind':
        this.burst(out, t, 0.7, 0.35, 'lowpass', 260 * r, 160, 2);
        this.tone(out, 'sine', 70 * r, t, 0.05, 0.6, 0.25);
        break;
      case 'bake':
        this.burst(out, t, 0.5, 0.25, 'bandpass', 700 * r, 400, 0.7);
        break;
      case 'drop':
        this.tone(out, 'sine', 140 * r, t, 0.003, 0.15, 0.5, 50);
        this.burst(out, t, 0.08, 0.2, 'lowpass', 900);
        break;
      case 'place':
        this.tone(out, 'sine', 220, t, 0.003, 0.1, 0.5, 90);
        this.tone(out, 'sine', 260, t + 0.12, 0.003, 0.1, 0.4, 100);
        break;
      case 'demolish':
        this.burst(out, t, 0.6, 0.6, 'lowpass', 1500, 200);
        this.tone(out, 'sine', 90, t, 0.005, 0.4, 0.6, 40);
        break;
      case 'complete':
        [0, 4, 7, 12].forEach((s, i) => this.tone(out, 'triangle', 392 * 2 ** (s / 12), t + i * 0.1, 0.005, 0.5, 0.3));
        break;
      case 'arrive':
        this.tone(out, 'sine', 880, t, 0.005, 0.6, 0.3);
        this.tone(out, 'sine', 1174.7, t + 0.15, 0.005, 0.8, 0.3);
        break;
      case 'baa':
        if (this.samples.sheep) this.sample(out, this.samples.sheep, t, 0.85 + Math.random() * 0.3, 0.8);
        else this.baa(out, t, r);
        break;
      case 'milk':
        this.burst(out, t, 0.12, 0.18, 'highpass', 3500 * r, 2200);
        this.burst(out, t + 0.28, 0.12, 0.15, 'highpass', 3300 * r, 2000);
        break;
      case 'click':
        this.tone(out, 'triangle', 1200, t, 0.002, 0.04, 0.15, 800);
        break;
      case 'error':
        this.tone(out, 'square', 180, t, 0.005, 0.15, 0.12, 140);
        break;
    }
  }

  sample(out, buffer, t, rate, volume) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(out);
    src.start(t);
  }

  // Blöken „Mäh": zwei leicht verstimmte Sägezähne plus Atemrauschen, unregelmäßiges Zittern,
  // schwankende Tonhöhe, Formanten wie bei einer Tierstimme, weicher m-Ansatz
  baa(out, t, r) {
    const ctx = this.ctx;
    const dur = 0.7 + Math.random() * 0.35;
    const f0 = 210 * r;
    const mix = ctx.createGain();

    // Tonhöhe: Verlauf plus zufällige Schwankung (Stützpunkte alle 40 ms)
    const pitch = [];
    for (let k = 0; k <= dur / 0.04; k++) {
      const x = (k * 0.04) / dur;
      pitch.push(f0 * (0.9 + 0.18 * Math.min(1, x * 6) - 0.12 * x) * (1 + (Math.random() - 0.5) * 0.035));
    }
    for (const [detune, type, gain] of [[-9, 'sawtooth', 0.7], [6, 'sawtooth', 0.6], [0, 'triangle', 0.5]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = detune;
      o.frequency.setValueCurveAtTime(Float32Array.from(pitch), t, dur);
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g).connect(mix);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    const breath = ctx.createBufferSource();
    breath.buffer = this.noise;
    const bg = ctx.createGain();
    bg.gain.value = 0.22;
    breath.connect(bg).connect(mix);
    breath.start(t, Math.random() * 0.5);
    breath.stop(t + dur + 0.05);

    // Zittern: Lautstärke schwankt mit unruhiger Frequenz um ~28 Hz
    const quaver = ctx.createGain();
    quaver.gain.value = 0.62;
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    const rate = [];
    for (let k = 0; k < 8; k++) rate.push(22 + Math.random() * 14);
    lfo.frequency.setValueCurveAtTime(Float32Array.from(rate), t, dur);
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0.02, t);
    depth.gain.linearRampToValueAtTime(0.32 + Math.random() * 0.1, t + 0.25);
    lfo.connect(depth).connect(quaver.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);

    const open = ctx.createBiquadFilter();
    open.type = 'lowpass';
    open.frequency.setValueAtTime(300, t);
    open.frequency.exponentialRampToValueAtTime(3000, t + 0.1);
    open.frequency.exponentialRampToValueAtTime(1400, t + dur);
    mix.connect(quaver).connect(open);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.07);
    env.gain.linearRampToValueAtTime(0.38, t + dur * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [freq, q, gain] of [[760, 3.5, 1], [1750, 4.5, 0.55], [2800, 5, 0.22]]) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq * (0.95 + Math.random() * 0.1);
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      open.connect(f).connect(g).connect(env);
    }
    env.connect(out);
  }

  cricket(t) {
    const base = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) this.tone(this.ambient, 'sine', base, t + i * 0.045, 0.004, 0.025, 0.05);
  }

  owl(t) {
    if (this.samples.owl) {
      this.sample(this.ambient, this.samples.owl, t, 0.96 + Math.random() * 0.08, 0.7);
      return;
    }
    this.tone(this.ambient, 'sine', 410, t, 0.06, 0.35, 0.12, 380);
    this.tone(this.ambient, 'sine', 400, t + 0.6, 0.08, 0.7, 0.1, 360);
  }

  // --- Umgebung und Musik ---

  startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    const g = (this.windGain = ctx.createGain());
    this.windFilter = f;
    g.gain.value = 0.25;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.ambient);
    src.start();
    lfo.start();
  }

  bird(t) {
    const base = 2200 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      const s = t + i * (0.09 + Math.random() * 0.05);
      this.tone(this.ambient, 'sine', base * (0.9 + Math.random() * 0.3), s, 0.01, 0.07, 0.12, base * (1.1 + Math.random() * 0.3));
    }
  }

  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    // Vögel tagsüber außer im Winter, nachts Grillen (nicht im Winter) und ab und zu eine Eule
    if (now > this.nextBird) {
      if (this.snow < 0.5 && this.night < 0.6) this.bird(now + 0.05);
      this.nextBird = now + 3 + Math.random() * 7;
    }
    if (!this.cricketGain && this.night > 0.6 && this.snow < 0.5 && now > (this.nextCricket || 0)) {
      this.cricket(now + 0.05);
      this.nextCricket = now + 0.35 + Math.random() * 0.9;
    }
    if (this.night > 0.7 && now > (this.nextOwl || now + 1)) {
      this.owl(now + 0.05);
      this.nextOwl = now + 25 + Math.random() * 35;
    } else if (!this.nextOwl) this.nextOwl = now + 8;

    // Kleine Laute-Melodie: Zufallsweg über die Tonleiter, Bass auf 1 und 3
    const beat = 60 / 84 / 2;
    while (this.musicTime < now + 1) {
      const t = this.musicTime;
      const bar = Math.floor(this.step / 8) % 4;
      const pos = this.step % 8;
      if (pos === 0 || pos === 4) {
        const root = [0, 5, 3, 4][bar];
        this.tone(this.music, 'triangle', (BASE / 2) * 2 ** (SCALE[root] / 12), t, 0.01, beat * 3.5, 0.35);
      }
      if (Math.random() < (pos % 2 === 0 ? 0.85 : 0.35)) {
        this.note = Math.max(0, Math.min(SCALE.length - 1, this.note + Math.round(Math.random() * 4 - 2)));
        this.tone(this.music, 'triangle', BASE * 2 ** (SCALE[this.note] / 12), t, 0.005, beat * 1.6, 0.22);
        this.tone(this.music, 'sine', BASE * 2 * 2 ** (SCALE[this.note] / 12), t, 0.005, beat * 0.8, 0.05);
      }
      this.musicTime += beat;
      this.step++;
      if (this.step % 64 === 0) this.musicTime += beat * 8;
    }
  }
}

export const audio = new Audio();
