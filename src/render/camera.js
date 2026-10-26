import * as THREE from 'three';

export class CameraRig {
  constructor(camera, size) {
    this.camera = camera;
    this.size = size;
    this.target = new THREE.Vector3(size / 2, 0, size / 2);
    this.dist = 20;
    this.az = Math.PI / 4;
    this.goalAz = this.az;
    this.pitch = 0.9;
    this.keys = new Set();
    this.yInit = false;
  }

  forward() { return [-Math.sin(this.az), -Math.cos(this.az)]; }
  right() { return [Math.cos(this.az), -Math.sin(this.az)]; }

  pan(dx, dy) {
    const k = (this.dist * 0.9) / window.innerHeight;
    const [fx, fz] = this.forward(), [rx, rz] = this.right();
    this.target.x += -rx * dx * k + fx * dy * k;
    this.target.z += -rz * dx * k + fz * dy * k;
    this.clamp();
  }

  zoom(factor) { this.dist = Math.min(55, Math.max(7, this.dist * factor)); }
  rotate(dir) { this.goalAz += (dir * Math.PI) / 2; }

  clamp() {
    this.target.x = Math.min(this.size, Math.max(0, this.target.x));
    this.target.z = Math.min(this.size, Math.max(0, this.target.z));
  }

  update(dt, heightAt) {
    const k = this.keys;
    let f = 0, r = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) r += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) r -= 1;
    if (f || r) {
      const sp = this.dist * 0.9 * dt;
      const [fx, fz] = this.forward(), [rx, rz] = this.right();
      this.target.x += (fx * f + rx * r) * sp;
      this.target.z += (fz * f + rz * r) * sp;
      this.clamp();
    }

    this.az += (this.goalAz - this.az) * Math.min(1, dt * 8);
    const ty = heightAt(this.target.x, this.target.z);
    this.target.y = this.yInit ? this.target.y + (ty - this.target.y) * Math.min(1, dt * 4) : ty;
    this.yInit = true;

    const h = Math.cos(this.pitch) * this.dist;
    this.camera.position.set(
      this.target.x + Math.sin(this.az) * h,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.az) * h,
    );
    this.camera.lookAt(this.target);
  }
}
