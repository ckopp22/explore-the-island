// localStorage save/load. Full save schema comes in the Book milestone.
const KEY = 'islandFlyover.v1';
const defaults = { unlockedIds: [], foundOnFlight: {}, flightCount: 0, bestFlight: 0, playSeconds: 0, fastestCompletion: null, settings: { sound: true, radar: true, tilt: false, ghost: true, hints: false, music: false } };

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...defaults, ...saved, settings: { ...defaults.settings, ...saved.settings } };
  }
  catch { return structuredClone(defaults); }
}
export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}
