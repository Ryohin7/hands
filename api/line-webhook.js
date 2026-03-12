
// Vercel Serverless Function: LINE Webhook
// Path: api/line-webhook.js

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

    const events = req.body.events;
    if (!events) return res.status(200).send('OK');

    for (const event of events) {
        try {
            await handleEvent(event);
        } catch (err) {
            console.error('Error handling event:', err);
        }
    }

    res.status(200).send('OK');
}

async function handleEvent(event) {
    const lineUserId = event.source.userId;
    const replyToken = event.replyToken;

    if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim();

        const userQuery = await db.collection('users').where('lineUserId', '==', lineUserId).get();
        const userData = userQuery.empty ? null : { id: userQuery.docs[0].id, ...userQuery.docs[0].data() };

        if (!userData && text !== '員工綁定') {
            return await replyText(replyToken, '您尚未綁定員工帳號。請點擊選單或輸入「員工綁定」進行連動。');
        }

        if (text === '員工綁定') {
            return await replyText(replyToken, `請點擊連結綁定員工帳號：\n${process.env.VITE_APP_URL}/staff/line-bind?lineUserId=${lineUserId}`);
        }

        if (text === '員工功能') {
            return await replyFlexMenu(replyToken);
        }

        const sessionRef = db.collection('line_sessions').doc(lineUserId);
        const sessionDoc = await sessionRef.get();
        const session = sessionDoc.exists ? sessionDoc.data() : { state: 'IDLE' };

        // 處理主管輸入駁回原因
        if (session.state === 'WAIT_REJECT_REASON') {
            const reason = text;
            const requestId = session.targetRequestId;
            const adminName = session.adminName;
            await sessionRef.delete();
            await handleReject(requestId, adminName, reason, replyToken);
            return;
        }

        if (text === '申請電子券' || text === '電子券申請') {
            await sessionRef.set({ state: 'WAIT_QTY', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            return await replyText(replyToken, '好的，請問您要申請幾張電子券？（請輸入純數字）');
        }

        if (session.state === 'WAIT_QTY') {
            const qty = parseInt(text);
            if (isNaN(qty) || qty <= 0) return await replyText(replyToken, '請輸入有效的正整數張數。');
            await sessionRef.update({ state: 'WAIT_REASON', quantity: qty });
            return await replyText(replyToken, '收到。請問申請原因為何？（例如：檔期結束退貨補券）');
        }

        if (session.state === 'WAIT_REASON') {
            const reason = text;
            const quantity = session.quantity;
            
            const applyRef = await db.collection('coupon_requests').add({
                userId: userData.id,
                userName: userData.displayName || '員工',
                lineUserId: lineUserId,
                quantityRequested: quantity,
                reason: reason,
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            await sessionRef.delete();
            await notifySupervisors(applyRef.id, userData.displayName, quantity, reason);
            
            return await replyText(replyToken, `申請已送出！\n單號：${applyRef.id}\n張數：${quantity}\n原因：${reason}\n請靜待主管審核。`);
        }
    }

    if (event.type === 'postback') {
        const params = new URLSearchParams(event.postback.data);
        const action = params.get('action');
        const requestId = params.get('id');
        
        const adminQuery = await db.collection('users').where('lineUserId', '==', lineUserId).get();
        if (adminQuery.empty || !adminQuery.docs[0].data().permissions?.includes('coupon_audit')) {
            return await replyText(replyToken, '您不具備審核權限。');
        }

        if (action === 'approve') {
            await handleApprove(requestId, adminQuery.docs[0].data().displayName, replyToken);
        } else if (action === 'reject') {
            const adminSessionRef = db.collection('line_sessions').doc(lineUserId);
            await adminSessionRef.set({ 
                state: 'WAIT_REJECT_REASON', 
                targetRequestId: requestId,
                adminName: adminQuery.docs[0].data().displayName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
            await replyText(replyToken, '請輸入駁回原因：');
        }
    }
}

async function notifySupervisors(requestId, applicantName, qty, reason) {
    const supervisors = await db.collection('users').where('permissions', 'array-contains', 'coupon_audit').get();
    
    for (const doc of supervisors.docs) {
        const adminLineId = doc.data().lineUserId;
        if (!adminLineId) continue;

        await pushFlexMessage(adminLineId, {
            type: 'bubble',
            header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '🔔 電子券申請待審核', weight: 'bold', color: '#007130' }] },
            body: {
                type: 'box', layout: 'vertical', contents: [
                    { type: 'text', text: `申請人：${applicantName}`, size: 'sm' },
                    { type: 'text', text: `申請張數：${qty}`, size: 'sm' },
                    { type: 'text', text: `原因：${reason}`, size: 'sm', wrap: true }
                ]
            },
            footer: {
                type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                    { type: 'button', action: { type: 'postback', label: '核核准', data: `action=approve&id=${requestId}` }, style: 'primary', color: '#007130' },
                    { type: 'button', action: { type: 'postback', label: '駁回', data: `action=reject&id=${requestId}` }, style: 'secondary' }
                ]
            }
        });
    }
}

async function handleApprove(requestId, adminName, replyToken) {
    const requestRef = db.collection('coupon_requests').doc(requestId);
    const docSnap = await requestRef.get();
    if (!docSnap.exists || docSnap.data().status !== 'pending') return await replyText(replyToken, '此申請不存在或已處理過。');

    await requestRef.update({ 
        status: 'approved', 
        reviewedByName: adminName,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    
    await pushMessage(docSnap.data().lineUserId, `您的電子券申請（單號：${requestId}）已由 ${adminName} 核准！`);
    await replyText(replyToken, '已核准該申請。');
}

async function handleReject(requestId, adminName, reason, replyToken) {
    const requestRef = db.collection('coupon_requests').doc(requestId);
    const docSnap = await requestRef.get();
    if (!docSnap.exists || docSnap.data().status !== 'pending') return await replyText(replyToken, '此申請不存在或已處理過。');

    await requestRef.update({ 
        status: 'rejected', 
        reviewedByName: adminName,
        adminNote: reason,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp() 
    });
    
    await pushMessage(docSnap.data().lineUserId, `您的電子券申請（單號：${requestId}）已被 ${adminName} 駁回。\n原因：${reason}`);
    await replyText(replyToken, '核准作業已完成 (已駁回)。');
}

// Helpers
async function callLineAPI(path, body) {
    return await fetch(`https://api.line.me/v2/bot/message/${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify(body)
    });
}

async function replyText(replyToken, text) {
    return await callLineAPI('reply', { replyToken, messages: [{ type: 'text', text }] });
}

async function pushMessage(to, text) {
    return await callLineAPI('push', { to, messages: [{ type: 'text', text }] });
}

async function pushFlexMessage(to, flex) {
    return await callLineAPI('push', { to, messages: [{ type: 'flex', altText: '員工訊息', contents: flex }] });
}

async function replyFlexMenu(replyToken) {
    const flex = {
        type: 'bubble',
        header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '員工專區', weight: 'bold', size: 'xl', color: '#007130' }] },
        body: {
            type: 'box', layout: 'vertical', contents: [
                { type: 'button', action: { type: 'uri', label: '會員資料異動', uri: `${process.env.VITE_APP_URL}/staff/member-audit` }, style: 'primary', color: '#007130', margin: 'md' },
                { type: 'button', action: { type: 'message', label: '電子券申請', text: '申請電子券' }, style: 'secondary', margin: 'md' }
            ]
        }
    };
    return await callLineAPI('reply', { replyToken, messages: [{ type: 'flex', altText: '員工功能選單', contents: flex }] });
}
