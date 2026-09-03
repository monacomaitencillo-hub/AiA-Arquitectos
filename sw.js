const CACHE_NAME = 'aia-wiki-v2';
const APP_SHELL = [
  '/app.html',
  '/index.html',
  '/login.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Solo cachea el "app shell" estático propio (mismo origen). Todo lo demás
// (Firestore, Firebase Auth, Google Fonts, APIs) pasa directo a la red: es
// contenido dinámico que no debe quedar atrapado en caché.
//
// Red primero, caché como respaldo solo sin conexión. La app cambia seguido
// (se está iterando activamente); con "caché primero" un cambio recién
// subido no se veía hasta la SEGUNDA vez que se abría la app — la primera
// mostraba lo viejo (guardado) mientras actualizaba el caché en segundo
// plano para la vez siguiente. Sin conexión, sigue funcionando con lo
// último que haya quedado guardado.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
