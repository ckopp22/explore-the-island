// Primitive-shape landmark models, one per location. Each model is merged into 1-2 meshes
// (vertex colors) and built lazily when the camera is nearby. Local origin = ground, +y up.
import * as THREE from '../lib/three.module.min.js';

const WHITE = 0xf2f2f2, RED = 0xd8352a, BLUE = 0x3d7bd9, YEL = 0xf4cf3f, WOOD = 0x8a5a2b, DWOOD = 0x5e3b1c, STONE = 0x9b9a94, DSTONE = 0x6f6e69;
const GREEN = 0x3f9d3a, DGREEN = 0x2a6e2b, SAND = 0xe9d79c, TEAL = 0x2fb5b5, ORANGE = 0xf08a2b, BLACK = 0x2b2b2b, SNOW = 0xffffff, ICE = 0xbfe8f5;
const LAVA = 0xff5a1a, WATER = 0x2a9fd0, GREY = 0x8d939a, MOSS = 0x7d8b6a, BRICK = 0xb5543c, GOLD = 0xffc400, THATCH = 0xd9b24a, PINK = 0xf07aa8;

const geoCache = {};
const G = (k, f) => (geoCache[k] ||= (() => { const g = f(); return g.index ? g.toNonIndexed() : g; })());
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// A bucket collects transformed, colored triangles; helpers write into it.
function bucket() { return { pos: [], col: [] }; }
function helpers(b) {
  const add = (geo, color, x, y, z, sx, sy, sz, rot) => {
    if (typeof rot === 'number') rot = [0, rot, 0];
    _e.set(...(rot || [0, 0, 0]), 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    const g = geo.clone().applyMatrix4(_m);
    _c.set(color);
    const pa = g.attributes.position.array;
    for (let i = 0; i < pa.length; i++) b.pos.push(pa[i]);
    for (let i = 0; i < pa.length / 3; i++) b.col.push(_c.r, _c.g, _c.b);
    g.dispose();
  };
  const h = {
    B: (w, ht, d, c, x = 0, y = 0, z = 0, r) => add(G('b', () => new THREE.BoxGeometry(1, 1, 1)), c, x, y + ht / 2, z, w, ht, d, r),
    C: (rad, ht, c, x = 0, y = 0, z = 0, r) => add(G('c', () => new THREE.CylinderGeometry(1, 1, 1, 10)), c, x, y + ht / 2, z, rad, ht, rad, r),
    T: (rt, rb, ht, c, x = 0, y = 0, z = 0, r) => add(G('t' + (rt / rb).toFixed(3), () => new THREE.CylinderGeometry(rt / rb, 1, 1, 10)), c, x, y + ht / 2, z, rb, ht, rb, r),
    K: (rad, ht, c, x = 0, y = 0, z = 0, r, seg = 8) => add(G('k' + seg, () => new THREE.ConeGeometry(1, 1, seg)), c, x, y + ht / 2, z, rad, ht, rad, r),
    R: (w, d, ht, c, x = 0, y = 0, z = 0) => add(G('k4', () => new THREE.ConeGeometry(1, 1, 4)), c, x, y + ht / 2, z, w * 0.7071, ht, d * 0.7071, [0, Math.PI / 4, 0]), // pyramid roof
    S: (rad, c, x = 0, y = 0, z = 0, sy = 1) => add(G('s', () => new THREE.IcosahedronGeometry(1, 1)), c, x, y, z, rad, rad * sy, rad),
    D: (rad, c, x = 0, y = 0, z = 0, ht = 0.6) => add(G('c', () => new THREE.CylinderGeometry(1, 1, 1, 18)), c, x, y + ht / 2, z, rad, ht, rad), // flat disc
    A: (rad, c, x = 0, y = 0, z = 0, r, thick = 0.14, sz = 1) => add(G('a' + thick, () => new THREE.TorusGeometry(1, thick, 6, 14, Math.PI)), c, x, y, z, rad, rad, rad * sz, r), // half-ring arch
    O: (rad, c, x = 0, y = 0, z = 0, r, thick = 0.14) => add(G('o' + thick, () => new THREE.TorusGeometry(1, thick, 6, 16)), c, x, y, z, rad, rad, rad, r), // full ring
  };
  return h;
}

// ---- composites ----
const palm = (m, x, z, ht = 16) => {
  m.T(0.6, 1.1, ht, WOOD, x, 0, z, [0, 0, 0.1]);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; m.B(1.6, 0.3, 9, GREEN, x + Math.sin(a) * 4 + 1.5, ht - 0.5, z + Math.cos(a) * 4, [0.45, a, 0]); }
  m.S(1, 0x6b4a2a, x + 1.5, ht - 1.2, z);
};
const tree = (m, x, z, s = 1, crown = GREEN) => { m.C(0.8 * s, 6 * s, DWOOD, x, 0, z); m.S(4.5 * s, crown, x, 8 * s, z, 1.1); };
const pine = (m, x, z, s = 1, snow = false) => {
  m.C(0.7 * s, 3 * s, DWOOD, x, 0, z);
  m.K(5 * s, 8 * s, DGREEN, x, 2 * s, z); m.K(4 * s, 7 * s, DGREEN, x, 6 * s, z); m.K(2.8 * s, 6 * s, DGREEN, x, 10 * s, z);
  if (snow) m.K(2 * s, 3.5 * s, SNOW, x, 12.6 * s, z);
};
const house = (m, w, d, ht, wall, roof, x = 0, z = 0, y = 0) => { m.B(w, ht + 4, d, wall, x, y - 4, z); m.R(w * 1.15, d * 1.15, ht * 0.5, roof, x, y + ht, z); };
const boat = (m, x, z, rot = 0, c = WHITE) => { m.B(4, 2, 12, c, x, 0, z, rot); m.B(3, 2.4, 4, BLUE, x, 2, z, rot); };
const rocks = (m, x, z, n, spread, size, c = STONE) => { for (let i = 0; i < n; i++) { const a = i * 2.4, r = spread * ((i * 37 % 10) / 10 + 0.2); m.S(size * (0.6 + (i % 3) * 0.3), c, x + Math.cos(a) * r, size * 0.4, z + Math.sin(a) * r, 0.7); } };
const steam = (m, x, y, z, n = 4, r = 3) => { for (let i = 0; i < n; i++) m.S(r + i * 0.9, 0xf4f4f4, x + (i % 2) * 1.5, y + i * r * 1.5, z, 0.9); };
const bird = (m, x, y, z, c = WHITE) => { m.S(1.2, c, x, y, z, 0.8); m.B(5, 0.25, 1.4, c, x, y + 0.3, z, [0, 0.4, 0.2]); };

