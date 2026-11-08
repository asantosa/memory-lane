const CACHE = 'memory-lane-shell-v4';
const SHELL = ['./studio.html', './studio.css', './studio.js', './movie.js', './assets/fonts/dm-sans-400-normal.ttf', './assets/fonts/dm-sans-500-normal.ttf', './assets/fonts/dm-sans-600-normal.ttf', './assets/fonts/dm-sans-700-normal.ttf', './assets/fonts/dm-serif-display-400-italic.ttf', './assets/fonts/dm-serif-display-400-normal.ttf', './', './index.html', './style.css', './artwork.css', './app.js', './voice.js', './pwa.js', './manifest.webmanifest', './assets/lakeside-demo.png', './assets/lakeside-boat.png', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('memory-lane-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Cache only the public app shell. Memories remain in browser storage.
  if (!SHELL.some(path => new URL(path, self.registration.scope).pathname === url.pathname)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    return cached || fetch(event.request);
  }));
});
