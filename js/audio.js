// All sounds are generated with the Web Audio API (no files). Audio starts after the first tap/key.
// Engine hum (pitch follows speed), unlock chime (+ gold sparkle), icon shimmer (louder when close),
// timer tick, end buzzer, win fanfare, optional synth music (off by default), sound on/off.
let ctx = null, master = null, musicGain = null, enabled = true, musicOn = false;
let eng = null, shim = null, lastTick = 0;

export function initAudio() { // call from a user gesture
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = enabled ? 0.7 : 0; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.3; musicGain.connect(master);
      eng = buildEngine(); shim = buildShimmer();
      setInterval(musicTick, 120);
    }
    if (ctx.state !== 'running') ctx.resume();
  } catch { /* audio unavailable */ }
}

export function setEnabled(v) {
  enabled = v;
  if (master) master.gain.setTargetAtTime(v ? 0.7 : 0, ctx.currentTime, 0.03);
}
export function setMusic(v) { musicOn = v; }

// ---- helpers ----
function toneAt(freq, t, dur, type = 'triangle', vol = 0.18, dest = master) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
const ready = () => ctx && enabled && ctx.state === 'running';

// ---- Engine hum ----
function buildEngine() {
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator();
  o1.type = 'sawtooth'; o2.type = 'square'; lfo.frequency.value = 24;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
  const am = ctx.createGain(); am.gain.value = 0.75;
  const lg = ctx.createGain(); lg.gain.value = 0.25;
  const g = ctx.createGain(); g.gain.value = 0;
  lfo.connect(lg).connect(am.gain);
  o1.connect(f); o2.connect(f); f.connect(am).connect(g).connect(master);
  o1.start(); o2.start(); lfo.start();
  return { o1, o2, f, g, lfo };
}

// ---- Icon shimmer (ambient sparkle that swells as you approach) ----
function buildShimmer() {
  const a = ctx.createOscillator(), b = ctx.createOscillator(), vib = ctx.createOscillator();
  a.type = b.type = 'sine'; a.frequency.value = 1320; b.frequency.value = 1982; vib.frequency.value = 6;
  const vg = ctx.createGain(); vg.gain.value = 14;
  vib.connect(vg); vg.connect(a.frequency); vg.connect(b.frequency);
  const g = ctx.createGain(); g.gain.value = 0;
  a.connect(g); b.connect(g); g.connect(master);
  a.start(); b.start(); vib.start();
  return { a, b, g };
}

// Call every frame. { flying, speed, near (0..1 icon proximity), secret }
export function update({ flying, speed = 0, near = 0, secret = false }) {
  if (!ctx || !eng) return;
  const t = ctx.currentTime, sn = Math.min(1, Math.max(0, (speed - 6) / 52));
  eng.o1.frequency.setTargetAtTime(48 + 90 * sn, t, 0.12);
  eng.o2.frequency.setTargetAtTime(24 + 45 * sn, t, 0.12);
  eng.f.frequency.setTargetAtTime(250 + 900 * sn, t, 0.12);
  eng.lfo.frequency.setTargetAtTime(18 + 30 * sn, t, 0.12);
  eng.g.gain.setTargetAtTime(flying ? 0.09 : 0, t, 0.15);
  shim.a.frequency.setTargetAtTime(secret ? 1760 : 1320, t, 0.2);
  shim.b.frequency.setTargetAtTime(secret ? 2637 : 1982, t, 0.2);
  shim.g.gain.setTargetAtTime(flying ? near * near * 0.07 : 0, t, 0.1);
}

// ---- One-shots ----
export function playUnlock(secret = false) {
  if (!ready()) return;
  const t = ctx.currentTime, notes = secret ? [784, 988, 1175, 1568, 1976] : [523, 659, 784, 1047];
  notes.forEach((f, i) => toneAt(f, t + i * 0.09, 0.35));
  if (secret) { toneAt(2637, t + 0.5, 0.6, 'sine', 0.1); toneAt(3136, t + 0.62, 0.6, 'sine', 0.07); }
}
export function playTick() { if (ready()) toneAt(1000, ctx.currentTime, 0.06, 'square', 0.08); }
export function playBuzzer() {
  if (!ready()) return;
  const t = ctx.currentTime;
  toneAt(140, t, 0.9, 'sawtooth', 0.16); toneAt(148, t, 0.9, 'sawtooth', 0.12);
}
export function playWin() {
  if (!ready()) return;
  const t = ctx.currentTime;
  [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => toneAt(f, t + i * 0.14, 0.4, 'triangle', 0.2));
  [523, 659, 784, 1047].forEach((f) => toneAt(f, t + 1.2, 1.6, 'triangle', 0.12));
  toneAt(2093, t + 1.3, 1.4, 'sine', 0.08);
}

// ---- Optional synth music loop ----
const STEP = 0.3, ROOTS = [130.8, 110, 87.3, 98];
const MELODY = [0, -1, 2, -1, 4, 2, -1, 0, 3, -1, 2, -1, 0, -1, 2, 4, 5, -1, 4, -1, 2, 0, -1, 2, 4, -1, 7, -1, 5, 4, 2, -1];
const PENT = [0, 2, 4, 7, 9, 12, 14, 16]; // semitones above C5-ish
let nextT = 0, stepN = 0;
function musicTick() {
  if (!ctx || !enabled || !musicOn || ctx.state !== 'running') { nextT = 0; return; }
  if (!nextT || nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.4) {
    const s = stepN++ % 32, chord = Math.floor(s / 8);
    if (s % 4 === 0) toneAt(ROOTS[chord], nextT, STEP * 3.6, 'sine', 0.5, musicGain);
    const m = MELODY[s];
    if (m >= 0) toneAt(523.25 * Math.pow(2, PENT[m] / 12), nextT, STEP * 1.6, 'triangle', 0.22, musicGain);
    nextT += STEP;
  }
}
