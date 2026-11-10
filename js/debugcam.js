// Free-fly debug camera. Toggle with ` (backquote) or load with ?debug.
// WASD move, Q/E down/up, Shift = fast, drag (mouse or touch) to look, wheel = speed, H = hit radii + placement check.
import * as THREE from '../lib/three.module.min.js';

export function createDebugCam(camera, canvas, hintEl, getInfo) {
  const cam = { active: false, yaw: 0, pitch: 0, speed: 150 };
  const keys = new Set();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const dir = new THREE.Vector3();
  let dragging = false, infoT = 0;

  function toggle(on = !cam.active) {
    cam.active = on;
    document.body.classList.toggle('debug', on);
    hintEl.classList.toggle('hidden', !on);
    if (on) { euler.setFromQuaternion(camera.quaternion, 'YXZ'); cam.yaw = euler.y; cam.pitch = euler.x; }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') return toggle();
    if (cam.active) keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('pointerdown', () => { if (cam.active) dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!cam.active || !dragging) return;
    cam.yaw -= e.movementX * 0.003;
    cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - e.movementY * 0.003));
  });
  canvas.addEventListener('wheel', (e) => {
    if (cam.active) cam.speed = Math.max(10, Math.min(2000, cam.speed * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
  }, { passive: true });

  cam.update = (dt) => {
    euler.set(cam.pitch, cam.yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    const k = (c) => (keys.has(c) ? 1 : 0);
    dir.set(k('KeyD') - k('KeyA'), k('KeyE') - k('KeyQ'), k('KeyS') - k('KeyW'));
    if (dir.lengthSq()) {
      const sp = cam.speed * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4 : 1) * dt;
      const up = dir.y; dir.y = 0;
      dir.applyQuaternion(camera.quaternion);
      camera.position.addScaledVector(dir, sp);
      camera.position.y += up * sp;
    }
    infoT -= dt;
    if (infoT <= 0) {
      infoT = 0.25;
      const p = camera.position;
      hintEl.textContent = `DEBUG CAM  WASD/QE move, Shift fast, drag look, wheel speed, H hit radii (${Math.round(cam.speed)})  |  ` + getInfo(p);
    }
  };

  if (new URLSearchParams(location.search).has('debug')) toggle(true);
  return cam;
}
