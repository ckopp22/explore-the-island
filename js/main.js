import * as THREE from '../lib/three.module.min.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import { createWorld } from './world.js';
import { createDebugCam } from './debugcam.js';
import { createPlane } from './plane.js';
import { createControls } from './controls.js';
import { LOCATIONS, TOTAL_LOCATIONS } from './locations.js';
import { createIcons, CAT_COLORS } from './icons.js';
import { createModels } from './models.js';
import { createBook } from './book.js';
import * as audio from './audio.js';

const FLIGHT_SECONDS = 180;
const COUNTDOWN_STEPS = ['3', '2', '1'];

// ---- Renderer / scene (resize-safe) ----
const canvas = document.getElementById('game');
const maxPR = Math.min(window.devicePixelRatio || 1, 2); // section 11: cap pixel ratio at 2
let pixelRatio = maxPR;
// MSAA is costly at 2x on phones; 2x density already hides most jaggies.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: maxPR < 2, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 1, 4600);
const world = createWorld(scene);
const plane = createPlane(scene, world);
const controls = createControls();
const debugCam = createDebugCam(camera, canvas, document.getElementById('debug-hint'), (p) => `x ${p.x | 0} y ${p.y | 0} z ${p.z | 0} | ${world.regionAt(p.x, p.z).name}`);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

// ---- Game state machine ----
const transitions = {
  menu: ['countdown', 'book'],
  countdown: ['flying', 'menu'],
  flying: ['paused', 'flightOver', 'win'],
  paused: ['flying', 'book', 'countdown', 'menu'],
  flightOver: ['countdown', 'book', 'menu'],
  book: ['menu', 'paused', 'flightOver', 'win'],
  win: ['menu', 'countdown', 'book'],
};

const game = { state: 'menu', prev: null, timeLeft: FLIGHT_SECONDS, countdownTimer: null, save: storage.load() };

const foundSet = new Set(game.save.unlockedIds);
const icons = createIcons(scene, LOCATIONS, foundSet, game.save.settings.ghost);
const models = createModels(scene, LOCATIONS, world);
const book = createBook({ locations: LOCATIONS, regions: world.REGIONS, getSave: () => game.save });
game.found = []; // locations unlocked this flight
audio.setEnabled(game.save.settings.sound);

function unlock(loc) {
  foundSet.add(loc.id);
  game.save.unlockedIds.push(loc.id);
  game.save.foundOnFlight[loc.id] = game.save.flightCount + 1;
  storage.save(game.save); // save immediately
  game.found.push(loc);
  icons.markFound(loc.id);
  ui.showBanner(loc.name, world.REGIONS.find((r) => r.id === loc.region).name);
  audio.playUnlock(loc.category === 'secret');
  ui.setCounter(foundSet.size, game.found.length, TOTAL_LOCATIONS);
  if (foundSet.size >= TOTAL_LOCATIONS) { // let the unlock banner and chime play, then show the win screen
    const sv = game.save;
    if (sv.fastestCompletion == null || sv.playSeconds < sv.fastestCompletion) sv.fastestCompletion = Math.round(sv.playSeconds);
    storage.save(sv);
    game.winDelay = 2.6;
  }
}

function setState(next) {
  if (!transitions[game.state].includes(next)) return;
  clearInterval(game.countdownTimer);
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); // keep Space/Enter from re-clicking a button
  game.prev = game.state;
  game.state = next;
  ui.showState(next);
  if (next === 'countdown') { startCountdown(); if (controls.tilt) controls.calibrateTilt(); }
  if (next === 'flying' && game.prev === 'countdown') { plane.launch(); if (controls.tilt) controls.calibrateTilt(); }
  if (next === 'flightOver' && game.prev === 'flying') { endFlight(); audio.playBuzzer(); }
  if (next === 'win') {
    if (game.prev === 'flying') { endFlight(); audio.playWin(); }
    showWin();
  }
  if (next === 'book') book.render();
  plane.setVisible(next !== 'menu' && !(next === 'book' && game.prev === 'menu'));
  if (next !== 'flying') ui.setWarning(false);
  if (next === 'menu') game.timeLeft = FLIGHT_SECONDS;
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function showWin() {
  const sv = game.save;
  ui.showWin([
    `Flights taken: ${sv.flightCount}`,
    `Total flying time: ${fmtTime(sv.playSeconds)}`,
    `Fastest completion: ${sv.fastestCompletion != null ? fmtTime(sv.fastestCompletion) : '-'}`,
  ]);
}

function endFlight() {
  game.save.flightCount++;
  game.save.bestFlight = Math.max(game.save.bestFlight, game.found.length);
  storage.save(game.save);
  const names = game.found.map((l) => `${l.emoji} ${l.name}`).join('   ') || 'No new locations this time.';
  ui.setFlightSummary(`Found this flight: ${game.found.length}\n${names}\nBook: ${foundSet.size} / ${TOTAL_LOCATIONS}`);
}

