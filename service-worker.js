// Cache-first service worker so the game works fully offline.
// IMPORTANT: bump VERSION on every deploy that changes any file, so players get the update and the old cache is removed.
// All URLs are relative, so this works under /repo-name/ on GitHub Pages.
const VERSION = 'v1';
const CACHE = `island-flyover-${VERSION}`;
const ASSETS = [
  './', './index.html', './style.css', './manifest.json',
  './js/main.js', './js/world.js', './js/locations.js', './js/models.js', './js/icons.js', './js/plane.js',
  './js/controls.js', './js/book.js', './js/ui.js', './js/audio.js', './js/storage.js', './js/debugcam.js',
  './lib/three.module.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('island-flyover-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
