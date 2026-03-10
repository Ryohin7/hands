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
                            // 發送自定義事件通知 UI 有新版本
                            window.dispatchEvent(new CustomEvent('swUpdated', { detail: registration }));
                        }
                    });
                }
            });
        } catch (error) {
            console.error('Service Worker 註冊失敗:', error);
        }
    }
}
