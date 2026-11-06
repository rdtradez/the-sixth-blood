// Service worker: lets the game open and play offline after the first visit.
// Network first, so a new release is picked up as soon as the device is online;
// the cache is only the fallback. Bump VERSION to force old caches to be dropped.
const VERSION = 'tsb-2';

const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'app/styles.css', 'app/main.js',
  'engine/util.js', 'engine/expr.js', 'engine/state.js', 'engine/script.js', 'engine/validate.js',
  'engine/runner.js', 'engine/versioning.js', 'engine/saves.js', 'engine/game.js', 'engine/fetch-loader.js',
  'engine/content.js',
  'content/manifest.json', 'content/stats.json', 'content/migrations.js',
  'content/flags.json', 'content/voice.json', 'content/people.json', 'content/origins.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })),
  );
});
