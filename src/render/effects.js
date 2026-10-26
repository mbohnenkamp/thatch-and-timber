import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { windowMat } from './models.js';

// Nachbearbeitung: Umgebungsschatten (GTAO) und leichtes Leuchten
export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gtao = new GTAOPass(scene, camera, size.x, size.y);
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1 });
    this.gtao.blendIntensity = 0.85;
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(size, 0.25, 0.4, 0.95);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(w, h);
  }

  render() { this.composer.render(); }
}

const smooth = (a, b, t) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export const DAY_LENGTH = 600;

// Tag und Nacht: Sonnenstand, Licht, Himmel, Nebel, leuchtende Fenster
export class DayNight {
  constructor({ scene, sun, hemi, water, skyColor, postfx }) {
    Object.assign(this, { scene, sun, hemi, water, postfx });
    this.on = true;
    this.day = new THREE.Color(skyColor);
    this.dusk = new THREE.Color('#f2a36b');
    this.night = new THREE.Color('#2a3a66');
    this.sunDay = new THREE.Color('#fff1d6');
    this.sunDusk = new THREE.Color('#ffc58a');
    this.moon = new THREE.Color('#b4c6ff');
    this.hemiSkyDay = hemi.color.clone();
    this.hemiGroundDay = hemi.groundColor.clone();
    this.hemiSkyNight = new THREE.Color('#9fb4ea');
    this.hemiGroundNight = new THREE.Color('#4a5868');
    this.sky = new THREE.Color();
    this.sunDir = new THREE.Vector3();
    this.daylight = 1;
  }

  update(gameTime) {
    // Start am Vormittag; ohne Tag/Nacht bleibt es Nachmittag
    const phase = this.on ? (gameTime / DAY_LENGTH + 0.12) % 1 : 0.2;
    const a = phase * Math.PI * 2;
    const elevation = Math.sin(a) + 0.45;
    const d = (this.daylight = smooth(-0.3, 0.45, elevation));
    const dusk = 1 - Math.abs(d - 0.5) * 2;

    if (d < 0.5) this.sky.copy(this.night).lerp(this.dusk, d * 2);
    else this.sky.copy(this.dusk).lerp(this.day, (d - 0.5) * 2);
    this.scene.background.copy(this.sky);
    this.scene.fog.color.copy(this.sky);

    // Mondnacht: dunkler und bläulich, aber gut lesbar
    this.sun.intensity = 1.8 + 0.6 * d;
    this.sun.color.copy(d < 0.35 ? this.moon : this.sunDay).lerp(this.sunDusk, dusk * 0.7);
    this.hemi.intensity = 1.8 - 0.2 * d;
    if (this.postfx) this.postfx.renderer.toneMappingExposure = 1.0 - 0.15 * d;
    this.hemi.color.copy(this.hemiSkyNight).lerp(this.hemiSkyDay, d);
    this.hemi.groundColor.copy(this.hemiGroundNight).lerp(this.hemiGroundDay, d);
    this.sunDir.set(Math.cos(a) * 0.8, Math.max(0.35, elevation), 0.45).normalize();

    windowMat.opacity = Math.max(0, 1 - d * 1.6) * 0.95;
    if (this.water) this.water.material.envMapIntensity = 0.25 + 0.75 * d;
    if (this.postfx) this.postfx.bloom.strength = 0.2 + 0.45 * (1 - d);
  }
}
