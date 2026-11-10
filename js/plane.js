// Plane model, arcade flight physics (no stall, no crash, auto-level, soft boundary) and chase camera.
// Heading 0 = north (-z), pi/2 = east (+x). Model nose points along local -z.
import * as THREE from '../lib/three.module.min.js';

const D2R = Math.PI / 180;
const CFG = {
  minSpeed: 22, maxSpeed: 58, launchSpeed: 28, floatSpeed: 6, sinkRate: 3.5,
  maxBank: 55 * D2R, maxPitch: 40 * D2R, turnRate: 1.25,
  boundSoft: 4300, boundHard: 4800, ceiling: 1150,
};
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function buildModel() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const WHITE = mat(0xf4f4f4), RED = mat(0xd8352a), GLASS = mat(0x6fc7ff), DARK = mat(0x2b2b2b);
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  add(new THREE.CylinderGeometry(0.9, 0.6, 8, 8).rotateX(Math.PI / 2), WHITE, 0, 0, 0);
  add(new THREE.CylinderGeometry(0.95, 0.95, 1.2, 8).rotateX(Math.PI / 2), RED, 0, 0, -4.3);
  add(new THREE.ConeGeometry(0.5, 1, 8).rotateX(-Math.PI / 2), RED, 0, 0, -5.4);
  add(new THREE.BoxGeometry(12, 0.25, 2.2), RED, 0, -0.15, -0.6);
  add(new THREE.BoxGeometry(12.1, 0.27, 0.5), WHITE, 0, -0.15, -1.3);
  add(new THREE.BoxGeometry(0.2, 2, 1.8), RED, 0, 1.3, 3.5);
  add(new THREE.BoxGeometry(4.2, 0.18, 1.2), RED, 0, 0.2, 3.7);
  add(new THREE.SphereGeometry(0.75, 8, 6).scale(1, 0.8, 1.7), GLASS, 0, 0.8, -0.8);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.12, 1.1, 0.12), DARK, s * 1.3, -0.9, -1.2);
    add(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8).rotateZ(Math.PI / 2), DARK, s * 1.3, -1.5, -1.2);
  }
  const prop = new THREE.Group();
  prop.position.set(0, 0, -6);
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.1), DARK));
  prop.add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 0.1), DARK).rotateZ(0));
  g.add(prop);
  return { group: g, prop };
}

