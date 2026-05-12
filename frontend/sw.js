// Service Worker autodesregistro: limpia caches y se elimina al activarse.
// Esta versión existe para purgar el sw antiguo (stockly-v1) que cacheaba
// app.js con la URL `http://localhost:3001/api` hardcodeada y rompía el
// login desde otros PCs.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(
        (async () => {
            try {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
                await self.registration.unregister();
                const clients = await self.clients.matchAll({ type: 'window' });
                clients.forEach(c => c.navigate(c.url));
            } catch (_) {}
        })()
    );
});

// Pasar todas las requests directo a la red, sin cache
self.addEventListener('fetch', () => {});