function startCountdown() {
  plane.reset();
  game.winDelay = 0;
  lastSec = 999;
  game.found = [];
  icons.refresh(foundSet, game.save.settings.ghost);
  ui.setCounter(foundSet.size, 0, TOTAL_LOCATIONS);
  game.timeLeft = FLIGHT_SECONDS;
  ui.setTimer(game.timeLeft);
  let i = 0;
  ui.setCountdown(COUNTDOWN_STEPS[0]);
  game.countdownTimer = setInterval(() => {
    i++;
    if (i < COUNTDOWN_STEPS.length) return ui.setCountdown(COUNTDOWN_STEPS[i]);
    setState('flying');
    ui.flashGo();
  }, 800);
}

ui.onAction((a) => {
  switch (a) {
    case 'fly': case 'restart': case 'keepflying':
      if (game.save.settings.tilt && !controls.tilt) controls.setTilt(true); // iOS permission needs this tap
      try { screen.orientation.lock('landscape').catch(() => {}); } catch { /* not supported */ }
      return setState('countdown');
    case 'book': return setState('book');
    case 'sound': return setSound(!game.save.settings.sound);
    case 'resetprogress': return ui.showConfirm(`This erases all ${foundSet.size} found locations and your flight history. Settings are kept. This cannot be undone.`);
    case 'resetno': return ui.hideConfirm();
    case 'resetyes':
      resetProgress(); ui.hideConfirm();
      return game.state === 'win' ? setState('menu') : undefined;
    case 'hudbook': setState('paused'); return setState('book');
    case 'closebook': return setState(game.prev === 'menu' || !game.prev ? 'menu' : game.prev);
    case 'howto': return ui.showPanel('howto');
    case 'settings': return ui.showPanel('settings');
    case 'closepanel': return ui.closePanels();
    case 'pause': return setState('paused');
    case 'resume': return setState('flying');
    case 'menu': return setState('menu');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (game.state === 'flying') setState('paused');
    else if (game.state === 'paused') setState('flying');
  } else if ((e.key === 'b' || e.key === 'B') && game.state === 'flying') {
    setState('paused'); setState('book');
  }
});

// ---- Debug (debug cam on): H toggles hit-radius spheres + placement report ----
let hitDebug = false;
function setHitDebug(on) {
  hitDebug = on;
  const problems = icons.setDebug(on, world.heightAt);
  const list = document.getElementById('debug-list');
  list.classList.toggle('hidden', !on);
  list.textContent = on ? `Hit radii ON (${LOCATIONS.length} icons, ${problems.length} problems)\n` + (problems.map((p) => `#${p.id} ${p.name}: ${p.issue}`).join('\n') || 'No placement problems.') : '';
  if (on) console.log('Icon placement problems:', problems.length ? problems : 'none');
}
window.addEventListener('keydown', (e) => { if (e.code === 'KeyH' && debugCam.active) setHitDebug(!hitDebug); });
if (new URLSearchParams(location.search).has('debug')) setHitDebug(true);

// ---- Settings toggles ----
for (const [id, key, after] of [['opt-ghost', 'ghost', () => icons.refresh(foundSet, game.save.settings.ghost)], ['opt-hints', 'hints', () => {}]]) {
  const box = document.getElementById(id);
  box.checked = !!game.save.settings[key];
  box.addEventListener('change', () => { game.save.settings[key] = box.checked; storage.save(game.save); after(); });
}

// ---- Audio / sound toggle ----
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, audio.initAudio);

const musicBox = document.getElementById('opt-music');
musicBox.checked = !!game.save.settings.music;
audio.setMusic(musicBox.checked);
musicBox.addEventListener('change', () => { audio.setMusic(musicBox.checked); game.save.settings.music = musicBox.checked; storage.save(game.save); });
const soundBox = document.getElementById('opt-sound');
function setSound(on) {
  soundBox.checked = on;
  audio.setEnabled(on);
  ui.setSoundIcon(on);
  game.save.settings.sound = on;
  storage.save(game.save);
}
soundBox.checked = !!game.save.settings.sound;
ui.setSoundIcon(soundBox.checked);
soundBox.addEventListener('change', () => setSound(soundBox.checked));

// ---- Radar toggle ----
const radarBox = document.getElementById('opt-radar');
radarBox.checked = game.save.settings.radar !== false;
ui.setRadarVisible(radarBox.checked);
radarBox.addEventListener('change', () => {
  game.save.settings.radar = radarBox.checked;
  ui.setRadarVisible(radarBox.checked);
  storage.save(game.save);
});

