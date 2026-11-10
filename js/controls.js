// Input: keyboard, floating touch joystick (left), hold-to-fly pad (right), optional device tilt.
// read() returns { pitch, turn, throttle } (throttle is 0.5 while holding the pad / Space / Shift, else 0). pitch +1 = nose up.
// Stick-style: push up/forward = nose down. Flip with INVERT_PITCH.
export const INVERT_PITCH = false;
const D2R = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const clamp = (v, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const dead = (v, d) => (Math.abs(v) < d ? 0 : v - Math.sign(v) * d) / (1 - d);

export function createControls() {
  const keys = new Set();
  const c = { enabled: true, tilt: false };
  const touch = { turn: 0, pitch: 0 };
  const sgn = INVERT_PITCH ? -1 : 1;

  // ---- Keyboard ----
  window.addEventListener('keydown', (e) => {
    if (!c.enabled) return;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  const any = (...codes) => (codes.some((k) => keys.has(k)) ? 1 : 0);

  // ---- Touch: floating joystick ----
  const zone = $('joy-zone'), base = $('joy-base'), knob = $('joy-knob'), RAD = 60;
  let joyId = null, ox = 0, oy = 0;
  const joyMove = (e) => {
    let dx = (e.clientX - ox) / RAD, dy = (e.clientY - oy) / RAD;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    knob.style.transform = `translate(${dx * RAD}px, ${dy * RAD}px)`;
    touch.turn = dead(dx, 0.08); touch.pitch = dead(dy, 0.08) * sgn;
  };
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null; touch.turn = touch.pitch = 0;
    base.classList.remove('active'); knob.style.transform = '';
  };
  zone.addEventListener('pointerdown', (e) => {
    if (joyId !== null || c.tilt) return;
    joyId = e.pointerId; zone.setPointerCapture(e.pointerId);
    ox = e.clientX; oy = e.clientY;
    base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('active');
    joyMove(e);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
  zone.addEventListener('pointerup', joyEnd);
  zone.addEventListener('pointercancel', joyEnd);

  // ---- Touch: hold the bottom-right pad to fly at 50% speed; let go and the plane stalls and floats ----
  const gas = $('gas'), gasIds = new Set();
  const gasDown = (e) => { gasIds.add(e.pointerId); gas.setPointerCapture(e.pointerId); gas.classList.add('active'); };
  const gasUp = (e) => { gasIds.delete(e.pointerId); if (!gasIds.size) gas.classList.remove('active'); };
  gas.addEventListener('pointerdown', gasDown);
  gas.addEventListener('pointerup', gasUp);
  gas.addEventListener('pointercancel', gasUp);

  // ---- Tilt steering (landscape or portrait; neutral pose is calibrated at takeoff) ----
  const tilt = { bank: 0, pitch: 0, nb: 0, np: 0 };
  const screenAngle = () => {
    const a = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
    return ((a % 360) + 360) % 360;
  };
  function onOrient(e) {
    if (e.beta == null || e.gamma == null) return;
    const b = e.beta * D2R, g = e.gamma * D2R;
    // World "up" in device coordinates, then in screen coordinates.
    const ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b), uz = Math.cos(g) * Math.cos(b);
    const a = screenAngle();
    const sr = a === 90 ? -uy : a === 180 ? -ux : a === 270 ? uy : ux;
    const su = a === 90 ? ux : a === 180 ? -uy : a === 270 ? -ux : uy;
    tilt.bank = -Math.atan2(sr, su);               // clockwise phone rotation = right bank
    tilt.pitch = Math.atan2(uz, Math.hypot(sr, su)); // top edge away from you = positive
  }
  c.calibrateTilt = () => { tilt.nb = tilt.bank; tilt.np = tilt.pitch; };
  c.setTilt = async (on) => {
    window.removeEventListener('deviceorientation', onOrient);
    c.tilt = false;
    if (on) {
      const DO = window.DeviceOrientationEvent;
      if (!DO) return false;
      if (typeof DO.requestPermission === 'function') {
        try { if ((await DO.requestPermission()) !== 'granted') return false; } catch { return false; }
      }
      window.addEventListener('deviceorientation', onOrient);
      c.tilt = true;
    }
    document.body.classList.toggle('tilt', c.tilt);
    return c.tilt;
  };

  c.read = () => {
    if (!c.enabled) return { pitch: 0, turn: 0, throttle: 0 };
    const held = gasIds.size > 0 || any('Space', 'ShiftLeft', 'ShiftRight');
    let pitch = (INVERT_PITCH ? any('ArrowUp', 'KeyW') - any('ArrowDown', 'KeyS') : any('ArrowDown', 'KeyS') - any('ArrowUp', 'KeyW'));
    let turn = any('ArrowRight', 'KeyD') - any('ArrowLeft', 'KeyA');
    pitch += touch.pitch; turn += touch.turn;
    if (c.tilt) {
      turn += dead(clamp((tilt.bank - tilt.nb) / (30 * D2R)), 0.1);
      pitch += -sgn * dead(clamp((tilt.pitch - tilt.np) / (25 * D2R)), 0.1);
    }
    return { pitch: clamp(pitch), turn: clamp(turn), throttle: held ? 0.5 : 0 };
  };
  return c;
}
