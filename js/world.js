// World: heightmap terrain (chunked, LOD, vertex colors), ocean, sky, clouds, runway.
// Units: 1 unit = 1 m. Island spans about +/-3500 on x and z. North = -z, south = +z.
import * as THREE from '../lib/three.module.min.js';

export const WORLD_HALF = 4000;
const CHUNK = 500;
const LODS = [{ n: 32, dist: 900 }, { n: 16, dist: 1900 }, { n: 8, dist: Infinity }];
const CUTOFF = 4300;
const SEA_FLOOR = -30;
export const FOG_COLOR = 0xbfe6f5;

// ---------- Noise ----------
function hash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function fbm(x, z, oct) { // about -1..1
  let s = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < oct; i++) { s += amp * noise(x, z); norm += amp; x *= 2.03; z *= 2.03; amp *= 0.5; }
  return (s / norm) * 2 - 1;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (r, s) => Math.exp(-(r / s) * (r / s));

// ---------- Island layout ----------
const ISLETS = [
  { x: -3300, z: 1900, h: 120, s: 200 }, { x: 3500, z: -2300, h: 140, s: 230 },
  { x: -2700, z: -3200, h: 110, s: 180 }, { x: 3300, z: 3100, h: 100, s: 170 },
  { x: 600, z: -3500, h: 130, s: 210 }, { x: -3600, z: -900, h: 100, s: 160 },
  { x: -1100, z: 3500, h: 110, s: 190 },
];
const HARBOR_ANGLE = Math.atan2(2000, 2100);

function islandRadius(x, z) {
  const ang = Math.atan2(z, x), cx = Math.cos(ang), cz = Math.sin(ang);
  let da = Math.abs(ang - HARBOR_ANGLE); if (da > Math.PI) da = 2 * Math.PI - da;
  return 2500 + 450 * (noise(cx * 1.7 + 50, cz * 1.7 + 50) - 0.5) * 2
    + 140 * (noise(cx * 4 + 90, cz * 4 + 90) - 0.5) * 2 + 450 * gauss(da, 0.2);
}

// Regions are soft zones (gaussian weights). 'c' is the center, 's' the spread, 'amp' the hilliness.
const REGIONS = [
  { id: 'beach', name: 'Sunny Beach Coast', c: [0, 2100], s: 900, amp: 12, col: 0x92d14f },
  { id: 'jungle', name: 'Jungle Interior', c: [-250, -100], s: 950, amp: 170, col: 0x2b8a3a },
  { id: 'volcano', name: 'Volcano Highlands', c: [1500, -1300], s: 650, amp: 110, col: 0x5b4a40 },
  { id: 'snowy', name: 'Snowy Peak', c: [-350, -1850], s: 700, amp: 240, col: 0x5f9a4a },
  { id: 'farmland', name: 'Farmland Valley', c: [-1700, 500], s: 750, amp: 14, col: 0xb9d95a },
  { id: 'oldtown', name: 'Old Town', c: [1600, 300], s: 700, amp: 28, col: 0x9ec27a },
  { id: 'harbor', name: 'Harbor and Lighthouse Point', c: [2100, 2000], s: 700, amp: 35, col: 0xa8b77f },
  { id: 'islets', name: 'Offshore Islets', c: [0, 0], s: 0, amp: 0, col: 0x7cc45a },
];
const R = Object.fromEntries(REGIONS.map((r) => [r.id, r]));
export { REGIONS };

const _w = new Float32Array(REGIONS.length);
function regionWeights(x, z) { // fills _w, returns total
  let tot = 0;
  for (let i = 0; i < REGIONS.length - 1; i++) {
    const r = REGIONS[i];
    _w[i] = gauss(Math.hypot(x - r.c[0], z - r.c[1]), r.s); tot += _w[i];
  }
  let iw = 0;
  for (const t of ISLETS) iw = Math.max(iw, gauss(Math.hypot(x - t.x, z - t.z), t.s * 1.6));
  _w[REGIONS.length - 1] = iw * 3; tot += iw * 3;
  return tot + 1e-6;
}
export function regionAt(x, z) {
  regionWeights(x, z);
  let best = 0;
  for (let i = 1; i < _w.length; i++) if (_w[i] > _w[best]) best = i;
  return REGIONS[best];
}

