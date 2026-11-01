// The previous site registered a service worker. This one does not.
// If the wall is ever published over the same origin, drop the old caches
// and unregister so the new shell is not stuck behind the old cache.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
    })(),
  );
});
