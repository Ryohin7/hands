
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
            return await replyFlex(replyToken, '通知', '您尚未綁定員工帳號。請點擊選單或輸入「員工綁定」進行連動。', '#DC2626');
        }

        if (text === '員工綁定') {
            if (userData) {
                return await replyFlex(replyToken, '帳號資訊', `您的帳號已綁定成功！\n員工姓名：${userData.displayName || '未設定'}\n所屬門市：${userData.storeName || '未設定'}`, '#007130');
            }
            return await replyFlex(replyToken, '員工綁定', '請點擊下方按鈕登入系統以完成帳號綁定。', '#007130', [
                { type: 'button', action: { type: 'uri', label: '開始綁定', uri: `${process.env.VITE_APP_URL}/staff/line-bind?lineUserId=${lineUserId}` }, style: 'primary', color: '#007130' }
            ]);
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
            return await replyFlex(replyToken, '電子券申請', '請輸入欲申請數量，每張面額為 100 元\n（請輸入半形純數字）', '#007130');
        }

        if (session.state === 'WAIT_QTY') {
            const qty = parseInt(text);
            if (isNaN(qty) || qty <= 0) return await replyFlex(replyToken, '錯誤', '請輸入有效的正整數張數。', '#DC2626');
            await sessionRef.update({ state: 'WAIT_REASON', quantity: qty });
            return await replyFlex(replyToken, '電子券申請', '請問申請原因為何？（例如：檔期結束退貨補券）', '#007130');
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

            return await replyFlex(replyToken, '申請已送出', `單號：${applyRef.id}\n張數：${quantity}\n原因：${reason}\n請靜待主管審核。`, '#007130');
        }
    }

    if (event.type === 'postback') {
        const params = new URLSearchParams(event.postback.data);
        const action = params.get('action');
        const requestId = params.get('id');

        const adminQuery = await db.collection('users').where('lineUserId', '==', lineUserId).get();
        if (adminQuery.empty || !adminQuery.docs[0].data().permissions?.includes('coupon_audit')) {
            return await replyFlex(replyToken, '權限不足', '您不具備審核權限。', '#DC2626');
        }

        if (action === 'approve') {
            await handleApprove(requestId, adminQuery.docs[0].data().displayName, replyToken);
        } else if (action === 'reject') {
            // 先檢查案件是否已被處理
            const requestRef = db.collection('coupon_requests').doc(requestId);
            const docSnap = await requestRef.get();
            if (!docSnap.exists || docSnap.data().status !== 'pending') {
                return await replyFlex(replyToken, '處理通知', '此案件已經處裡完成。', '#666666');
            }

            const adminSessionRef = db.collection('line_sessions').doc(lineUserId);
            await adminSessionRef.set({
                state: 'WAIT_REJECT_REASON',
                targetRequestId: requestId,
                adminName: adminQuery.docs[0].data().displayName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await replyFlex(replyToken, '駁回作業', '請直接輸入並傳送「駁回原因」：', '#007130');
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
                    { type: 'button', action: { type: 'postback', label: '核准', data: `action=approve&id=${requestId}` }, style: 'primary', color: '#007130' },
                    { type: 'button', action: { type: 'postback', label: '駁回', data: `action=reject&id=${requestId}` }, style: 'secondary' }
                ]
            }
        });
    }
}

