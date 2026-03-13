
// Vercel Serverless Function: Notify Supervisors via LINE
// Path: api/notify-supervisors.js

import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.VITE_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const { requestId, displayId, applicantName, quantity, reason, apiKey } = req.body;

    // 安全檢查
    if (apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!requestId || !applicantName || !quantity) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        const supervisors = await db.collection('users').where('permissions', 'array-contains', 'coupon_audit').get();
        
        const results = [];
        for (const doc of supervisors.docs) {
            const adminLineId = doc.data().lineUserId;
            if (!adminLineId) continue;

            const response = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
                },
                body: JSON.stringify({
                    to: adminLineId,
                    messages: [{
                        type: 'flex',
                        altText: '🔔 電子券申請待審核',
                        contents: {
                            type: 'bubble',
                            header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '🔔 電子券申請待審核', weight: 'bold', color: '#007130' }] },
                            body: {
                                type: 'box', layout: 'vertical', contents: [
                                    { type: 'text', text: `申請單號：${displayId || requestId.substring(0,8)}`, size: 'sm', weight: 'bold' },
                                    { type: 'text', text: `申請人：${applicantName}`, size: 'sm', margin: 'sm' },
                                    { type: 'text', text: `申請張數：${quantity}`, size: 'sm' },
                                    { type: 'text', text: `原因：${reason || '未填寫'}`, size: 'sm', wrap: true }
                                ]
                            },
                            footer: {
                                type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                                    { type: 'button', action: { type: 'postback', label: '核准', data: `action=approve&id=${requestId}` }, style: 'primary', color: '#007130' },
                                    { type: 'button', action: { type: 'postback', label: '駁回', data: `action=reject&id=${requestId}` }, style: 'secondary' }
                                ]
                            }
                        }
                    }]
                })
            });
            results.push(await response.json());
        }

        res.status(200).json({ success: true, results });
    } catch (err) {
        console.error('Notify supervisors error:', err);
        res.status(500).json({ error: err.message });
    }
}
