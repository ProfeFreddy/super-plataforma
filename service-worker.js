self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('gincananexus-v1').then(cache => {
      return cache.addAll(['/juego/index.html']);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});