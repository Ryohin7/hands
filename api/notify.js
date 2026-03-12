
// Vercel Serverless Function: LINE Notification API
// Path: api/notify.js

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const { to, text, messages, apiKey } = req.body;

    // 安全檢查
    if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!to || (!text && !messages)) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const lineMessages = messages || [{ type: 'text', text: text }];

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                to: to,
                messages: lineMessages
            })
        });

        const data = await response.json();
        res.status(200).json(data);
    } catch (err) {
        console.error('Notify error:', err);
        res.status(500).json({ error: err.message });
    }
}
