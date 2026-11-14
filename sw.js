// Service worker: lets the game open and play offline after the first visit.
// Network first, so a new release is picked up as soon as the device is online;
// the cache is only the fallback. Bump VERSION to force old caches to be dropped.
const VERSION = 'tsb-14';

const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'app/styles.css', 'app/main.js', 'app/dom.js', 'app/art.js', 'app/settings-ui.js', 'app/panels.js', 'app/maps/city.html', 'app/maps/florence.html', 'app/maps/paris.html', 'app/maps/neworleans.html', 'engine/maps.js', 'app/devpanel.js', 'app/creation.js',
  'fonts/cinzel-latin-400-normal.woff2', 'fonts/cinzel-latin-600-normal.woff2', 'fonts/eb-garamond-latin-400-normal.woff2',
  'fonts/eb-garamond-latin-400-italic.woff2', 'fonts/eb-garamond-latin-600-normal.woff2', 'fonts/pinyon-script-latin-400-normal.woff2',
  'engine/util.js', 'engine/expr.js', 'engine/state.js', 'engine/script.js', 'engine/validate.js',
  'engine/runner.js', 'engine/versioning.js', 'engine/saves.js', 'engine/game.js', 'engine/fetch-loader.js',
  'engine/content.js', 'engine/settings.js', 'engine/screens.js', 'engine/achievements.js', 'engine/dev.js', 'engine/content-check.js',
  'engine/systems/index.js', 'engine/systems/core.js', 'engine/systems/sys-state.js',
  'engine/systems/life.js', 'engine/systems/combat.js', 'engine/systems/collis.js', 'engine/systems/village.js',
  'engine/systems/circle.js', 'engine/systems/bonds.js', 'engine/systems/originals.js', 'engine/systems/collection.js',
  'engine/systems/sleep.js', 'engine/systems/lore.js', 'engine/systems/looks.js', 'engine/looks.js', 'engine/creation.js',
  'content/manifest.json', 'content/stats.json', 'content/migrations.js',
  'content/flags.json', 'content/voice.json', 'content/people.json', 'content/origins.json',
  'content/rules.json', 'content/ventures.json', 'content/village.json', 'content/holdings.json',
  'content/originals.json', 'content/collection.json', 'content/sleep.json',
  'content/looks.json', 'content/codex.json', 'content/family.json', 'content/achievements.json', 'content/notes.json',
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