// ---- Reset progress (with confirmation) ----
function resetProgress() {
  Object.assign(game.save, { unlockedIds: [], foundOnFlight: {}, flightCount: 0, bestFlight: 0, playSeconds: 0 });
  game.winDelay = 0;
  foundSet.clear();
  game.found = [];
  storage.save(game.save);
  icons.refresh(foundSet, game.save.settings.ghost);
  ui.setCounter(0, 0, TOTAL_LOCATIONS);
}

// ---- Touch / tilt setup ----
const tiltBox = document.getElementById('opt-tilt');
tiltBox.checked = !!game.save.settings.tilt;
tiltBox.addEventListener('change', async () => {
  const ok = await controls.setTilt(tiltBox.checked);
  tiltBox.checked = ok;
  game.save.settings.tilt = ok;
  storage.save(game.save);
});
if (new URLSearchParams(location.search).has('touch') || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
for (const ev of ['gesturestart', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault());

document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'flying') setState('paused'); });

// ---- Camera: menu orbit, plane chase cam otherwise ----
function placeCamera(t, dt) {
  if (game.state === 'menu' || (game.state === 'book' && game.prev === 'menu')) {
    const a = t * 0.04;
    camera.position.set(Math.cos(a) * 2200, 700, Math.sin(a) * 2200);
    camera.lookAt(0, 150, 0);
  } else if (game.state !== 'paused') {
    plane.updateCamera(camera, dt);
  }
}

// ---- Loop ----
let modelTimer = 0, radarTimer = 0, lastSec = 999;
let last = performance.now();
let perfFrames = 0, perfTime = 0, perfCooldown = 2;
function adaptResolution(rawDt) { // drop pixel ratio if the device can't hold ~45 fps; raise it again when there is headroom
  perfFrames++; perfTime += Math.min(rawDt, 0.25);
  if (perfFrames < 45) return;
  const avg = (perfTime / perfFrames) * 1000;
  perfFrames = 0; perfTime = 0;
  if (perfCooldown > 0) { perfCooldown--; return; }
  if (avg > 24 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); resize(); perfCooldown = 2; }
  else if (avg < 14 && pixelRatio < maxPR) { pixelRatio = Math.min(maxPR, pixelRatio + 0.25); resize(); perfCooldown = 2; }
}

function frame(now) {
  adaptResolution((now - last) / 1000);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (game.state === 'flying') {
    game.timeLeft -= dt;
    game.save.playSeconds += dt;
    const sec = Math.ceil(game.timeLeft);
    if (sec !== lastSec) { lastSec = sec; if (sec >= 1 && sec <= 10) audio.playTick(); }
    if (game.winDelay > 0 && (game.winDelay -= dt) <= 0) setState('win');
    ui.setTimer(game.timeLeft);
    if (game.timeLeft <= 0) setState('flightOver');
  }
  { // sound: engine hum + icon shimmer
    const flying = game.state === 'flying', near = flying ? icons.nearest(plane.pos) : { d: Infinity, secret: false };
    audio.update({ flying, speed: plane.speed, near: Math.max(0, 1 - near.d / 600), secret: near.secret });
  }
  controls.enabled = !debugCam.active && game.state === 'flying';
  if (game.state === 'flying') { plane.update(dt, controls.read(dt)); ui.setWarning(plane.warn > 0.05); icons.checkHits(plane.pos).forEach(unlock);
    radarTimer -= dt;
    if (radarTimer <= 0 && game.save.settings.radar !== false) { radarTimer = 0.05; ui.drawRadar(plane.pos, plane.heading, LOCATIONS, foundSet, CAT_COLORS, now / 1000); }
  }
  if (debugCam.active) debugCam.update(dt);
  else placeCamera(now / 1000, dt);
  icons.update(dt, now / 1000, camera.position);
  modelTimer -= dt;
  if (modelTimer <= 0) { models.update(camera.position); modelTimer = 0.4; }
  world.update(camera, now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
ui.setCounter(foundSet.size, 0, TOTAL_LOCATIONS);
ui.showState('menu');
placeCamera(0, 0);
world.update(camera, 0, Infinity);
models.update(camera.position);
requestAnimationFrame(frame);

window.game = { setState, plane, state: () => game.state, save: game.save }; // debug hook

// ---- PWA: service worker (skipped on localhost so edits show up; add ?sw to test offline there) ----
if ('serviceWorker' in navigator) {
  const dev = ['localhost', '127.0.0.1'].includes(location.hostname) && !location.search.includes('sw');
  if (dev) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  else navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

// ---- Portrait: the CSS overlay covers the screen; also pause a flight in progress ----
matchMedia('(orientation: portrait) and (pointer: coarse)').addEventListener('change', (e) => {
  if (e.matches && game.state === 'flying') setState('paused');
});
