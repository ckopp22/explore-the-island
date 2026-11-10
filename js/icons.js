// Floating location icons: glowing spinning ring + emoji badge, hit detection, unlock burst.
import * as THREE from '../lib/three.module.min.js';

export const CAT_COLORS = { landmark: 0xff4d4d, nature: 0x4dde6a, water: 0x4db8ff, building: 0xffd84d, mountain: 0xb36bff, secret: 0xffc400 };
export const HIT_RADIUS = 25;
const CHECK_RANGE = 300;
const POP_TIME = 0.5;
const SHOW_RANGE = 2800; // icons farther than this from the camera are not drawn
const MIN_SPACING = 60, MIN_CLEARANCE = 12; // placement rules (debug validation)

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createIcons(scene, locations, found, showGhosts = true) {
  const root = new THREE.Group();
  scene.add(root);
  let ghosts = showGhosts;

  const ringGeo = new THREE.TorusGeometry(10, 1.1, 8, 28);
  const glowTex = canvasTex(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.3)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
  });
  const mats = {};
  for (const [cat, hex] of Object.entries(CAT_COLORS)) {
    mats[cat] = {
      ring: new THREE.MeshBasicMaterial({ color: hex, fog: false }),
      ghost: new THREE.MeshBasicMaterial({ color: hex, fog: false, transparent: true, opacity: 0.2, depthWrite: false }),
      glow: new THREE.SpriteMaterial({ map: glowTex, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    };
  }
  const emojiMats = {};
  const emojiMat = (e) => emojiMats[e] ||= new THREE.SpriteMaterial({
    map: canvasTex(128, (g, s) => { g.font = `${s * 0.7}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, s / 2, s / 2 + 4); }),
    fog: false, depthWrite: false,
  });

  const icons = locations.map((loc, i) => {
    const m = mats[loc.category];
    const group = new THREE.Group();
    const ring = new THREE.Mesh(ringGeo, m.ring);
    const glow = new THREE.Sprite(m.glow); glow.scale.setScalar(48);
    const badge = new THREE.Sprite(emojiMat(loc.emoji)); badge.scale.setScalar(11);
    group.add(glow, ring, badge);
    group.position.set(...loc.pos);
    root.add(group);
    return { loc, group, ring, glow, badge, m, base: loc.pos[1], phase: i * 1.7, found: false, pop: 0, show: true };
  });
  const byId = new Map(icons.map((ic) => [ic.loc.id, ic]));

  function style(ic) {
    ic.show = !ic.found || ghosts;
    ic.group.visible = ic.show;
    ic.glow.visible = ic.badge.visible = !ic.found;
    ic.ring.material = ic.found ? ic.m.ghost : ic.m.ring;
  }
  function refresh(foundSet = found, showGhost = ghosts) {
    ghosts = showGhost;
    for (const ic of icons) { ic.found = foundSet.has(ic.loc.id); ic.pop = 0; ic.ring.scale.setScalar(1); style(ic); }
  }
  refresh();

  // ---- Burst particles ----
  const bursts = [];
  function burst(loc) {
    const N = 40, pos = new Float32Array(N * 3), vel = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.acos(2 * Math.random() - 1), sp = 25 + Math.random() * 35;
      vel.push(Math.sin(b) * Math.cos(a) * sp, Math.cos(b) * sp, Math.sin(b) * Math.sin(a) * sp);
      pos.set(loc.pos, i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: CAT_COLORS[loc.category], size: 5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    root.add(pts);
    bursts.push({ pts, vel, t: 0 });
  }

  function markFound(id) {
    const ic = byId.get(id);
    if (!ic) return;
    ic.found = true; ic.pop = POP_TIME; style(ic);
    burst(ic.loc);
  }

  // Returns locations the plane is inside the hit radius of (not yet found).
  function checkHits(p) {
    const hits = [];
    for (const ic of icons) {
      if (ic.found) continue;
      const [x, y, z] = ic.loc.pos;
      const dx = p.x - x, dz = p.z - z;
      if (Math.abs(dx) > CHECK_RANGE || Math.abs(dz) > CHECK_RANGE) continue;
      const dy = p.y - y;
      if (dx * dx + dy * dy + dz * dz < HIT_RADIUS * HIT_RADIUS) hits.push(ic.loc);
    }
    return hits;
  }

  function update(dt, t, cam) {
    for (const ic of icons) {
      if (cam) {
        const dx = ic.loc.pos[0] - cam.x, dz = ic.loc.pos[2] - cam.z;
        ic.group.visible = ic.show && dx * dx + dz * dz < SHOW_RANGE * SHOW_RANGE;
      }
      if (!ic.group.visible) continue;
      ic.group.position.y = ic.base + Math.sin(t * 1.5 + ic.phase) * 2.5;
      ic.ring.rotation.y += dt * (ic.found ? 0.4 : 1.4);
      if (ic.pop > 0) {
        ic.pop = Math.max(0, ic.pop - dt);
        ic.ring.scale.setScalar(1 + (1 - ic.pop / POP_TIME) * 1.8);
      } else if (!ic.found) {
        const s = 1 + 0.1 * Math.sin(t * 3 + ic.phase);
        ic.ring.scale.setScalar(s); ic.glow.scale.setScalar(48 * s);
      } else if (ic.ring.scale.x !== 1) ic.ring.scale.setScalar(1);
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.t += dt;
      const p = b.pts.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) {
        p.array[k * 3] += b.vel[k * 3] * dt; p.array[k * 3 + 1] += b.vel[k * 3 + 1] * dt; p.array[k * 3 + 2] += b.vel[k * 3 + 2] * dt;
      }
      p.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 1 - b.t / 1.1);
      if (b.t > 1.1) { root.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  }

  // Nearest unfound icon: { d: distance, secret }.
  function nearest(p) {
    let d = Infinity, secret = false;
    for (const ic of icons) {
      if (ic.found) continue;
      const [x, y, z] = ic.loc.pos, dd = Math.hypot(p.x - x, p.y - y, p.z - z);
      if (dd < d) { d = dd; secret = ic.loc.category === 'secret'; }
    }
    return { d, secret };
  }

  // ---- Debug: hit-radius spheres and placement validation ----
  let dbg = null;
  function validate(heightAt) {
    const problems = [];
    for (const { loc } of icons) {
      const [x, y, z] = loc.pos;
      let maxG = heightAt(x, z);
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; maxG = Math.max(maxG, heightAt(x + Math.cos(a) * HIT_RADIUS, z + Math.sin(a) * HIT_RADIUS)); }
      maxG = Math.max(maxG, 0);
      if (y - maxG < MIN_CLEARANCE) problems.push({ id: loc.id, name: loc.name, issue: `inside/too close to terrain (icon ${y}, ground ${maxG.toFixed(0)} within radius)` });
      if (y < HIT_RADIUS * 0.4) problems.push({ id: loc.id, name: loc.name, issue: 'below sea level' });
    }
    for (let i = 0; i < icons.length; i++) for (let j = i + 1; j < icons.length; j++) {
      const a = icons[i].loc.pos, b = icons[j].loc.pos;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d < MIN_SPACING) problems.push({ id: icons[i].loc.id, name: icons[i].loc.name, issue: `only ${d.toFixed(0)} from ${icons[j].loc.name}` });
    }
    return problems;
  }
  function setDebug(on, heightAt) {
    if (!on) { if (dbg) dbg.visible = false; return []; }
    const problems = validate(heightAt);
    if (!dbg) {
      dbg = new THREE.InstancedMesh(new THREE.SphereGeometry(HIT_RADIUS, 12, 8), new THREE.MeshBasicMaterial({ wireframe: true, fog: false, transparent: true, opacity: 0.55 }), icons.length);
      dbg.frustumCulled = false;
      root.add(dbg);
    }
    const bad = new Set(problems.map((p) => p.id)), m = new THREE.Matrix4(), c = new THREE.Color();
    icons.forEach((ic, i) => {
      m.makeTranslation(...ic.loc.pos); dbg.setMatrixAt(i, m);
      dbg.setColorAt(i, c.set(bad.has(ic.loc.id) ? 0xff2222 : 0x33ff66));
    });
    dbg.instanceMatrix.needsUpdate = dbg.instanceColor.needsUpdate = true;
    dbg.visible = true;
    return problems;
  }

  return { update, nearest, checkHits, markFound, refresh, setDebug, validate, group: root };
}
