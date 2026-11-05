const CACHE = 'fieldledger-shell-v29';
const SHELL = [
  '/certificates.js',
  '/shared/certificates.mjs',
  '/vendor/jsqr.js',
  '/support.js',
  '/shared/support.mjs',
  '/',
  '/app.js',
  '/features.js',
  '/household.js',
  '/shared/health.mjs',
  '/shared/offline-model.mjs',
  '/offline.js',
  '/i18n.js',
  '/translations.js',
  '/shared/catalog.mjs',
  '/styles.css',
  '/manifest.webmanifest',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(k => k.startsWith('fieldledger-shell-') && k !== CACHE).map(k => caches.delete(k)))
      )
  );
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(caches.match('/').then(cached => cached || fetch(e.request)));
    return;
  }
  if (SHELL.includes(url.pathname)) e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
