// Path: api/sms-webhook.js
// Vercel Serverless Function: Cresclab MAAC SMS Webhook Receiver

export default async function handler(req, res) {
    // 支援 CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cresclab-Signature');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 支援 GET (可用於設定 Webhook 時的端點可達性測試)
    if (req.method === 'GET') {
        return res.status(200).json({ ok: true, status: 'Cresclab MAAC Webhook Receiver is active' });
    }

    if (req.method === 'POST') {
        const signature = req.headers['x-cresclab-signature'];
        const eventData = req.body;

        // 記錄接收到的簡訊狀態回報 (可以在 Vercel console 方便實時查閱)
        console.log('[SMS Webhook Received]', {
            signature,
            event: eventData?.event,
            data: eventData?.data,
            timestamp: new Date().toISOString()
        });

        // 此端點提供後續即時與資料庫連動的極佳擴充點
        return res.status(200).json({ success: true, message: 'DLR event received' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
