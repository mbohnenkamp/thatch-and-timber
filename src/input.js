export function setupInput(canvas, rig, { onTap, onHover, onCancel }) {
  const pointers = new Map();
  let dragging = false, startX = 0, startY = 0, button = 0, pinchDist = 0, mid = null;

  const two = () => {
    const [a, b] = [...pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = false;
      startX = e.clientX;
      startY = e.clientY;
      button = e.button;
    } else if (pointers.size === 2) {
      dragging = true;
      const t = two();
      pinchDist = t.d;
      mid = t.m;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') onHover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 1) {
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 6) dragging = true;
      if (dragging) rig.pan(dx, dy);
      else if (e.pointerType === 'mouse') onHover(e.clientX, e.clientY);
    } else if (pointers.size === 2) {
      const t = two();
      if (pinchDist > 0 && t.d > 0) rig.zoom(pinchDist / t.d);
      rig.pan(t.m.x - mid.x, t.m.y - mid.y);
      pinchDist = t.d;
      mid = t.m;
    }
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const single = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (e.type === 'pointerup' && single && !dragging) {
      if (button === 2) onCancel();
      else onTap(e.clientX, e.clientY);
    }
    if (pointers.size === 0) dragging = false;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    rig.zoom(Math.exp(e.deltaY * 0.0015));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => rig.keys.add(e.code));
  window.addEventListener('keyup', (e) => rig.keys.delete(e.code));
  window.addEventListener('blur', () => rig.keys.clear());
}
