// Geführte erste Schritte beim allerersten Spiel: ein Rahmen zeigt auf den nächsten Knopf.
// Jeder Schritt ist erledigt, sobald das Gebäude gesetzt ist; überspringbar, danach nie wieder.
const KEY = 'siedler-dorf-intro';

const has = (g, type) => g.buildings.some((b) => b.type === type && !b.removed);

const STEPS = [
  {
    text: (g) => `Willkommen in ${g.townName}! Ziehen verschiebt die Karte, Mausrad oder zwei Finger zoomen, Q und E drehen. Ich zeige dir die ersten Schritte.`,
    next: 'Weiter',
  },
  {
    text: () => 'Holz brauchst du für fast alles. Tippe unten auf „Holzfäller“ und dann auf einen freien Platz nahe am Wald.',
    group: 'base', build: 'woodcutter',
    done: (g) => has(g, 'woodcutter'),
  },
  {
    text: () => 'Gut! Stein kommt aus dem Steinbruch. Setze ihn in die Nähe der grauen Felsen.',
    group: 'base', build: 'quarry',
    done: (g) => has(g, 'quarry'),
  },
  {
    text: () => 'Deine Siedler brauchen Nahrung. Wechsle zu „Nahrung“ und baue eine Sammlerhütte bei den Beerensträuchern.',
    group: 'food', build: 'gatherer',
    done: (g) => has(g, 'gatherer'),
  },
  {
    text: () => 'Mehr Siedler brauchen Platz. Baue unter „Grundbau“ ein Wohnhaus.',
    group: 'base', build: 'house',
    done: (g) => has(g, 'house'),
  },
  {
    text: () => 'Die Bauarbeiter tragen jetzt Material zu den Baustellen. Oben links steht deine nächste Aufgabe: Erfüllst du sie, wächst dein Ort und du bekommst neue Gebäude. Viel Spaß!',
    target: '#goal', next: 'Los geht’s',
  },
];

export const introDone = () => {
  try { return localStorage.getItem(KEY) === 'done'; } catch { return false; }
};

export class Intro {
  constructor(root, hud) {
    this.hud = hud;
    this.step = 0;
    this.glow = null;
    const el = (this.el = document.createElement('div'));
    el.id = 'intro';
    el.innerHTML = `
      <div class="tip-head">Erste Schritte <small></small></div>
      <p class="tip-text"></p>
      <div class="tip-actions">
        <button data-t="next" class="primary"></button>
        <button data-t="skip">Überspringen</button>
      </div>`;
    root.appendChild(el);
    this.text = el.querySelector('.tip-text');
    this.nextBtn = el.querySelector('[data-t=next]');
    el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]')?.dataset.t;
      if (t === 'next') this.go(this.step + 1);
      if (t === 'skip') this.finish();
    });
    this.shown = -1;
  }

  get active() { return this.step < STEPS.length; }

  go(step) {
    this.step = step;
    if (!this.active) this.finish();
  }

  finish() {
    this.step = STEPS.length;
    this.mark(null);
    this.el.remove();
    try { localStorage.setItem(KEY, 'done'); } catch { /* egal */ }
  }

  mark(node) {
    if (node === this.glow) return;
    this.glow?.classList.remove('intro-glow');
    node?.classList.add('intro-glow');
    this.glow = node;
  }

  update(game) {
    if (!this.active) return;
    let s = STEPS[this.step];
    while (s.done?.(game)) {
      this.go(this.step + 1);
      if (!this.active) return;
      s = STEPS[this.step];
    }
    if (this.shown !== this.step) {
      this.shown = this.step;
      this.text.textContent = s.text(game);
      this.el.querySelector('small').textContent = `${this.step + 1}/${STEPS.length}`;
      this.nextBtn.hidden = !s.next;
      this.nextBtn.textContent = s.next || '';
      // Letzter Schritt zeigt nach oben: Karte nach unten rücken, damit sie die Aufgabe nicht verdeckt
      const last = this.step === STEPS.length - 1;
      this.el.classList.toggle('low', last);
      this.el.querySelector('[data-t=skip]').hidden = last;
    }
    // Erst die richtige Gruppe der Bauleiste, dann das Gebäude
    const hud = this.hud.el;
    if (s.build) this.mark(this.hud.group === s.group ? hud.querySelector(`.build[data-t=${s.build}]`) : hud.querySelector(`.cats [data-g=${s.group}]`));
    else this.mark(s.target ? hud.querySelector(s.target) : null);
  }
}
