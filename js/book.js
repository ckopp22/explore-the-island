// Location Book: progress header, region tabs, 80-slot grid (silhouettes / cards), detail card.
import { CAT_COLORS } from './icons.js';
import { TOTAL_LOCATIONS } from './locations.js';

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createBook({ locations, regions, getSave }) {
  const root = $('book'), tabsEl = $('book-tabs'), grid = $('book-grid'), card = $('book-card');
  const regionsUsed = regions.filter((r) => locations.some((l) => l.region === r.id));
  const nameOf = (id) => (regions.find((r) => r.id === id) || {}).name || id;
  let tab = 'all';

  function render() {
    const save = getSave(), found = new Set(save.unlockedIds), hints = !!save.settings.hints;
    const n = found.size, complete = n >= TOTAL_LOCATIONS;

    $('book-count').textContent = `Found ${n} / ${TOTAL_LOCATIONS}`;
    $('book-bar').style.width = (n / TOTAL_LOCATIONS) * 100 + '%';
    $('book-badge').classList.toggle('hidden', !complete);
    $('book-congrats').classList.toggle('hidden', !complete);
    root.classList.toggle('complete', complete);

    const per = (id) => { const ls = locations.filter((l) => l.region === id); return [ls.filter((l) => found.has(l.id)).length, ls.length]; };
    tabsEl.innerHTML = [`<button data-tab="all" class="${tab === 'all' ? 'on' : ''}">All <small>${n}/${TOTAL_LOCATIONS}</small></button>`]
      .concat(regionsUsed.map((r) => { const [f, t] = per(r.id); return `<button data-tab="${r.id}" class="${tab === r.id ? 'on' : ''}${f === t ? ' done' : ''}">${esc(r.name)} <small>${f}/${t}</small></button>`; })).join('');

    const list = tab === 'all' ? locations : locations.filter((l) => l.region === tab);
    grid.innerHTML = list.map((l) => {
      if (found.has(l.id)) {
        return `<button class="slot found${l.category === 'secret' ? ' gold' : ''}" data-id="${l.id}" style="--cat:${hex(CAT_COLORS[l.category])}"><span class="em">${l.emoji}</span><span class="nm">${esc(l.name)}</span></button>`;
      }
      return `<div class="slot locked"><span class="em">${l.emoji}</span><span class="nm">???</span><small>${hints ? esc(nameOf(l.region)) : '&nbsp;'}</small></div>`;
    }).join('');
    grid.scrollTop = 0;
    card.classList.add('hidden');
  }

  function showCard(id) {
    const l = locations.find((x) => x.id === id), save = getSave();
    if (!l || !save.unlockedIds.includes(id)) return;
    const flight = save.foundOnFlight[id];
    card.innerHTML = `<div class="card-body${l.category === 'secret' ? ' gold' : ''}" style="--cat:${hex(CAT_COLORS[l.category])}">
      <div class="em">${l.emoji}</div><h3>${esc(l.name)}</h3>
      <div class="meta">${esc(nameOf(l.region))} &middot; ${esc(l.category)}</div>
      <p>${esc(l.blurb)}</p>${flight ? `<small>Found on flight #${flight}</small>` : ''}
      <button data-action="cardclose">Close</button></div>`;
    card.classList.remove('hidden');
  }

  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } });
  grid.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) showCard(+b.dataset.id); });
  card.addEventListener('click', (e) => { if (e.target === card || e.target.closest('[data-action="cardclose"]')) { e.stopPropagation(); card.classList.add('hidden'); } });

  return { render };
}
