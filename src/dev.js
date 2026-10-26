import * as THREE from 'three';
import { loadAssets } from './render/assets.js';
import { kitBuilding } from './render/kit.js';

// Prüfseite: alle Gebäude in drei Stufen nebeneinander
const types = ['warehouse', 'house', 'builderhut', 'woodcutter', 'quarry', 'gatherer', 'fisher', 'farm', 'mill', 'bakery'];
await loadAssets();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bcd');
scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x6b7a4a, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-8, 14, 10);
sun.castShadow = true;
sun.shadow.camera.left = sun.shadow.camera.bottom = -20;
sun.shadow.camera.right = sun.shadow.camera.top = 20;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 30).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#6fa84a' }));
ground.receiveShadow = true;
scene.add(ground);
types.forEach((t, i) => {
  for (let l = 1; l <= 3; l++) {
    const b = kitBuilding(t, l);
    b.position.set((i - 4.5) * 2.2, 0, (l - 2) * 2.4);
    scene.add(b);
  }
});
const params = new URLSearchParams(location.search);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 200);
const az = +(params.get('az') ?? 0.6);
camera.position.set(Math.sin(az) * 26, 16, Math.cos(az) * 26);
camera.lookAt(0, 0, 0);
renderer.render(scene, camera);
window.__ready = true;
