const CACHE_NAME = 'bookvocab-v3';
// The service worker lives next to index.html, so its own URL gives us the
// deployment base path (e.g. '/bookvocab/' on GitHub Pages project sites).
const BASE_PATH = new URL('./', self.location.href).pathname;
const STATIC_ASSETS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.webmanifest`,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('Service Worker: Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

// Fetch event - different strategies by resource type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    // API requests - Network First with Cache Fallback
    if (url.origin.includes('dictionaryapi.com') ||
        url.origin.includes('openlibrary.org') ||
        url.origin.includes('covers.openlibrary.org')) {

      event.respondWith(
        fetch(request)
          .then((response) => {
            // Clone and cache successful responses
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              });
            }
            return response;
          })
          .catch(() => {
            // Fallback to cache if network fails
            return caches.match(request).then((cached) => {
              if (cached) {
                return cached;
              }
              // Return a basic error response if not cached
              return new Response('Offline - no cached data available', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain',
                }),
              });
            });
          })
      );
    }
    return;
  }

  // Pages (index.html, the manifest, sw-adjacent files) - Network First, so a
  // new deploy shows up on the next visit; the cache is only an offline backup.
  const isHashedAsset = url.pathname.startsWith(`${BASE_PATH}assets/`);
  if (request.mode === 'navigate' || !isHashedAsset) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || caches.match(`${BASE_PATH}index.html`)
          )
        )
    );
    return;
  }

  // Hashed build assets never change - Cache First with Network Fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});
