
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

        // 1. 如果尚未綁定，且輸入的不是「員工綁定」，則提示綁定
        if (!userData && text !== '員工綁定') {
            return await replyFlex(replyToken, '通知', '您尚未綁定員工帳號。請點擊選單或輸入「員工綁定」進行連動。', '#DC2626');
        }

        // 2. 處理「員工綁定」指令
        if (text === '員工綁定') {
            if (userData) {
                return await replyFlex(replyToken, '帳號資訊', `您的帳號已綁定成功！\n\n員工姓名：${userData.displayName || '未設定'}\n所屬門市：${userData.storeName || '未設定'}`, '#007130');
            }
            const appUrl = process.env.VITE_APP_URL || 'https://handstw.vercel.app';
            return await replyFlex(replyToken, '員工帳號綁定', '您尚未完成連動。請點擊下方按鈕登入系統，即可完成綁定作業。', '#007130', [
                { type: 'button', action: { type: 'uri', label: '開始綁定', uri: `${appUrl}/staff/line-bind?lineUserId=${lineUserId}` }, style: 'primary', color: '#007130' }
            ]);
        }

        // 3. 處理「員工功能」指令（選單）
        if (text === '員工功能') {
            return await replyFlexMenu(replyToken);
        }

        // 4. 對話狀態管理 (Session)
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

        // 處理電子券申請流程
        if (text === '申請電子券' || text === '電子券申請') {
            await sessionRef.set({ state: 'WAIT_QTY', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            return await replyFlex(replyToken, '電子券申請', '請輸入欲申請電子券數量，每張面額為 100 元\n（請輸入半形純數字）', '#007130');
        }

        if (session.state === 'WAIT_QTY') {
            const qty = parseInt(text);
            if (isNaN(qty) || qty <= 0) return await replyFlex(replyToken, '輸入錯誤', '請輸入有效的正整數數量。', '#DC2626');
            await sessionRef.update({ state: 'WAIT_REASON', quantity: qty });
            return await replyFlex(replyToken, '電子券申請', '請問申請原因為何？\n（例如：檔期結束退貨補券）', '#007130');
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

            return await replyFlex(replyToken, '申請已送出', `單號：${applyRef.id}\n數量：${quantity} 張\n原因：${reason}\n\n請靜待主管審核，系統將會即時通知您結果。`, '#007130');
        }
    }

    // 5. 處理 Postback 事件（按鈕回傳）
    if (event.type === 'postback') {
        const params = new URLSearchParams(event.postback.data);
        const action = params.get('action');
        const requestId = params.get('id');

        const adminQuery = await db.collection('users').where('lineUserId', '==', lineUserId).get();
        if (adminQuery.empty || !adminQuery.docs[0].data().permissions?.includes('coupon_audit')) {
            return await replyFlex(replyToken, '權限通知', '您目前的帳號不具備電子券審核權限。', '#DC2626');
        }

        if (action === 'approve') {
            await handleApprove(requestId, adminQuery.docs[0].data().displayName, replyToken);
        } else if (action === 'reject') {
            // 先檢查案件是否已被處理
            const requestRef = db.collection('coupon_requests').doc(requestId);
            const docSnap = await requestRef.get();
            if (!docSnap.exists || docSnap.data().status !== 'pending') {
                return await replyFlex(replyToken, '處理通知', '此案件已被您或其他主管處裡完成，請勿重複操作。', '#666666');
            }

            const adminSessionRef = db.collection('line_sessions').doc(lineUserId);
            await adminSessionRef.set({
                state: 'WAIT_REJECT_REASON',
                targetRequestId: requestId,
                adminName: adminQuery.docs[0].data().displayName,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await replyFlex(replyToken, '案件駁回', '請直接輸入並傳送「駁回原因」：', '#007130');
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
            header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '🔔 電子券申請待審核', weight: 'bold', color: '#ffffff' }], backgroundColor: '#007130' },
            body: {
                type: 'box', layout: 'vertical', contents: [
                    { type: 'text', text: `申請人：${applicantName}`, size: 'sm', weight: 'bold' },
                    { type: 'text', text: `申請數量：${qty} 張`, size: 'sm' },
                    { type: 'text', text: `原因：${reason}`, size: 'sm', wrap: true, margin: 'md' }
                ]
            },
            footer: {
                type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
                    { type: 'button', action: { type: 'postback', label: '核準', data: `action=approve&id=${requestId}` }, style: 'primary', color: '#007130' },
                    { type: 'button', action: { type: 'postback', label: '駁回', data: `action=reject&id=${requestId}` }, style: 'secondary' }
                ]
            }
        });
    }
}

