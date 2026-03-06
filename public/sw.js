const CACHE_NAME = 'notice-v2';
const STATIC_ASSETS = [
    '/',
    '/manifest.json',
];

// Install: 快取靜態資源
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: 清除舊快取
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch: Network-First 策略（適合動態公告內容）
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // 只處理 http/https 請求，跳過 chrome-extension:// 等
    if (!request.url.startsWith('http')) return;

    // 跳過非 GET 請求
    if (request.method !== 'GET') return;

    // API 和 Firebase 請求使用 Network-Only
    if (request.url.includes('firestore.googleapis.com') ||
        request.url.includes('identitytoolkit.googleapis.com')) {
        return;
    }

    // 靜態資源使用 Cache-First
    if (request.destination === 'style' ||
        request.destination === 'script' ||
        request.destination === 'font' ||
        request.destination === 'image') {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // HTML 頁面使用 Network-First
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});

// 接收 SKIP_WAITING 訊息
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