// ---------- Height ----------
function heightBase(x, z) {
  const s = islandRadius(x, z) - Math.hypot(x, z);
  let h = SEA_FLOOR + 42 * sstep(-200, 150, s);
  const tot = regionWeights(x, z);
  let amp = 0;
  for (let i = 0; i < REGIONS.length - 1; i++) amp += _w[i] * REGIONS[i].amp;
  amp /= tot;
  const inland = sstep(60, 600, s);
  h += 35 * sstep(0, 900, s);
  h += amp * (0.5 + 0.5 * fbm(x * 0.0016, z * 0.0016, 4)) * inland;
  h += 6 * fbm(x * 0.02, z * 0.02, 2) * sstep(0, 200, s);
  const m = sstep(0, 300, s);
  // Snowy Peak
  let r = Math.hypot(x - R.snowy.c[0], z - R.snowy.c[1]);
  h += m * (820 * gauss(r, 480) * (0.85 + 0.15 * fbm(x * 0.004, z * 0.004, 3)) + 90 * gauss(r, 700) * Math.abs(fbm(x * 0.006, z * 0.006, 3)));
  // Volcano (cone with crater)
  r = Math.hypot(x - R.volcano.c[0], z - R.volcano.c[1]);
  h += m * (700 * Math.exp(-Math.pow(r / 430, 1.5)) - 290 * gauss(r, 120));
  // Ridge west of Farmland Valley
  h += m * 320 * gauss(Math.hypot(x + 2150, z + 350), 420);
  for (const t of ISLETS) {
    const rr = Math.hypot(x - t.x, z - t.z) * (1 + 0.3 * (noise(x * 0.01, z * 0.01) - 0.5));
    h += t.h * gauss(rr, t.s);
  }
  return h;
}

// Runway sits on the south coast, parallel to the shore, found by scanning inland.
export const RUNWAY = (() => {
  let z = 3700;
  while (z > 0 && heightBase(0, z) < 10) z -= 10;
  const rz = z - 120;
  return { x: 0, z: rz, y: Math.min(14, Math.max(6, heightBase(0, rz))), length: 640, width: 38, heading: Math.PI / 2 };
})();
R.beach.c = [0, RUNWAY.z - 100];

const PAD = { hl: 400, hw: 90, blendL: 220, blendW: 160 };
export function heightAt(x, z) {
  let h = heightBase(x, z);
  const t = Math.max((Math.abs(x - RUNWAY.x) - PAD.hl) / PAD.blendL, (Math.abs(z - RUNWAY.z) - PAD.hw) / PAD.blendW);
  const w = 1 - sstep(0, 1, t);
  if (w > 0) h += (RUNWAY.y - h) * w;
  return h;
}

// ---------- Vertex colors ----------
const col = (hex) => new THREE.Color(hex);
const SAND = col(0xf2dd9b), SEABED_SHALLOW = col(0xd9d29a), SEABED_DEEP = col(0x0f6f8f);
const ROCK = col(0x7d7a74), ROCK_HI = col(0x8a8a92), SNOW = col(0xffffff);
const FARM = [col(0xb9d95a), col(0xd7d062), col(0x8fc552), col(0xc8a85c)];
const REGION_COL = REGIONS.map((r) => col(r.col));
const _c = new THREE.Color(), _g = new THREE.Color();

function colorAt(x, z, h, slope, out) {
  if (h < 0) { // seabed
    return out.copy(SEABED_SHALLOW).lerp(SEABED_DEEP, sstep(0, 1, Math.min(1, -h / 28)));
  }
  const tot = regionWeights(x, z);
  _g.setRGB(0, 0, 0);
  for (let i = 0; i < _w.length; i++) {
    const c = i === 4 ? _c.copy(FARM[Math.floor(hash(Math.floor(x / 150), Math.floor(z / 120)) * 4) % 4]) : REGION_COL[i];
    _g.r += c.r * _w[i]; _g.g += c.g * _w[i]; _g.b += c.b * _w[i];
  }
  _g.r /= tot; _g.g /= tot; _g.b /= tot;
  const beachShare = _w[0] / tot, volcShare = _w[2] / tot;
  const n = noise(x * 0.03, z * 0.03) - 0.5;
  _g.lerp(ROCK_HI, sstep(330, 520, h + n * 80));
  _g.lerp(ROCK, sstep(0.55, 0.95, slope) * 0.9);
  _g.lerp(SAND, 1 - sstep(2.5 + 9 * beachShare, 5.5 + 11 * beachShare, h));
  _g.lerp(SNOW, sstep(560, 640, h + n * 90) * (1 - volcShare));
  const v = 1 + n * 0.16;
  return out.setRGB(_g.r * v, _g.g * v, _g.b * v);
}

