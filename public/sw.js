const CACHE_NAME = 'tabi-amazing-travel-v5';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/aistudio/amazing-travel-icon_eef69a7f.png',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/tabi/hero_kyoto.png',
  '/assets/tabi/hotel_kyoto.png',
  '/assets/tabi/logo.png',
  '/assets/tabi/plan_market.png',
  '/assets/tabi/plan_temple.png',
  '/assets/tabi/plan_gion.png',
  '/assets/tabi/matcha_parfait.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 絕不攔截或快取 Vite 開發環境模組與依賴套件，避免 React 雙實例版本衝突
  if (
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/') ||
    url.searchParams.has('v') ||
    url.searchParams.has('t')
  ) {
    return;
  }

  // 採用 Network-First 策略：連線時優先取得最新資源並更新快取，離線時自動回退至快取
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