export function createPlane(scene, world) {
  const { group, prop } = buildModel();
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  group.visible = false; shadow.visible = false;
  scene.add(group, shadow);

  const RW = world.RUNWAY;
  const p = {
    group, warn: 0, flying: false,
    pos: new THREE.Vector3(), heading: Math.PI / 2, pitch: 0, bank: 0, speed: 0, air: 0, spin: 0,
  };
  const cam = { h: 0, pitch: 0, fov: 62, init: false, look: new THREE.Vector3() };
  const fwd = new THREE.Vector3(), tmp = new THREE.Vector3(), off = new THREE.Vector3(), eul = new THREE.Euler(0, 0, 0, 'YXZ');

  p.reset = () => {
    p.pos.set(RW.x - RW.length / 2 + 60, RW.y + 1.6, RW.z);
    p.heading = RW.heading; p.pitch = 0; p.bank = 0; p.speed = 0; p.air = 0; p.warn = 0; p.flying = false;
    cam.init = false;
    apply(0);
  };
  p.launch = () => { p.flying = true; p.speed = CFG.launchSpeed; };
  p.setVisible = (v) => { group.visible = v; shadow.visible = v; };

  const floorAt = (x, z) => Math.max(world.heightAt(x, z) + (p.air < 4 ? 1.2 + 5.8 * sstep(0, 4, p.air) : 7), 6);

  function apply(dt) {
    p.spin += (p.flying ? 70 + p.speed * 3 : 15) * dt;
    prop.rotation.z = p.spin;
    group.position.copy(p.pos);
    group.rotation.set(p.pitch, -p.heading, -p.bank, 'YXZ');
    const g = Math.max(world.heightAt(p.pos.x, p.pos.z), 0);
    shadow.position.set(p.pos.x, g + 0.4, p.pos.z);
    shadow.scale.setScalar(Math.max(2, 7 - (p.pos.y - g) * 0.02));
  }

  p.update = (dt, input) => {
    if (!p.flying) return;
    p.air += dt;
    // Hold the gas pad: 50% speed. Release: the plane stalls, slows to a crawl and floats down gently.
    let target = input.throttle > 0 ? (CFG.minSpeed + (CFG.maxSpeed - CFG.minSpeed) * input.throttle) * (1 - 0.25 * Math.sin(p.pitch)) : CFG.floatSpeed;
    if (p.air < 3) target = Math.max(target, 30);
    p.speed = damp(p.speed, target, input.throttle > 0 ? 1.2 : 0.9, dt);
    const stall = 1 - sstep(CFG.floatSpeed + 2, CFG.minSpeed, p.speed);

    // Soft world boundary: blend steering toward the island center.
    let turn = input.turn;
    const d = Math.hypot(p.pos.x, p.pos.z);
    p.warn = sstep(CFG.boundSoft, CFG.boundHard, d);
    if (d > CFG.boundSoft) {
      const err = wrap(Math.atan2(-p.pos.x, p.pos.z) - p.heading);
      turn += (Math.max(-1, Math.min(1, err * 1.5)) - turn) * p.warn;
    }

    p.bank = damp(p.bank, turn * CFG.maxBank, turn ? 3 : 1.8, dt);
    p.heading += Math.sin(p.bank) * CFG.turnRate * (0.4 + 0.6 * (1 - stall)) * dt;

    // Pitch: input, auto-level, takeoff lift, and gentle push away from terrain/water/ceiling.
    let pitchT = input.pitch * CFG.maxPitch;
    pitchT -= stall * 14 * D2R;
    if (p.air < 3) pitchT = Math.max(pitchT, 12 * D2R);
    const hx = Math.sin(p.heading), hz = -Math.cos(p.heading);
    const need = Math.max(floorAt(p.pos.x, p.pos.z), floorAt(p.pos.x + hx * p.speed, p.pos.z + hz * p.speed)) - p.pos.y;
    if (need > -8) pitchT = Math.max(pitchT, Math.min(1, (need + 8) * 0.05) * CFG.maxPitch);
    if (p.pos.y > CFG.ceiling) pitchT = Math.min(pitchT, -0.3);
    p.pitch = damp(p.pitch, pitchT, input.pitch ? 2.4 : 1.6, dt);

    fwd.set(hx * Math.cos(p.pitch), Math.sin(p.pitch), hz * Math.cos(p.pitch));
    p.pos.addScaledVector(fwd, p.speed * dt);
    p.pos.y -= CFG.sinkRate * stall * dt;
    const floor = floorAt(p.pos.x, p.pos.z);
    if (p.pos.y < floor) { p.pos.y = floor; p.pitch = Math.max(p.pitch, 0); }
    apply(dt);
  };

  // Smooth chase camera: lags behind, follows heading/pitch softly, widens FOV with speed.
  p.updateCamera = (camera, dt) => {
    apply(p.flying ? 0 : dt);
    const k = cam.init ? 1 : 0;
    cam.h = k ? cam.h + wrap(p.heading - cam.h) * (1 - Math.exp(-4 * dt)) : p.heading;
    cam.pitch = k ? damp(cam.pitch, p.pitch * 0.4, 3, dt) : 0;
    eul.set(cam.pitch, -cam.h, 0, 'YXZ');
    off.set(0, 4.5, 16).applyEuler(eul);
    tmp.copy(p.pos).add(off);
    if (k) camera.position.set(damp(camera.position.x, tmp.x, 7, dt), damp(camera.position.y, tmp.y, 7, dt), damp(camera.position.z, tmp.z, 7, dt));
    else camera.position.copy(tmp);
    camera.position.y = Math.max(camera.position.y, world.heightAt(camera.position.x, camera.position.z) + 3, 3);
    fwd.set(Math.sin(p.heading) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.heading) * Math.cos(p.pitch));
    cam.look.copy(p.pos).addScaledVector(fwd, 25); cam.look.y += 2;
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.look);
    camera.rotateZ(-p.bank * 0.25);
    const fov = 62 + 14 * sstep(CFG.minSpeed, CFG.maxSpeed, p.speed);
    cam.fov = k ? damp(cam.fov, fov, 3, dt) : fov;
    if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    cam.init = true;
  };

  p.reset();
  return p;
}
