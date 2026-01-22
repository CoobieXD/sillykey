const CACHE = 'sillykey-v1';
const ASSETS = [
	'./',
	'index.html',
	'styles.css',
	'app.js',
	'worker.js',
	'sha256.min.js',
	'base58.js',
	'identicon.js',
	'favicon.png',
	'apple-touch-icon.png',
	'icon.ico'
];

self.addEventListener('install', e => {
	e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
	self.skipWaiting();
});

self.addEventListener('activate', e => {
	e.waitUntil(
		caches.keys().then(keys =>
			Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', e => {
	e.respondWith(
		caches.match(e.request).then(r => r || fetch(e.request))
	);
});