async function handleApprove(requestId, adminName, replyToken) {
    let assignedCoupons = [];
    try {
        await db.runTransaction(async (transaction) => {
            const requestRef = db.collection('coupon_requests').doc(requestId);
            const docSnap = await transaction.get(requestRef);

            if (!docSnap.exists || docSnap.data().status !== 'pending') {
                throw new Error('CaseHandled');
            }

            const requestedQty = docSnap.data().quantityRequested;

            // 抓取未使用電子券
            const couponsQuery = db.collection('coupons').where('isUsed', '==', false).limit(requestedQty);
            const couponsSnap = await transaction.get(couponsQuery);

            if (couponsSnap.size < requestedQty) {
                throw new Error('InsufficientStock');
            }

            const couponCodes = [];
            couponsSnap.docs.forEach(cDoc => {
                const code = cDoc.data().code;
                couponCodes.push(code);
                transaction.update(cDoc.ref, {
                    isUsed: true,
                    requestId: requestId,
                    usedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            assignedCoupons = couponCodes;

            // 更新申請狀態
            transaction.update(requestRef, {
                status: 'approved',
                assignedCoupons: couponCodes,
                reviewedByName: adminName,
                reviewedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        const requestDoc = await db.collection('coupon_requests').doc(requestId).get();
        const requestData = requestDoc.data();
        
        // 格式化電子券號顯示
        const couponListText = assignedCoupons.join('\n');

        await pushFlex(requestData.lineUserId, '申請審核結果', `您的電子券申請（單號：${requestId}）已由 ${adminName} 核准！\n\n【核發券號如下】：\n${couponListText}`, '#007130');
        await replyFlex(replyToken, '核准作業成功', '已順利完成核准作業並發放券號。', '#007130');

    } catch (err) {
        if (err.message === 'CaseHandled') {
            await replyFlex(replyToken, '處理通知', '此案件已經處裡完成，請勿重複操作。', '#666666');
        } else if (err.message === 'InsufficientStock') {
            await replyFlex(replyToken, '庫存不足', '目前電子券沒有庫存，請向企劃部申請電子券撥入。', '#DC2626');
        } else {
            console.error('Approval transaction failed:', err);
            await replyFlex(replyToken, '系統錯誤', '核准作業執行失敗，請聯絡系統管理員。', '#DC2626');
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

        const requestDoc = await db.collection('coupon_requests').doc(requestId).get();
        const requestData = requestDoc.data();
        await pushFlex(requestData.lineUserId, '申請審核結果', `您的電子券申請（單號：${requestId}）已被 ${adminName} 駁回。\n原因：${reason}`, '#DC2626');
        await replyFlex(replyToken, '駁回作業成功', '案件已成功設定為駁回狀態。', '#666666');

    } catch (err) {
        if (err.message === 'CaseHandled') {
            await replyFlex(replyToken, '處理通知', '此案件已經處裡完成。', '#666666');
        } else {
            console.error('Reject transaction failed:', err);
            await replyFlex(replyToken, '系統錯誤', '駁回作業執行失敗。', '#DC2626');
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
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'md' }],
            backgroundColor: color
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: text, wrap: true, size: 'sm' }]
        }
    };
    if (footerContents.length > 0) {
        flex.footer = { type: 'box', layout: 'vertical', contents: footerContents };
    }
    return await callLineAPI('reply', { replyToken, messages: [{ type: 'flex', altText: title, contents: flex }] });
}

async function pushFlex(to, title, text, color = '#007130') {
    const flex = {
        type: 'bubble',
        header: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text: title, color: '#ffffff', weight: 'bold', size: 'md' }],
            backgroundColor: color
        },
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [{ type: 'text', text, wrap: true, size: 'sm' }]
        }
    };
    return await callLineAPI('push', { to, messages: [{ type: 'flex', altText: title, contents: flex }] });
}

async function pushFlexMessage(to, flex) {
    return await callLineAPI('push', { to, messages: [{ type: 'flex', altText: '員工訊息', contents: flex }] });
}

async function replyFlexMenu(replyToken) {
    const appUrl = process.env.VITE_APP_URL || 'https://handstw.vercel.app';
    const flex = {
        type: 'bubble',
        header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '員工專區選單', weight: 'bold', size: 'lg', color: '#ffffff' }], backgroundColor: '#007130' },
        body: {
            type: 'box', layout: 'vertical', contents: [
                { type: 'button', action: { type: 'uri', label: '會員資料異動', uri: `${appUrl}/staff/member-actions` }, style: 'primary', color: '#007130', margin: 'md' },
                { type: 'button', action: { type: 'message', label: '電子券申請', text: '申請電子券' }, style: 'secondary', margin: 'md' }
            ]
        }
    };
    return await callLineAPI('reply', { replyToken, messages: [{ type: 'flex', altText: '員工功能選單', contents: flex }] });
}
