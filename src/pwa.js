export async function registerSW() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            });

            // 每當頁面回到前台（視窗獲得焦點）時，主動檢查更新
            window.addEventListener('focus', () => {
                registration.update();
            });

            // 檢查更新
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // 有新版本可用，立即執行 skipWaiting 並重新整理
                            newWorker.postMessage({ type: 'SKIP_WAITING' });
                            // 延遲一下讓 SW 接管後再重新整理，確保抓到的是最新版
                            setTimeout(() => {
                                window.location.reload();
                            }, 500);
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }
}