export const MODELS = {
  // ---- Sunny Beach Coast ----
  resort(m) {
    m.B(60, 22, 26, WHITE, 0, -4, 0); m.B(62, 2, 28, RED, 0, 18, 0); m.B(24, 16, 22, YEL, -42, -4, 6); m.B(24, 16, 22, YEL, 42, -4, 6);
    m.B(34, 1.2, 20, TEAL, 0, 0, 36);
    for (let i = 0; i < 5; i++) { const x = -26 + i * 13; m.C(0.5, 7, WHITE, x, 0, 54); m.K(5, 2.5, i % 2 ? RED : YEL, x, 7, 54); }
  },
  pier(m) {
    m.B(8, 1, 110, WOOD, 0, 3, 0); m.B(24, 1, 20, WOOD, 0, 3, 50);
    for (let z = -50; z <= 50; z += 12) for (const s of [-3.5, 3.5]) m.C(0.8, 12, DWOOD, s, -8, z);
    m.C(0.6, 9, WHITE, 0, 4, 58); m.S(1.6, YEL, 0, 14, 58);
  },
  lifeguard(m) {
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) m.C(0.4, 7, WHITE, x, 0, z);
    m.B(7, 4.5, 7, RED, 0, 7, 0); m.B(8.5, 0.6, 8.5, WHITE, 0, 11.5, 0); m.B(1.4, 0.1, 4, WHITE, 0, 5, 6, [0.5, 0, 0]); m.C(0.2, 8, WOOD, 4, 11, 4); m.B(3, 2, 0.2, RED, 5.5, 17, 4);
  },
  dock(m) {
    m.B(10, 1, 40, WOOD, 0, 3, 0); for (let z = -18; z <= 18; z += 9) for (const s of [-4.5, 4.5]) m.C(0.7, 10, DWOOD, s, -6, z);
    boat(m, -12, -6, 0, WHITE); boat(m, 12, 6, 0.1, RED); m.B(8, 6, 8, BLUE, 0, 4, 22); m.R(10, 10, 4, RED, 0, 10, 22);
  },
  palms(m) { [[0, 0, 18], [14, 6, 15], [-12, 10, 17], [8, -14, 14], [-14, -8, 16], [22, -6, 13], [-4, 20, 15]].forEach(([x, z, h]) => palm(m, x, z, h)); },
  tiki(m) {
    m.C(7, 5, WOOD, 0, 0, 0); m.K(10, 7, THATCH, 0, 5, 0); m.B(14, 1, 4, DWOOD, 0, 3.5, 8);
    for (const x of [-10, 10]) { m.C(0.3, 8, DWOOD, x, 0, 8); m.S(0.9, ORANGE, x, 8.6, 8); }
    for (let i = 0; i < 3; i++) m.C(1, 2.5, RED, -5 + i * 5, 0, 12);
  },
  sandcastle(m) {
    m.B(34, 6, 34, SAND, 0, 0, 0);
    for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { m.C(4, 14, SAND, x, 0, z); m.K(4.8, 5, RED, x, 14, z); }
    m.B(14, 18, 14, SAND, 0, 4, 0); m.K(8, 6, 0xe0c27a, 0, 22, 0); m.C(0.3, 8, WOOD, 0, 28, 0); m.B(5, 3, 0.2, RED, 2.5, 33, 0);
  },
  surfrack(m) {
    m.B(10, 6, 8, TEAL, -10, -4, 0); m.R(12, 10, 3, WOOD, -10, 6, 0);
    [RED, YEL, BLUE, ORANGE, PINK, GREEN].forEach((c, i) => m.B(1.8, 9, 0.5, c, 4 + i * 2.6, 0, 0, [0, 0, 0.18]));
    m.B(18, 0.4, 3, DWOOD, 10, 0.5, 2);
  },
  turtles(m) {
    [[0, 0, 7], [18, 10, 5], [-14, 14, 4.5]].forEach(([x, z, r], i) => {
      m.S(r, 0x3f8f4a, x, r * 0.35, z, 0.5); m.S(r * 0.3, 0x8bbf5a, x, r * 0.3, z + r * 1.1);
      for (const sx of [-1, 1]) m.B(r * 0.5, 0.5, r * 0.9, 0x6aa84f, x + sx * r * 0.9, 0.5, z, [0, sx * 0.5, 0]);
    });
    m.O(16, STONE, 0, 1, 26, [Math.PI / 2, 0, 0], 0.1);
  },
  treasure(m) { // sits on the seabed
    m.B(8, 5, 5, WOOD, 0, 0, 0); m.A(2.5, WOOD, 0, 5, 0, [0, Math.PI / 2, 0], 0.3, 0.9); m.B(8.4, 0.6, 5.4, GOLD, 0, 2, 0);
    m.S(2, GOLD, 5, 1.2, 2); m.S(1.6, GOLD, -5.5, 1, 1); m.S(1.4, GOLD, 3, 0.9, -4.5); rocks(m, 0, 0, 6, 10, 2, DSTONE);
  },

  // ---- Harbor and Lighthouse Point ----
  lighthouse(m) {
    m.B(16, 8, 16, STONE, 0, -4, 0);
    m.T(7, 8, 12, WHITE, 0, 4, 0); m.T(6.3, 7, 12, RED, 0, 16, 0); m.T(5.6, 6.3, 12, WHITE, 0, 28, 0);
    m.C(7.5, 1.5, BLACK, 0, 40, 0); m.C(3.4, 5.5, 0xcfeff5, 0, 41.5, 0); m.e.S(3.2, 0xfff2a0, 0, 44, 0); m.K(5, 6, RED, 0, 47, 0);
  },
  shipwreck(m) {
    m.B(12, 7, 30, DWOOD, 0, -1, 0, [0, 0, 0.35]); m.B(8, 6, 14, DWOOD, 4, 0, -20, [0.2, 0, 0.35]);
    m.C(0.7, 30, WOOD, 3, 2, 2, [0, 0, 0.5]); m.C(0.6, 18, WOOD, 3, 2, -8, [0.25, 0, 0.7]);
    m.B(9, 8, 0.3, 0xd9d2bc, 9, 14, 3, [0, 0, 0.5]); rocks(m, 0, 0, 5, 14, 3, DSTONE);
  },
  cranes(m) {
    for (const x of [-34, 0, 34]) {
      for (const [dx, dz] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) m.C(0.7, 30, YEL, x + dx, 0, dz);
      m.B(14, 3, 12, YEL, x, 30, 0); m.B(3, 3, 44, YEL, x, 33, 14); m.B(0.3, 14, 0.3, BLACK, x, 19, 26); m.B(3, 2, 3, ORANGE, x, 17, 26);
    }
    [[-20, 22, RED], [-8, 22, BLUE], [4, 24, ORANGE], [16, 22, GREEN], [28, 24, YEL], [-14, 36, BLUE], [10, 38, RED]].forEach(([x, z, c], i) => { m.B(10, 5, 4.5, c, x, 0, z); if (i % 2) m.B(10, 5, 4.5, c === RED ? BLUE : RED, x, 5, z); });
  },
  fishmarket(m) {
    m.B(44, 10, 18, BLUE, 0, -4, 0); m.B(46, 2, 20, WHITE, 0, 10, 0);
    for (let i = 0; i < 6; i++) m.B(6, 0.6, 5, i % 2 ? RED : WHITE, -18 + i * 7.2, 6, 14, [0.35, 0, 0]);
    m.S(4, 0x9fb7c9, 0, 17, 0, 0.5); m.K(2, 4, 0x9fb7c9, 6, 15.5, 0, [0, 0, -Math.PI / 2]);
  },
  customs(m) {
    m.B(32, 14, 20, WHITE, 0, -4, 0); m.B(34, 2, 22, GREY, 0, 10, 0); m.R(30, 18, 7, STONE, 0, 12, 0);
    for (let i = 0; i < 5; i++) m.C(1, 14, 0xe8e4da, -12 + i * 6, 0, 13); m.B(30, 1.5, 6, 0xe8e4da, 0, 14, 13);
    m.C(0.2, 14, WOOD, 0, 19, 0); m.B(5, 3, 0.2, BLUE, 2.5, 29, 0);
  },
  fleet(m) { [[-20, -14], [14, -10], [-8, 8], [24, 12], [-26, 20]].forEach(([x, z], i) => { boat(m, x, z, i * 0.4, [WHITE, RED, BLUE, YEL, WHITE][i]); m.C(0.3, 9, WOOD, x, 2, z); }); },
  breakwater(m) {
    m.B(9, 6, 120, STONE, 0, -2, 0); rocks(m, 0, 0, 14, 16, 4, DSTONE); m.C(0.5, 10, DSTONE, 0, 4, 58); m.e.S(1.8, 0xff6a4a, 0, 15, 58);
    for (let z = -50; z <= 50; z += 25) m.B(11, 2, 3, DSTONE, 0, 4, z);
  },
  saltflats(m) {
    for (let i = 0; i < 6; i++) m.B(30, 0.6, 20, i % 2 ? 0xf6f0f4 : 0xf2c9d6, -34 + (i % 3) * 34, 0, -12 + Math.floor(i / 3) * 26);
    for (let i = 0; i < 4; i++) m.K(6, 6, WHITE, -40 + i * 16, 0, 34);
    m.C(0.8, 12, WOOD, 40, 0, 0); for (let i = 0; i < 4; i++) m.B(1, 8, 0.3, WHITE, 40, 12, 0, [0, 0, i * 1.57]);
  },
  anchor(m) {
    m.B(24, 5, 24, STONE, 0, -3, 0); m.B(3, 34, 3, DSTONE, 0, 2, 0); m.B(16, 3, 3, DSTONE, 0, 24, 0); m.O(3.2, DSTONE, 0, 40, 0, 0, 0.3);
    m.A(11, DSTONE, 0, 6, 0, [0, 0, Math.PI], 0.14); m.K(3, 6, DSTONE, -11, 6, 0, [0, 0, 0.6]); m.K(3, 6, DSTONE, 11, 6, 0, [0, 0, -0.6]);
  },
  seastack(m) {
    m.T(9, 14, 40, STONE, 0, -4, 0); m.T(6, 9, 14, DSTONE, 0, 36, 0); rocks(m, 0, 0, 7, 24, 5, DSTONE);
    m.C(0.4, 8, WOOD, 0, 50, 0); m.e.S(2.4, 0xffd84d, 0, 59, 0); m.e.S(4.2, 0xfff2a0, 0, 59, 0, 0.7);
  },

  // ---- Old Town ----
  castle(m) {
    m.B(70, 14, 70, 0xb9b4a6, 0, -4, 0); m.B(58, 14, 58, 0x6d8a55, 0, 8, 0);
    for (const [x, z] of [[-36, -36], [36, -36], [-36, 36], [36, 36]]) { m.C(8, 34, STONE, x, -4, z); m.K(10, 14, RED, x, 30, z); }
    m.B(26, 40, 26, STONE, 0, 8, 0); m.K(16, 14, RED, 0, 48, 0, 0, 4); m.C(0.4, 14, WOOD, 0, 62, 0); m.B(8, 5, 0.3, BLUE, 4, 70, 0);
    m.B(14, 12, 2, DWOOD, 0, 0, 36);
  },
  clocktower(m) {
    m.B(16, 52, 16, STONE, 0, -4, 0); m.B(18, 3, 18, DSTONE, 0, 44, 0);
    for (const [x, z, r] of [[0, 8.4, 0], [0, -8.4, 0], [8.4, 0, 1], [-8.4, 0, 1]]) m.C(5, 1, WHITE, x, 36, z, [Math.PI / 2, r ? Math.PI / 2 : 0, 0]);
    m.R(18, 18, 18, RED, 0, 47, 0); m.C(0.3, 6, GOLD, 0, 65, 0);
  },
  market(m) {
    m.B(74, 0.6, 64, 0xcdbf9a, 0, 0, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 26, z = Math.sin(a) * 22; m.B(7, 4, 5, WOOD, x, 0, z, -a); m.B(9, 0.6, 7, [RED, BLUE, YEL, GREEN][i % 4], x, 6, z, [0.15, -a, 0]); }
    m.C(5, 1.5, STONE, 0, 0, 0); m.C(0.8, 5, STONE, 0, 1.5, 0); m.D(3.5, WATER, 0, 1.4, 0, 0.3);
  },
  bridge(m) {
    m.D(36, WATER, 0, -1, 0, 0.4); m.B(11, 3, 56, STONE, 0, 9, 0);
    for (const x of [-5, 5]) m.B(1.2, 2.5, 56, DSTONE, x, 12, 0);
    for (const z of [-16, 16]) m.A(8, STONE, 0, 0, z, [0, Math.PI / 2, 0], 0.35, 0.9);
    m.B(11, 11, 8, STONE, 0, -2, -28); m.B(11, 11, 8, STONE, 0, -2, 28);
  },
  cathedral(m) {
    m.B(22, 24, 54, 0xd8d2c0, 0, -4, 0); m.R(26, 56, 12, GREY, 0, 20, 0);
    for (const x of [-7, 7]) { m.B(10, 46, 10, 0xd8d2c0, x, -4, 30); m.R(12, 12, 20, GREY, x, 42, 30); }
    m.C(4, 1, 0x6fc7ff, 0, 22, 36, [Math.PI / 2, 0, 0]); m.B(1, 10, 1, GOLD, 0, 32, -28); m.B(5, 1, 1, GOLD, 0, 38, -28);
  },
  library(m) {
    m.B(38, 16, 26, BRICK, 0, -4, 0); m.B(40, 2, 28, DSTONE, 0, 12, 0); m.S(11, 0x6fb7a0, 0, 14, 0, 0.9); m.C(0.3, 6, GOLD, 0, 24, 0);
    for (let i = 0; i < 4; i++) m.B(38 - i * 2, 1, 4, 0xe8e4da, 0, i, 15 + i * 2.5);
  },
  fountain(m) {
    m.C(20, 2.4, STONE, 0, 0, 0); m.D(18, WATER, 0, 2.2, 0, 0.3); m.C(7, 1.6, STONE, 0, 2, 0); m.C(1.4, 11, STONE, 0, 2, 0); m.S(2.6, 0x9fe0ff, 0, 15, 0);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; m.B(7, 2, 2.4, WOOD, Math.cos(a) * 28, 0, Math.sin(a) * 28, -a); }
  },
  gate(m) {
    for (const x of [-18, 18]) { m.C(7.5, 28, STONE, x, -4, 0); m.K(9, 11, RED, x, 24, 0); }
    m.B(32, 9, 10, STONE, 0, 14, 0); m.B(14, 14, 2, 0x1a1a1a, 0, 0, 0); m.A(7, STONE, 0, 14, 0, 0, 0.3, 1);
    for (const s of [-1, 1]) { m.B(34, 12, 5, 0xa9a49a, s * 42, -2, 0); for (let i = 0; i < 4; i++) m.B(3, 3, 5, 0xa9a49a, s * (28 + i * 9), 10, 0); }
  },
  watchtower(m) {
    m.T(6, 9, 40, STONE, 0, -4, 0); m.C(11, 2.5, DSTONE, 0, 36, 0); m.T(8, 8, 5, WOOD, 0, 38, 0); m.K(10, 8, RED, 0, 43, 0);
    m.C(0.3, 10, WOOD, 0, 51, 0); m.B(6, 3.5, 0.3, RED, 3, 57, 0);
  },
  garden(m) {
    for (const [w, d, x, z] of [[44, 3, 0, -22], [44, 3, 0, 22], [3, 44, -22, 0], [3, 44, 22, 0]]) m.B(w, 7, d, 0xcdbf9a, x, -2, z);
    m.B(36, 0.5, 36, 0x4fae4a, 0, 0, 0); m.C(4, 1.2, STONE, 0, 0, 0); m.S(1.4, 0x9fe0ff, 0, 3.4, 0);
    for (let i = 0; i < 18; i++) { const a = i * 0.7, r = 9 + (i % 3) * 5; m.S(1.5, [PINK, RED, YEL, WHITE][i % 4], Math.cos(a) * r, 1.5, Math.sin(a) * r); }
    m.C(5, 0.6, WHITE, 12, 0, 12); for (const [x, z] of [[8, 8], [16, 8], [8, 16], [16, 16]]) m.C(0.3, 6, WHITE, x, 0, z); m.K(8, 3, 0x4fae4a, 12, 6, 12);
  },

  // ---- Farmland Valley ----
  windmill(m) {
    m.T(6, 10, 28, 0xe8e0d0, 0, -4, 0); m.K(8, 8, BRICK, 0, 24, 0); m.B(3, 3, 8, WOOD, 0, 20, 8);
    for (let i = 0; i < 4; i++) m.B(3.2, 28, 0.4, WHITE, 0, 22, 10, [0, 0, i * Math.PI / 2 + 0.3]);
    m.B(2, 2, 2, DWOOD, 0, 22, 9);
  },
  barn(m) {
    m.B(32, 14, 22, RED, 0, -4, 0); m.R(36, 26, 11, 0x777b80, 0, 10, 0); m.B(10, 11, 0.4, WHITE, 0, 0, 11.2); m.B(10, 0.6, 0.5, RED, 0, 5, 11.4, [0, 0, 0.5]);
    m.C(6, 24, 0xcfcfcf, 26, -4, -2); m.S(6, GREY, 26, 20, -2, 0.7);
  },
  orchard(m) {
    for (let i = 0; i < 16; i++) { const x = (i % 4 - 1.5) * 16, z = (Math.floor(i / 4) - 1.5) * 16; m.C(0.8, 5, DWOOD, x, 0, z); m.S(5, GREEN, x, 8, z, 0.9); for (let k = 0; k < 3; k++) m.S(0.9, RED, x + Math.cos(k * 2.1) * 4, 7 + k, z + Math.sin(k * 2.1) * 4); }
  },
  scarecrow(m) {
    m.B(66, 0.5, 66, 0xe0b84a, 0, 0, 0); for (let i = 0; i < 6; i++) m.B(66, 0.7, 3, 0xb98a2e, 0, 0.3, -27 + i * 11);
    m.C(0.7, 22, WOOD, 0, 0, 0); m.B(20, 1.3, 1.3, WOOD, 0, 15, 0); m.B(8, 11, 4, BLUE, 0, 8, 0); m.S(3.5, 0xe8c9a0, 0, 24, 0); m.C(4.5, 0.6, THATCH, 0, 26, 0); m.C(2.4, 4, THATCH, 0, 26.4, 0);
    for (const x of [-22, 18, 24]) bird(m, x, 3, x * 0.3, BLACK);
  },
  silos(m) {
    [[-10, -8], [10, -8], [-10, 12], [10, 12]].forEach(([x, z]) => { m.C(7, 28, 0xbdbdbd, x, -4, z); m.S(7, GREY, x, 24, z, 0.6); });
    m.B(4, 3, 30, GREY, 0, 18, 2, [-0.3, 0, 0]); m.B(26, 8, 14, RED, 0, -4, -26); m.R(28, 16, 5, GREY, 0, 4, -26);
  },
  duckpond(m) {
    m.D(30, WATER, 0, 0, 0, 0.5); m.O(30, 0x8a7a55, 0, 0.6, 0, [Math.PI / 2, 0, 0], 0.05);
    for (let i = 0; i < 5; i++) { const x = Math.cos(i * 1.3) * 12, z = Math.sin(i * 1.3) * 10; m.S(2, WHITE, x, 1.6, z, 0.8); m.S(1.1, WHITE, x + 1.6, 3.2, z); m.K(0.5, 1.4, ORANGE, x + 2.8, 3, z, [0, 0, -Math.PI / 2]); }
    for (let i = 0; i < 8; i++) m.C(0.25, 7, DGREEN, Math.cos(i) * 31, 0, Math.sin(i) * 31); m.B(14, 0.8, 4, WOOD, 28, 1.4, 0);
  },
  beemeadow(m) {
    for (let i = 0; i < 30; i++) { const a = i * 2.4, r = 6 + (i * 13 % 36); m.S(1.4, [PINK, YEL, WHITE, 0xb36bff, RED][i % 5], Math.cos(a) * r, 1.4, Math.sin(a) * r); m.C(0.2, 1.4, GREEN, Math.cos(a) * r, 0, Math.sin(a) * r); }
    for (let i = 0; i < 5; i++) { const x = -16 + i * 8; m.B(4, 1, 4, YEL, x, 4, -6); m.B(4, 1, 4, WHITE, x, 5, -6); m.B(3.2, 1, 3.2, YEL, x, 6, -6); m.B(0.6, 4, 0.6, WOOD, x - 1.4, 0, -7.4); m.B(0.6, 4, 0.6, WOOD, x + 1.4, 0, -4.6); }
    m.S(4, YEL, 22, 16, 8, 0.7); m.B(0.3, 5, 3, BLACK, 22, 16, 8); m.B(8, 0.3, 3, WHITE, 22, 19, 8, [0, 0, 0.3]);
  },
  haymaze(m) {
    const w = (x, z, sx, sz) => m.B(sx, 4, sz, 0xe0c060, x, 0, z);
    w(0, -30, 60, 4); w(0, 30, 60, 4); w(-30, 0, 4, 64); w(30, -10, 4, 44); w(0, -16, 36, 4); w(-8, 16, 36, 4); w(14, 0, 4, 22); w(-14, -2, 4, 22);
    for (const [x, z] of [[-22, 20], [22, 22], [18, -22]]) m.C(3, 4, 0xd2a84a, x, 0, z, [0, 0, Math.PI / 2]);
    m.C(0.4, 14, WOOD, 0, 0, 0); m.B(6, 3, 0.3, RED, 3, 12, 0);
  },
  greenhouse(m) {
    m.B(44, 9, 18, 0xbfeadf, 0, 0, 0); m.R(46, 20, 6, 0xd9f4ec, 0, 9, 0); m.B(44.4, 0.8, 18.4, WHITE, 0, 0, 0);
    for (let i = 0; i < 11; i++) m.S(2, [GREEN, RED, PINK, YEL][i % 4], -19 + i * 3.8, 2.4, (i % 2 ? 4 : -4)); m.B(8, 8, 0.4, WHITE, 0, 0, 9.3);
  },
  cropcircle(m) {
    m.D(52, 0xd6b24a, 0, 0.1, 0, 0.3); m.D(42, 0x8fc552, 0, 0.3, 0, 0.3); m.D(31, 0xe8cf6a, 0, 0.5, 0, 0.3); m.D(20, 0x6aa84f, 0, 0.7, 0, 0.3); m.D(9, 0xf4e08a, 0, 0.9, 0, 0.3);
    for (let i = 0; i < 6; i++) m.B(104, 0.4, 2.2, 0xb98a2e, 0, 1.2, 0, [0, i * Math.PI / 6, 0]);
  },

  // ---- Jungle Interior ----
  treehouse(m) {
    m.T(4.5, 6, 42, DWOOD, 0, -4, 0); m.S(22, DGREEN, 0, 46, 0, 0.7); m.S(15, GREEN, 14, 38, 6, 0.7); m.S(14, GREEN, -12, 40, -6, 0.7);
    m.B(20, 1.6, 20, WOOD, 0, 24, 0); m.B(11, 8, 11, 0xb07a3a, 0, 25.6, 0); m.R(14, 14, 6, THATCH, 0, 33.6, 0);
    m.B(1.4, 26, 0.5, WOOD, 7, 0, 10, [0.15, 0, 0]); m.B(18, 0.6, 2, WOOD, 20, 22, 0, [0, 0, 0.1]);
  },
  temple(m) {
    [[56, 0], [44, 7], [32, 14], [22, 21], [12, 28]].forEach(([s, y], i) => m.B(s, 7.5, s, i % 2 ? MOSS : 0x8f9a7d, 0, y - 6, 0));
    m.B(10, 9, 10, 0x6f7a5d, 0, 34, 0); m.B(12, 1.5, 12, MOSS, 0, 43, 0); m.B(10, 55, 6, 0x6f7a5d, 0, 0, 30, [0.9, 0, 0]);
    for (let i = 0; i < 6; i++) m.C(2, 6 + (i % 3) * 4, 0x9aa58a, -34 + i * 13, 0, 42);
    m.e.S(2, 0xffd84d, 0, 46, 0);
  },
  waterfall(m) {
    m.B(44, 48, 26, 0x7d7a74, 0, -4, 0); m.B(40, 6, 20, MOSS, 0, 44, -2); m.B(9, 46, 1.6, 0x8fdcf5, 0, 0, 13.4); m.B(16, 2.6, 6, 0xcdf3ff, 0, 46, 11);
    m.D(26, WATER, 0, 0.2, 24, 0.6); steam(m, 0, 2, 16, 4, 3.4); rocks(m, 0, 24, 8, 26, 3, DSTONE);
  },
  ropebridge(m) {
    for (const z of [-34, 34]) { m.B(8, 18, 8, WOOD, 0, -6, z); m.B(12, 2, 12, DWOOD, 0, 10, z); }
    m.B(4, 0.7, 64, WOOD, 0, 12, 0); for (const x of [-1.8, 1.8]) { m.B(0.4, 0.4, 66, 0xd9c79a, x, 14.5, 0); m.B(0.3, 0.3, 66, 0xd9c79a, x, 12, 0); }
    for (let z = -30; z <= 30; z += 10) for (const x of [-1.8, 1.8]) m.B(0.3, 2.4, 0.3, WOOD, x, 12.4, z);
  },
  figtree(m) {
    m.T(7, 12, 36, 0x6b4a2a, 0, -4, 0); for (let i = 0; i < 5; i++) { const a = i * 1.25; m.B(3, 14, 3, 0x6b4a2a, Math.cos(a) * 9, 3, Math.sin(a) * 9, [0, -a, Math.sin(a) * 0.35]); }
    m.S(26, GREEN, 0, 46, 0, 0.62); m.S(17, DGREEN, 16, 40, 8, 0.6); m.S(17, DGREEN, -16, 42, -6, 0.6);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; m.C(0.3, 18, DGREEN, Math.cos(a) * 20, 24, Math.sin(a) * 20); }
  },
  parrots(m) {
    m.T(2, 3.4, 40, 0x6b5a45, 0, -4, 0); m.B(2, 2, 22, 0x6b5a45, 5, 28, 0, [0, 0.4, 0.2]); m.B(2, 2, 18, 0x6b5a45, -4, 34, 2, [0, -0.5, -0.2]); m.S(11, GREEN, 0, 44, 0, 0.5);
    [[RED, 10, 30, 2], [BLUE, 14, 30, 5], [YEL, -9, 37, 3], [0x2fb5b5, -12, 37, 5], [ORANGE, 4, 42, -3]].forEach(([c, x, y, z]) => { m.S(1.7, c, x, y + 2, z, 1.2); m.S(1, c, x + 0.6, y + 4, z); m.K(0.5, 1.4, YEL, x + 1.6, y + 4, z, [0, 0, -Math.PI / 2]); m.B(0.6, 4, 0.4, BLUE, x - 1.4, y, z, [0, 0, 0.2]); });
  },
  lake(m) {
    m.D(42, WATER, 0, 0, 0, 0.8); m.O(42, 0x6f7a5d, 0, 0.8, 0, [Math.PI / 2, 0, 0], 0.07);
    for (let i = 0; i < 9; i++) m.D(3.2, 0x4fae4a, Math.cos(i * 2.2) * (10 + i * 2), 0.9, Math.sin(i * 2.2) * (8 + i * 2), 0.2);
    m.D(7, SAND, 8, 0.9, -4, 0.8); palm(m, 8, -4, 12); rocks(m, 0, 0, 12, 46, 3, DSTONE);
  },
  totem(m) {
    m.B(16, 3, 16, DSTONE, 0, -2, 0);
    [[RED, 9], [YEL, 8], [BLUE, 8], [GREEN, 8], [ORANGE, 7]].forEach(([c, h], i) => { const y = 1 + [0, 9, 17, 25, 33][i]; m.B(8 - i, h, 8 - i, c, 0, y, 0); m.B(2, 1.6, 0.4, BLACK, -1.5, y + h * 0.6, 4.2 - i / 2); m.B(2, 1.6, 0.4, BLACK, 1.5, y + h * 0.6, 4.2 - i / 2); });
    m.B(30, 2.4, 2.4, YEL, 0, 28, 0); m.K(3, 6, RED, 0, 41, 0);
  },
  camp(m) {
    [[-14, -6, ORANGE], [10, -10, GREEN], [14, 10, BLUE]].forEach(([x, z, c], i) => { m.R(14, 12, 9, c, x, 0, z); m.B(4, 6, 0.3, 0x2b2b2b, x, 0, z + 6, [0, 0, 0]); });
    m.D(3, BLACK, 0, 0, 0, 0.5); m.e.K(1.5, 4, 0xffa030, 0, 0.5, 0); for (let i = 0; i < 3; i++) m.B(0.8, 0.8, 4, WOOD, 0, 0.6, 0, [0, i * 1.05, 0]);
    m.C(0.4, 22, GREY, -4, 0, 18); m.S(2.6, WHITE, -4, 23, 18, 0.4); m.B(4, 3, 3, RED, 6, 0, 18); m.B(3, 3, 3, YEL, 10, 0, 20);
  },
  idol(m) {
    m.B(24, 3, 24, 0x8f9a7d, 0, -2, 0); m.B(14, 6, 14, 0x7d8b6a, 0, 1, 0); m.S(11, 0x8f9a7d, 0, 18, 0, 1.15); m.B(3, 6, 3, 0x7d8b6a, 0, 15, 10, [0.3, 0, 0]);
    m.B(3.4, 2, 1.4, BLACK, -4, 21, 9); m.B(3.4, 2, 1.4, BLACK, 4, 21, 9); m.B(8, 1.4, 1, BLACK, 0, 11, 10); m.S(2.2, GOLD, 0, 32, 0);
    for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.8; m.C(1.6, 12 - i * 2, 0x9aa58a, Math.cos(a) * 20, 0, Math.sin(a) * 20); }
    for (let i = 0; i < 6; i++) m.C(0.3, 18, DGREEN, Math.cos(i) * 8, 6, Math.sin(i) * 8);
  },

  // ---- Volcano Highlands ----
  smoke(m) {
    for (let i = 0; i < 7; i++) m.S(7 + i * 2.2, i < 2 ? 0x5a5a5e : 0x8a8a90, (i % 2) * 6 - 3 + i * 3, 10 + i * 17, i * 2, 0.85);
    m.B(2, 12, 0.3, BLACK, 24, 0, 0); m.K(5, 5, YEL, 24, 12, 0, [0, 0, 0], 3);
  },
  lavalake(m) {
    m.e.D(60, LAVA, 0, 0, 0, 1.2); m.e.D(40, 0xffa030, 0, 1.3, 0, 0.5); m.e.D(20, 0xffd060, 0, 1.7, 0, 0.5);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; m.S(7 + (i % 3) * 3, 0x2a2428, Math.cos(a) * 66, 4, Math.sin(a) * 66, 0.7); }
  },
  hotsprings(m) {
    [[-18, 0, 15], [14, 6, 12], [0, -22, 10]].forEach(([x, z, r]) => { m.C(r + 2, 2, STONE, x, 0, z); m.D(r, TEAL, x, 1.8, z, 0.4); steam(m, x, 6, z, 4, 2.6); });
    m.B(12, 6, 9, WOOD, 28, -2, 8); m.R(14, 11, 4, THATCH, 28, 4, 8);
  },
  observatory(m) {
    m.C(15, 14, WHITE, 0, -4, 0); m.S(15, 0xe8eef2, 0, 10, 0, 1); m.B(5, 15, 18, 0x1a2a3a, 0, 6, 10, [-0.6, 0, 0]); m.C(1.4, 16, GREY, 9, 6, 8, [-0.9, 0, 0.2]);
    m.B(20, 4, 10, GREY, 0, -4, 24); m.C(0.3, 12, GREY, -12, 0, -14); m.S(2.6, WHITE, -12, 12, -14, 0.4);
  },
  obsidian(m) {
    for (let i = 0; i < 22; i++) { const a = i * 2.39, r = 4 + (i * 17 % 44), h = 6 + (i * 7 % 14); m.K(2.6 + (i % 3), h, i % 4 ? 0x1d1a24 : 0x3a3050, Math.cos(a) * r, 0, Math.sin(a) * r, [0.15 * Math.sin(i), 0, 0.2 * Math.cos(i)], 5); }
  },
  geothermal(m) {
    m.B(30, 12, 18, GREY, 0, -4, 0); m.T(9, 14, 28, WHITE, 24, -4, -4); steam(m, 24, 26, -4, 4, 4.4);
    m.B(3, 3, 54, 0xb0b4b8, 0, 6, 28); m.B(3, 3, 54, 0xb0b4b8, -8, 4, 28); m.C(2.4, 14, RED, -22, 0, 12); m.C(2.4, 18, BLUE, -28, 0, 12);
  },
  lavariver(m) {
    for (let i = 0; i < 8; i++) { const z = -70 + i * 20, x = Math.sin(i * 0.9) * 14; m.B(15, 1, 22, 0x1d1a24, x, 0, z, [0, Math.cos(i) * 0.4, 0]); m.e.B(8 - (i % 2), 1, 22, i % 3 ? LAVA : 0xffa030, x, 0.9, z, [0, Math.cos(i) * 0.4, 0]); }
    rocks(m, 0, 0, 8, 22, 4, 0x2a2428);
  },
  vents(m) {
    [[-18, -8], [-4, 12], [14, -4], [22, 14], [2, -20]].forEach(([x, z], i) => { m.K(6, 6.5, 0x5a5558, x, 0, z, 0, 7); steam(m, x, 7, z, 4, 2 + (i % 2)); });
  },
  mine(m) {
    m.B(2, 14, 2, WOOD, -7, -2, 0); m.B(2, 14, 2, WOOD, 7, -2, 0); m.B(18, 2.4, 3, WOOD, 0, 12, 0); m.B(12, 11, 2, 0x111111, 0, 0, 0.4);
    m.B(2, 0.3, 40, DSTONE, -2, 0, 22); m.B(2, 0.3, 40, DSTONE, 2, 0, 22); m.B(4, 3, 5, ORANGE, 0, 1, 18); m.K(7, 6, 0x4a4040, 14, 0, 16);
    for (const s of [-1, 1]) m.B(1.4, 30, 1.4, WOOD, s * 8, 0, -16, [0, 0, -s * 0.28]); m.B(12, 2, 2, DWOOD, 0, 28, -16);
  },
  dragonskull(m) {
    m.S(15, 0xeee6d0, 0, 17, 0, 0.8); m.B(14, 6, 17, 0xeee6d0, 0, 5, 14); m.B(12, 3, 14, 0xd9d0b8, 0, 2, 15);
    m.S(4, 0x222018, -6, 20, 11); m.S(4, 0x222018, 6, 20, 11); m.K(3, 22, 0xeee6d0, -9, 26, -6, [0.4, 0, 0.4]); m.K(3, 22, 0xeee6d0, 9, 26, -6, [0.4, 0, -0.4]);
    for (let i = 0; i < 5; i++) m.B(1.6, 3, 1.4, WHITE, -5 + i * 2.5, 2, 22);
    for (let i = 0; i < 4; i++) m.A(14 - i, 0xeee6d0, 0, 0, -18 - i * 9, [0, Math.PI / 2, 0], 0.07, 1.8);
  },

  // ---- Snowy Peak ----
  beacon(m) {
    rocks(m, 0, 0, 8, 7, 4, GREY); m.S(5, SNOW, 0, 3, 0, 0.6); m.C(0.8, 26, GREY, 0, 3, 0); m.B(13, 7, 0.4, RED, 6.5, 22, 0); m.e.S(2.6, ORANGE, 0, 31, 0); m.e.S(4.4, 0xffd8a0, 0, 31, 0, 0.8);
  },
  cabin(m) {
    m.B(20, 9, 15, WOOD, 0, -4, 0); m.R(26, 20, 10, 0xe4ebf2, 0, 9, 0); m.B(3, 8, 3, STONE, 6, 6, 3); steam(m, 6, 15, 3, 3, 1.6);
    m.B(4, 6, 0.3, DWOOD, 0, 0, 7.7); m.B(4, 3.4, 0.3, 0xffe9a0, -6, 2, 7.7); pine(m, -22, 6, 1.4, true); pine(m, 24, -6, 1.2, true); pine(m, 20, 12, 1, true); m.D(26, SNOW, 0, -0.2, 0, 0.4);
  },
  skilift(m) {
    for (const z of [-60, 60]) { m.B(12, 9, 12, RED, 0, -4, z); m.B(14, 1, 14, DWOOD, 0, 5, z); }
    for (let z = -30; z <= 30; z += 30) { m.C(0.9, 20, GREY, 0, -2, z); m.B(10, 1, 1, GREY, 0, 19, z); }
    m.B(0.4, 0.4, 124, BLACK, -4, 18, 0); m.B(0.4, 0.4, 124, BLACK, 4, 18, 0);
    for (let i = 0; i < 5; i++) { const z = -48 + i * 24; m.B(0.2, 5, 0.2, BLACK, -4, 13, z); m.B(3.4, 1, 2.4, [YEL, RED, BLUE][i % 3], -4, 12, z); }
  },
  icecave(m) {
    m.S(24, ICE, 0, 0, 0, 0.8); m.B(11, 11, 6, 0x1a2a3a, 0, 0, 20); m.A(6.5, ICE, 0, 11, 21, 0, 0.3, 0.6);
    for (let i = 0; i < 7; i++) m.K(1, 5 + (i % 3) * 2, 0xe8fbff, -7 + i * 2.4, 11 - (5 + (i % 3) * 2) + 1, 22, [Math.PI, 0, 0], 5);
    rocks(m, 0, 0, 7, 28, 5, ICE);
  },
  frozenlake(m) {
    m.D(48, 0xcfeeff, 0, 0, 0, 0.8); m.O(48, SNOW, 0, 0.8, 0, [Math.PI / 2, 0, 0], 0.08);
    for (let i = 0; i < 6; i++) m.B(70, 0.2, 0.7, 0xf6fbff, 0, 0.9, 0, [0, i * 0.5 + 0.2, 0]);
    m.B(8, 5, 8, WOOD, 14, 0.8, 8); m.R(10, 10, 3.4, 0xe4ebf2, 14, 5.8, 8); rocks(m, 0, 0, 12, 50, 3, SNOW);
  },
  pines(m) { for (let i = 0; i < 26; i++) { const a = i * 2.39, r = 4 + (i * 11 % 52); pine(m, Math.cos(a) * r, Math.sin(a) * r, 1.3 + (i % 3) * 0.3, true); } },
  snowman(m) {
    m.S(15, SNOW, 0, 14, 0); m.S(10.6, SNOW, 0, 33, 0); m.S(7.2, SNOW, 0, 47, 0); m.K(1.2, 7, ORANGE, 0, 46.6, 7, [Math.PI / 2, 0, 0]);
    m.S(0.9, BLACK, -2.4, 49, 6); m.S(0.9, BLACK, 2.4, 49, 6); m.C(5, 0.8, BLACK, 0, 53.4, 0); m.C(3, 6, BLACK, 0, 54, 0); m.B(13, 2.4, 13, RED, 0, 40, 0);
    m.B(1, 1, 22, WOOD, -17, 34, 0, [0, 0, 0.4]); m.B(1, 1, 22, WOOD, 17, 34, 0, [0, 0, -0.4]);
  },
  weather(m) {
    m.C(1.2, 28, GREY, 0, -2, 0); m.B(10, 0.6, 0.6, GREY, 0, 28, 0); for (const [x, z] of [[5, 0], [-2.5, 4.3], [-2.5, -4.3]]) m.S(1.6, RED, x, 28, z, 0.7);
    m.B(7, 7, 7, WHITE, 8, 0, 0); m.B(8, 0.6, 8, DSTONE, 8, 7, 0); m.B(10, 0.5, 6, BLUE, -10, 4, 6, [0.7, 0.3, 0]); m.C(0.3, 18, GREY, 12, 0, -8); m.S(2.2, WHITE, 12, 18, -8, 0.4);
  },
  glacier(m) {
    m.B(32, 8, 120, ICE, 0, -3, 0, [0.08, 0, 0]); for (let i = 0; i < 9; i++) m.B(8 + (i % 3) * 4, 5 + (i % 4) * 2, 8, 0xe8fbff, -10 + (i % 3) * 10, 4, -50 + i * 12);
    for (let i = 0; i < 5; i++) m.B(30, 0.4, 1.4, 0x6aa8c9, 0, 5.2, -40 + i * 20, [0, 0.05 * i, 0]); m.B(36, 5, 18, SNOW, 0, 0, 62);
  },
  eaglenest(m) {
    m.T(8, 13, 34, STONE, 0, -4, 0); m.C(11, 2.4, DWOOD, 0, 30, 0); m.D(6, 0x3a2a1a, 0, 32.4, 0, 0.5);
    for (let i = 0; i < 3; i++) m.S(1.4, WHITE, -2 + i * 2, 33.4, i - 1);
    m.S(4.6, 0x5a3b1e, 14, 40, 0, 0.9); m.S(2.2, WHITE, 18, 43.4, 0); m.K(0.9, 3, YEL, 20.4, 43, 0, [0, 0, -Math.PI / 2]); m.B(30, 0.8, 8, 0x5a3b1e, 14, 41, 0, [0, 0, 0.12]);
  },

  // ---- Offshore Islets ----
  seaarch(m) {
    m.T(10, 14, 36, STONE, -22, -4, 0); m.T(9, 13, 30, STONE, 22, -4, 0); m.A(22, STONE, 0, 24, 0, 0, 0.42, 0.7); m.B(46, 8, 16, DSTONE, 0, 36, 0);
    rocks(m, 0, 0, 8, 36, 5, DSTONE);
  },
  cove(m) {
    for (let i = 0; i < 12; i++) { const a = 0.9 + i * 0.42, r = 30; m.S(11 + (i % 3) * 3, i % 2 ? STONE : DSTONE, Math.cos(a) * r, 9, Math.sin(a) * r, 1.2); }
    m.D(26, TEAL, 0, 0, 0, 0.6); m.D(14, SAND, -4, 0.4, -10, 0.6); boat(m, 4, 2, 0.8, RED); palm(m, -6, -12, 12);
  },
  palmislet(m) { [[0, 0, 20], [14, 8, 17], [-12, 10, 18], [6, -14, 15], [-14, -6, 16]].forEach(([x, z, h]) => palm(m, x, z, h)); m.B(16, 0.6, 3, 0xe0556a, 0, 6, 0, [0, 0.3, 0]); },
  beaconrock(m) {
    m.T(12, 18, 24, DSTONE, 0, -4, 0); m.C(5, 16, WHITE, 0, 20, 0); m.C(5.2, 4, RED, 0, 26, 0); m.C(5.4, 1.2, BLACK, 0, 36, 0); m.e.S(3.2, 0xfff2a0, 0, 39.4, 0); m.K(4.6, 4, RED, 0, 42, 0);
    rocks(m, 0, 0, 8, 26, 4, STONE);
  },
  sharkfin(m) {
    m.K(15, 44, 0x6e7b88, 0, -2, 0, [0.35, 0, 0.12], 4); m.K(7, 22, 0x6e7b88, 24, -2, 8, [0.25, 0.8, -0.1], 4); m.K(6, 18, 0x6e7b88, -20, -2, 10, [0.3, 0.2, 0.15], 4);
    m.O(26, WHITE, 0, 1.2, 0, [Math.PI / 2, 0, 0], 0.04); m.O(34, 0xe8f6fb, 0, 1.2, 0, [Math.PI / 2, 0, 0], 0.03);
  },
  atoll(m) {
    for (let i = 0; i < 24; i++) { const a = i * 0.2618, r = 44 + (i % 3) * 3; m.S(4.6 + (i % 4), [ORANGE, PINK, 0xb36bff, RED, 0xf5e04a][i % 5], Math.cos(a) * r, 3, Math.sin(a) * r, 0.9); }
    m.D(38, TEAL, 0, 0.2, 0, 0.5); for (let i = 0; i < 5; i++) m.K(2.4, 8, i % 2 ? PINK : ORANGE, -10 + i * 5, 0, (i % 2) * 6 - 3, 0, 5);
  },
  pirateflag(m) {
    m.D(14, SAND, 0, 0, 0, 1); m.C(0.9, 38, DWOOD, 0, 0, 0); m.B(20, 12, 0.4, BLACK, 10, 24, 0); m.S(2.8, WHITE, 8, 30, 0.3, 0.9);
    m.B(7, 0.6, 0.5, WHITE, 11, 24, 0.3, [0, 0, 0.6]); m.B(7, 0.6, 0.5, WHITE, 11, 24, 0.3, [0, 0, -0.6]);
    m.B(6, 3.6, 4, WOOD, 8, 0, 8); m.B(6.4, 1, 4.4, GOLD, 8, 3.6, 8); rocks(m, 0, 0, 6, 20, 3, DSTONE);
  },
  birds(m) {
    m.T(9, 14, 26, 0xcfc8bc, 0, -4, 0); m.T(5, 8, 20, 0xcfc8bc, 20, -4, 6); m.T(6, 9, 16, 0xcfc8bc, -18, -4, -4);
    for (let i = 0; i < 16; i++) { const a = i * 2.2, r = 3 + (i % 5) * 4; bird(m, Math.cos(a) * r + (i % 3 - 1) * 4, 22 + (i % 4) * 1.5 - (r > 10 ? 6 : 0), Math.sin(a) * r, i % 4 ? WHITE : GREY); }
    for (let i = 0; i < 6; i++) bird(m, 40 + i * 10, 38 + (i % 3) * 8, i * 6 - 10, WHITE);
  },
  stones(m) {
    for (let i = 0; i < 10; i++) { const t = i / 9; m.D(4.5 - (i % 3), i % 2 ? DSTONE : STONE, -50 + t * 100, 0, Math.sin(t * 5) * 14, 1.6); }
    m.S(3, GREY, 52, 2, 4, 0.8); m.S(2.2, GREY, 55, 5, 4, 0.8);
  },
  ruins(m) { // sits on the seabed
    for (let i = 0; i < 7; i++) { const a = i * 0.9, x = Math.cos(a) * 14, z = Math.sin(a) * 10; m.C(2.2, 10 + (i % 3) * 5, 0xb8c7c0, x, 0, z); if (i % 2) m.B(5, 2, 5, 0xa5b5ad, x, 10 + (i % 3) * 5, z); }
    m.A(11, 0xb8c7c0, 0, 0, -16, 0, 0.25, 1); for (let i = 0; i < 4; i++) m.B(30 - i * 4, 1.6, 8, 0xa5b5ad, 0, i * 1.5, 22 + i * 3);
  },
};