async function handleApprove(requestId, adminName, replyToken) {
    try {
        await db.runTransaction(async (transaction) => {
            const requestRef = db.collection('coupon_requests').doc(requestId);
            const docSnap = await transaction.get(requestRef);

            if (!docSnap.exists || docSnap.data().status !== 'pending') {
                throw new Error('CaseHandled');
            }

            const requestedQty = docSnap.data().quantityRequested;

            // 檢查庫存
            const couponsQuery = db.collection('coupons').where('isUsed', '==', false).limit(requestedQty);
            const couponsSnap = await transaction.get(couponsQuery);

            if (couponsSnap.size < requestedQty) {
                throw new Error('InsufficientStock');
            }

            // 更新申請狀態
            transaction.update(requestRef, {
                status: 'approved',
                reviewedByName: adminName,
                reviewedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 注意：實務上這裡還需要從庫存中標記這些券已使用，並記錄到申請單
            // 但考量原本 CouponAuditPage.jsx 的邏輯是核准後由網頁端或後續批次處理
            // 我們在此至少回報審核成功。
        });

        const requestData = (await db.collection('coupon_requests').doc(requestId).get()).data();
        await pushFlex(requestData.lineUserId, '申請審核通過', `您的電子券申請（單號：${requestId}）已由 ${adminName} 核准！`, '#007130');
        await replyFlex(replyToken, '核准成功', '已順利核准該申請。', '#007130');

    } catch (err) {
        if (err.message === 'CaseHandled') {
            await replyFlex(replyToken, '處理通知', '此案件已經處裡完成。', '#666666');
        } else if (err.message === 'InsufficientStock') {
            await replyFlex(replyToken, '庫存不足', '目前電子券沒有庫存，請向企劃申請電子券。', '#DC2626');
        } else {
            console.error('Approval transaction failed:', err);
            await replyFlex(replyToken, '錯誤', '核准作業執行失敗，請稍後再試。', '#DC2626');
        }
    }
}

async function handleReject(requestId, adminName, reason, replyToken) {
    try {
        await db.runTransaction(async (transaction) => {
            const requestRef = db.collection('coupon_requests').doc(requestId);
            const docSnap = await transaction.get(requestRef);

            if (!docSnap.exists || docSnap.data().status !== 'pending') {
                throw new Error('CaseHandled');
            }

            transaction.update(requestRef, {
                status: 'rejected',
                reviewedByName: adminName,
                adminNote: reason,
                reviewedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        const requestData = (await db.collection('coupon_requests').doc(requestId).get()).data();
        await pushFlex(requestData.lineUserId, '申請退回通知', `您的電子券申請（單號：${requestId}）已被 ${adminName} 駁回。\n原因：${reason}`, '#DC2626');
        await replyFlex(replyToken, '駁回成功', '案件已設定為駁回。', '#666666');

    } catch (err) {
        if (err.message === 'CaseHandled') {
            await replyFlex(replyToken, '處理通知', '此案件已經處裡完成。', '#666666');
        } else {
            console.error('Reject transaction failed:', err);
            await replyFlex(replyToken, '錯誤', '駁回作業執行失敗，請稍後再試。', '#DC2626');
        }
    }
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

async function replyFlex(replyToken, title, text, color = '#007130', footerContents = []) {
    const flex = {
        type: 'bubble',
        header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text, wrap: true, color: '#ffffff', weight: 'bold' }], backgroundColor: color },
        body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: title, weight: 'bold', size: 'sm', color: color, marginBottom: 'sm' }, { type: 'text', text, wrap: true, size: 'sm' }] }
    };
    if (footerContents.length > 0) {
        flex.footer = { type: 'box', layout: 'vertical', contents: footerContents };
    }
    return await callLineAPI('reply', { replyToken, messages: [{ type: 'flex', altText: title, contents: flex }] });
}

async function pushFlex(to, title, text, color = '#007130') {
    const flex = {
        type: 'bubble',
        header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: title, color: '#ffffff', weight: 'bold' }], backgroundColor: color },
        body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text, wrap: true, size: 'sm' }] }
    };
    return await callLineAPI('push', { to, messages: [{ type: 'flex', altText: title, contents: flex }] });
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
                { type: 'button', action: { type: 'uri', label: '會員資料異動', uri: `${process.env.VITE_APP_URL}/staff/member-actions` }, style: 'primary', color: '#007130', margin: 'md' },
                { type: 'button', action: { type: 'message', label: '電子券申請', text: '申請電子券' }, style: 'secondary', margin: 'md' }
            ]
        }
    };
    return await callLineAPI('reply', { replyToken, messages: [{ type: 'flex', altText: '員工功能選單', contents: flex }] });
}
