// Vercel Serverless Function: MAAC SMS Proxy API
// Path: api/sms.js

export default async function handler(req, res) {
    // 跨域 CORS 設定 (如果需要的話，Vercel 預設支援同域)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, apiKey, data } = req.body;

    // 安全檢查：驗證前端傳入的專案內部密鑰
    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
        return res.status(403).json({ error: 'Unauthorized: Invalid INTERNAL_API_KEY' });
    }

    // 獲取 Cresclab MAAC API Key
    const maacApiKey = process.env.MAACGO_API_KEY;
    if (!maacApiKey) {
        return res.status(500).json({ error: 'Server misconfiguration: MAACGO_API_KEY is not set' });
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${maacApiKey}`
    };

    try {
        switch (action) {
            case 'send': {
                const { to, body, scheduled_at, isBroadcast, isPersonalized, template, recipients } = data;

                // 1. 處理個性化變數批次簡訊發送
                if (isPersonalized) {
                    if (!template) {
                        return res.status(400).json({ error: '簡訊範本不能為空' });
                    }
                    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
                        return res.status(400).json({ error: '收件人名單不能為空' });
                    }

                    const results = [];
                    let successCount = 0;
                    let failedCount = 0;
                    let lastBalance = null;

                    // 每次最多發送 100 筆個性化簡訊，防範 Serverless 逾時
                    const listToSend = recipients.slice(0, 100);

                    const sendPromises = listToSend.map(async (item) => {
                        const { to: phone, variables } = item;
                        if (!phone) return;

                        // 動態替換變數，替換範本中的 {{姓名}} 與 {{點數}} 等變數
                        let personalizedBody = template;
                        if (variables) {
                            Object.keys(variables).forEach(key => {
                                const val = variables[key] !== undefined ? variables[key] : '';
                                const regex = new RegExp(`{{${key}}}`, 'g');
                                personalizedBody = personalizedBody.replace(regex, val);
                            });
                        }

                        try {
                            const response = await fetch('https://sms.cresclab.com/api/sms/send', {
                                method: 'POST',
                                headers,
                                body: JSON.stringify({
                                    to: phone,
                                    body: personalizedBody
                                })
                            });

                            const sendData = await response.json();
                            if (response.ok) {
                                successCount++;
                                if (sendData.balance_cents !== undefined) {
                                    lastBalance = sendData.balance_cents;
                                }
                                results.push({ to: phone, success: true, id: sendData.message_id });
                            } else {
                                failedCount++;
                                results.push({ to: phone, success: false, error: sendData.error || '發送失敗' });
                            }
                        } catch (err) {
                            failedCount++;
                            results.push({ to: phone, success: false, error: err.message });
                        }
                    });

                    await Promise.all(sendPromises);

                    return res.status(200).json({
                        ok: true,
                        success: true,
                        type: 'personalized',
                        total: listToSend.length,
                        successCount,
                        failedCount,
                        balance_cents: lastBalance,
                        details: results
                    });
                }

                if (!body) {
                    return res.status(400).json({ error: '簡訊內容不能為空' });
                }

                // 如果是排程發送，或者 explicit 要求 broadcast，或者有多個收件人
                const isArray = Array.isArray(to);
                const hasSchedule = !!scheduled_at;
                
                if (isBroadcast || hasSchedule || isArray || (typeof to === 'string' && to.includes(','))) {
                    // 群發或排程群發 -> 調用 /broadcast
                    let recipientsList = [];
                    if (isArray) {
                        recipientsList = to;
                    } else if (typeof to === 'string') {
                        recipientsList = to.split(',').map(num => num.trim()).filter(Boolean);
                    }

                    if (recipientsList.length === 0) {
                        return res.status(400).json({ error: '收件人電話號碼不能為空' });
                    }

                    const bodyData = {
                        body: body,
                        recipients: recipientsList
                    };

                    if (hasSchedule) {
                        bodyData.scheduled_at = scheduled_at; // ISO 8601
                    }

                    const response = await fetch('https://sms.cresclab.com/api/broadcast', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(bodyData)
                    });

                    const responseData = await response.json();
                    if (!response.ok) {
                        return res.status(response.status).json(responseData);
                    }
                    return res.status(200).json({ ok: true, success: true, type: 'broadcast', data: responseData });
                } else {
                    // 單筆立即發送 -> 調用 /sms/send
                    const recipient = typeof to === 'string' ? to.trim() : (Array.isArray(to) ? to[0] : '');
                    if (!recipient) {
                        return res.status(400).json({ error: '收件人電話號碼不能為空' });
                    }

                    const response = await fetch('https://sms.cresclab.com/api/sms/send', {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            to: recipient,
                            body: body
                        })
                    });

                    const responseData = await response.json();
                    if (!response.ok) {
                        return res.status(response.status).json(responseData);
                    }
                    return res.status(200).json({ ok: true, success: true, type: 'single', data: responseData });
                }
            }

            case 'list': {
                // 獲取歷史紀錄
                const limit = data?.limit || 50;
                const response = await fetch(`https://sms.cresclab.com/api/sms/list?limit=${limit}`, {
                    method: 'GET',
                    headers
                });

                const responseData = await response.json();
                if (!response.ok) {
                    return res.status(response.status).json(responseData);
                }
                return res.status(200).json(responseData);
            }

            case 'metrics': {
                // 獲取發送統計資料
                const days = data?.days || 30;
                const response = await fetch(`https://sms.cresclab.com/api/sms/metrics?days=${days}`, {
                    method: 'GET',
                    headers
                });

                const responseData = await response.json();
                if (!response.ok) {
                    return res.status(response.status).json(responseData);
                }
                return res.status(200).json(responseData);
            }

            default:
                return res.status(400).json({ error: `Unsupported action: ${action}` });
        }
    } catch (err) {
        console.error('MAAC SMS proxy error:', err);
        return res.status(500).json({ error: err.message });
    }
}
