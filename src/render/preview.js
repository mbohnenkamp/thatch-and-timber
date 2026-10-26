import { Game } from '../game.js';
import { Renderer } from './scene.js';

// Rendert ein Vorschaubild einer Landschaft mit Startdorf (für das Menü)
export function renderPreview(mapType, seed, size, width = 640, height = 340) {
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;`;
  document.body.appendChild(box);
  const game = Game.create(mapType, seed, size);
  const r = new Renderer(box, game, { graphics: 'high', dayNight: false });
  r.renderer.setPixelRatio(1);
  r.renderer.setSize(width, height);
  r.postfx.setSize(width, height, 1);
  r.rig.dist = 19;
  r.rig.pitch = 0.55;
  r.rig.target.x += 1;
  for (let i = 0; i < 3; i++) r.update(0.016);
  r.postfx.render();
  const url = r.renderer.domElement.toDataURL('image/jpeg', 0.85);
  r.dispose();
  box.remove();
  return url;
}
