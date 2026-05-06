// Service Worker mínimo - cache-first para shell estático
const CACHE = 'stockly-v1';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const req = e.request;
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return;          // nunca cachear API
    if (req.method !== 'GET') return;
    e.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(resp => {
            if (resp.ok && url.origin === location.origin) {
                const clone = resp.clone();
                caches.open(CACHE).then(c => c.put(req, clone));
            }
            return resp;
        }).catch(() => caches.match('/index.html')))
    );
});
