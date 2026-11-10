// Screens and HUD. Shows the screen that matches the game state.
const $ = (id) => document.getElementById(id);
const panels = ['howto', 'settings'];
const stateScreens = ['menu', 'countdown', 'paused', 'flightOver', 'book', 'win'];

export function showState(state) {
  for (const s of stateScreens) $('screen-' + s).classList.toggle('hidden', s !== state);
  for (const p of panels) $('screen-' + p).classList.add('hidden');
  $('hud').classList.toggle('hidden', !['flying', 'paused'].includes(state));
}

export function showPanel(name) {
  $('screen-menu').classList.add('hidden');
  $('screen-' + name).classList.remove('hidden');
}

export function closePanels() {
  for (const p of panels) $('screen-' + p).classList.add('hidden');
  $('screen-menu').classList.remove('hidden');
}

export function setCountdown(text) { $('countdown-num').textContent = text; }

export function setTimer(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  $('timer').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  $('timer').classList.toggle('low', s <= 30);
}

export function onAction(handler) {
  document.getElementById('ui').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (b) handler(b.dataset.action);
  });
}

export function setWarning(on) { $('warning').classList.toggle('hidden', !on); }

export function flashGo() {
  const el = $('go');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
export function setFlightSummary(text) { $('fo-summary').textContent = text; }

export function setCounter(total, thisFlight, max = 80) {
  $('count-total').textContent = `${total} / ${max}`;
  $('count-flight').textContent = thisFlight ? `this flight: +${thisFlight}` : '';
}

let bannerTimer = null;
export function showBanner(name, region, isNew = true) {
  const el = $('banner');
  $('banner-name').textContent = name;
  $('banner-region').textContent = region;
  el.querySelector('.new').style.display = isNew ? '' : 'none';
  el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// ---- Radar: unfound icons near the plane, rotated so the plane's heading is up ----
const RADAR_RANGE = 1500;
const radarCtx = $('radar').getContext('2d');
export function setRadarVisible(on) { $('radar').classList.toggle('hidden', !on); }

export function drawRadar(pos, heading, locations, found, colors, t) {
  const c = radarCtx, S = 260, R = S / 2 - 6, cx = S / 2, cy = S / 2;
  const sin = Math.sin(heading), cos = Math.cos(heading);
  c.clearRect(0, 0, S, S);
  c.fillStyle = 'rgba(10,50,90,.55)'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 2;
  c.beginPath(); c.arc(cx, cy, R / 2, 0, 7); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 4;
  c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  for (const l of locations) {
    if (found.has(l.id)) continue;
    const dx = l.pos[0] - pos.x, dz = l.pos[2] - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > RADAR_RANGE) continue;
    const right = dx * cos + dz * sin, fwd = dx * sin - dz * cos;
    const near = d < 400, r = (near ? 9 + 2 * Math.sin(t * 8) : 7);
    c.fillStyle = '#' + colors[l.category].toString(16).padStart(6, '0');
    c.beginPath(); c.arc(cx + (right / RADAR_RANGE) * R, cy - (fwd / RADAR_RANGE) * R, r, 0, 7); c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  }
  // north marker
  c.fillStyle = '#fff'; c.font = 'bold 22px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('N', cx + (-sin) * (R - 14), cy - cos * (R - 14));
  // plane
  c.fillStyle = '#ff5a4d'; c.beginPath(); c.moveTo(cx, cy - 13); c.lineTo(cx + 10, cy + 11); c.lineTo(cx, cy + 6); c.lineTo(cx - 10, cy + 11); c.closePath(); c.fill();
}

export function setSoundIcon(on) {
  const t = on ? '\u{1F50A}' : '\u{1F507}';
  $('btn-sound').textContent = t; $('menu-sound').textContent = t;
}

export function showWin(lines) {
  $('win-stats').innerHTML = lines.map((l) => `<li>${l}</li>`).join('');
  const box = $('confetti');
  if (!box.childElementCount) {
    const colors = ['#ffd84d', '#ff5a4d', '#4db8ff', '#4dde6a', '#b36bff', '#fff'];
    box.innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${colors[i % 6]};animation-delay:${((i * 53) % 30) / 10}s;animation-duration:${3 + (i % 5) * 0.5}s"></i>`).join('');
  }
}
export function showConfirm(text) { $('confirm-text').textContent = text; $('screen-confirm').classList.remove('hidden'); }
export function hideConfirm() { $('screen-confirm').classList.add('hidden'); }