export const SEABED_MODELS = new Set(['treasure', 'ruins']);

// ---- Lazy builder ----
export function createModels(scene, locations, world) {
  const root = new THREE.Group();
  scene.add(root);
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const items = locations.map((loc) => ({ loc, g: null }));

  function build(it) {
    const { loc } = it, fn = MODELS[loc.model];
    const lit = bucket(), emit = bucket();
    const m = helpers(lit); m.e = helpers(emit);
    fn(m);
    const g = new THREE.Group();
    for (const [b, mat] of [[lit, litMat], [emit, glowMat]]) {
      if (!b.pos.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      g.add(mesh);
    }
    const gh = world.heightAt(loc.pos[0], loc.pos[2]);
    g.position.set(loc.pos[0], SEABED_MODELS.has(loc.model) ? gh : Math.max(gh, 0.8), loc.pos[2]);
    g.rotation.y = loc.rot || 0;
    g.updateMatrix(); g.matrixAutoUpdate = false;
    root.add(g);
    it.g = g;
  }

  // Shows models within `range` of the camera (horizontal), building up to `budget` new ones per call.
  function update(camPos, range = 1200, budget = 3) {
    for (const it of items) {
      const near = Math.hypot(it.loc.pos[0] - camPos.x, it.loc.pos[2] - camPos.z) < range;
      if (near && !it.g && budget > 0) { build(it); budget--; }
      if (it.g) it.g.visible = near;
    }
  }
  return { update, items, root };
}