// ---------- Chunk geometry ----------
function buildChunk(x0, z0, n) {
  const step = CHUNK / n, m = n + 3;
  const pos = new Float32Array(m * m * 3), colr = new Float32Array(m * m * 3);
  const c = new THREE.Color();
  let k = 0;
  for (let j = 0; j < m; j++) {
    const jj = j - 1, zi = Math.min(n, Math.max(0, jj));
    for (let i = 0; i < m; i++) {
      const ii = i - 1, xi = Math.min(n, Math.max(0, ii));
      const wx = x0 + xi * step, wz = z0 + zi * step;
      const h = heightAt(wx, wz);
      const slope = Math.hypot(heightAt(wx + 12, wz) - h, heightAt(wx, wz + 12) - h) / 12;
      colorAt(wx, wz, h, slope, c);
      const skirt = ii < 0 || ii > n || jj < 0 || jj > n;
      pos[k] = xi * step; pos[k + 1] = skirt ? h - 80 : h; pos[k + 2] = zi * step;
      colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b;
      k += 3;
    }
  }
  const idx = new Uint16Array((m - 1) * (m - 1) * 6);
  let q = 0;
  for (let j = 0; j < m - 1; j++) for (let i = 0; i < m - 1; i++) {
    const a = j * m + i, b = (j + 1) * m + i, cc = a + 1, d = b + 1;
    idx[q++] = a; idx[q++] = b; idx[q++] = cc; idx[q++] = cc; idx[q++] = b; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

function hasLand(x0, z0) {
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 8; i++) {
    if (heightAt(x0 + (i * CHUNK) / 8, z0 + (j * CHUNK) / 8) > SEA_FLOOR + 0.5) return true;
  }
  return false;
}

// ---------- Ocean, sky, clouds, runway ----------
function makeOcean(timeUniform) {
  const SIZE = 9000, SEG = 144; // ~62 m grid: fewer triangles, still 3+ samples per wave
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({ color: 0x1aa3c8, specular: 0x99bbdd, shininess: 70, flatShading: true, transparent: true, opacity: 0.85, depthWrite: false });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
float waveH(vec2 p){ return 1.6*sin(p.x*0.011+uTime*0.9) + 1.2*sin(p.y*0.017-uTime*0.7+1.3) + 0.8*sin((p.x+p.y)*0.03+uTime*1.3); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec4 wp = modelMatrix * vec4(transformed, 1.0);
transformed.y += waveH(wp.xz);`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.snap = SIZE / SEG;
  return mesh;
}

function makeSky(sunDir, fogColor) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2f86d6) }, horizon: { value: fogColor }, sun: { value: sunDir } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sun; varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 c = mix(horizon, top, pow(clamp(d.y, 0.0, 1.0), 0.5));
  float s = max(dot(d, sun), 0.0);
  c += vec3(1.0,0.95,0.8) * (pow(s, 48.0) * 0.35 + smoothstep(0.9993, 0.9997, s));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 12), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -1000;
  return mesh;
}

function makeClouds() {
  const PUFFS = 5, COUNT = 70;
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4, flatShading: true }), COUNT * PUFFS);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967295; };
  let k = 0;
  for (let c = 0; c < COUNT; c++) {
    const cx = (rnd() - 0.5) * 9000, cz = (rnd() - 0.5) * 9000, cy = 420 + rnd() * 260, size = 60 + rnd() * 80;
    for (let i = 0; i < PUFFS; i++) {
      const r = size * (0.6 + rnd() * 0.6);
      p.set(cx + (rnd() - 0.5) * size * 2.4, cy + (rnd() - 0.5) * size * 0.3, cz + (rnd() - 0.5) * size * 1.4);
      s.set(r, r * 0.55, r);
      m.compose(p, q, s); mesh.setMatrixAt(k++, m);
    }
  }
  mesh.frustumCulled = false;
  return mesh;
}

function makeRunway() {
  const g = new THREE.Group();
  const L = RUNWAY.length, W = RUNWAY.width;
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const box = (w, h, d, c, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); b.position.set(x, y, z); g.add(b); return b; };
  box(L, 0.6, W, 0x3a3f46, 0, 0.3, 0);
  box(L - 20, 0.1, 0.9, 0xffffff, 0, 0.62, W / 2 - 1.5);
  box(L - 20, 0.1, 0.9, 0xffffff, 0, 0.62, -W / 2 + 1.5);
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(14, 0.1, 1.2), mat(0xffffff), 28);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 28; i++) { m.makeTranslation(-L / 2 + 30 + i * 21, 0.62, 0); dashes.setMatrixAt(i, m); }
  g.add(dashes);
  for (const e of [-1, 1]) for (let i = -3; i <= 3; i++) if (i) box(18, 0.1, 1.4, 0xffffff, e * (L / 2 - 14), 0.62, i * 4.2);
  box(120, 0.5, 60, 0x555a62, -120, 0.25, 50);                        // apron
  box(50, 18, 30, 0xd9d9d9, -160, 9, 85);                              // hangar
  box(50, 2, 31, 0xc0392b, -160, 18.5, 85);
  box(8, 22, 8, 0xeeeeee, -60, 11, 50);                                // control tower
  box(12, 5, 12, 0x6fb7d6, -60, 24, 50);
  const pole = box(0.6, 12, 0.6, 0xffffff, 120, 6, -40);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 6), mat(0xff6a3d));
  sock.rotation.z = -Math.PI / 2; sock.position.set(124, 12, -40); g.add(sock);
  g.position.set(RUNWAY.x, RUNWAY.y, RUNWAY.z);
  return g;
}

// ---------- Public API ----------
export function createWorld(scene) {
  const fogColor = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(fogColor, 800, 4000);
  scene.background = fogColor;

  const sunDir = new THREE.Vector3(0.5, 0.7, -0.5).normalize();
  const sunLight = new THREE.DirectionalLight(0xfff2d8, 3.0);
  sunLight.position.copy(sunDir).multiplyScalar(1000);
  scene.add(sunLight, new THREE.HemisphereLight(0xbfe3ff, 0x8aa86a, 2.0));

  const sky = makeSky(sunDir, fogColor);
  const timeU = { value: 0 };
  const ocean = makeOcean(timeU);
  const seabed = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x0f6f8f }));
  seabed.position.y = SEA_FLOOR - 4;
  const clouds = makeClouds();
  scene.add(sky, ocean, seabed, clouds, makeRunway());

  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const chunks = [];
  const count = (WORLD_HALF * 2) / CHUNK;
  for (let j = 0; j < count; j++) for (let i = 0; i < count; i++) {
    const x0 = -WORLD_HALF + i * CHUNK, z0 = -WORLD_HALF + j * CHUNK;
    if (!hasLand(x0, z0)) continue;
    const mesh = new THREE.Mesh(undefined, terrainMat);
    mesh.position.set(x0, 0, z0); mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.visible = false;
    scene.add(mesh);
    chunks.push({ mesh, x0, z0, cx: x0 + CHUNK / 2, cz: z0 + CHUNK / 2, geos: [null, null, null], lod: -1 });
  }

  // Picks each chunk's LOD from camera distance; builds missing geometry (up to `budget` per call).
  function update(camera, time, budget = 4) {
    timeU.value = time;
    const cp = camera.position;
    sky.position.copy(cp);
    ocean.position.set(Math.round(cp.x / ocean.userData.snap) * ocean.userData.snap, 0, Math.round(cp.z / ocean.userData.snap) * ocean.userData.snap);
    clouds.rotation.y = time * 0.002;
    for (const c of chunks) {
      const d = Math.hypot(c.cx - cp.x, c.cz - cp.z) - CHUNK * 0.7;
      if (d > CUTOFF) { c.mesh.visible = false; continue; }
      let lod = LODS.findIndex((l) => d < l.dist);
      if (!c.geos[lod]) {
        if (budget <= 0) { if (c.lod < 0) continue; lod = c.lod; }
        else { c.geos[lod] = buildChunk(c.x0, c.z0, LODS[lod].n); budget--; }
      }
      if (c.lod !== lod) { c.mesh.geometry = c.geos[lod]; c.lod = lod; }
      c.mesh.visible = true;
    }
  }

  return { update, heightAt, regionAt, REGIONS, RUNWAY, chunks };
}
