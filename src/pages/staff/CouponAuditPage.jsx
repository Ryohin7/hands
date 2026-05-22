import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import {
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    serverTimestamp,
    doc,
    updateDoc,
    writeBatch,
    limit,
    getDoc,
    getDocs
} from 'firebase/firestore';

function CouponAuditPage() {
    const [requests, setRequests] = useState([]);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            if (auth.currentUser) {
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists()) setProfile(userDoc.data());
            }
        };
        fetchProfile();

        // 即時監聽待審核申請
        const qPending = query(
            collection(db, 'coupon_requests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        const unsubPending = onSnapshot(qPending, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 監聽歷史紀錄 (最近50筆)
        const qHistory = query(
            collection(db, 'coupon_requests'),
            where('status', '!=', 'pending'),
            orderBy('status'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const unsubHistory = onSnapshot(qHistory, (snapshot) => {
            setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubPending();
            unsubHistory();
        };
    }, []);


    const handleApprove = async (req) => {
        setLoading(true);
        try {
            // 1. 抓取足夠的未使用電子券
            const couponsQuery = query(
                collection(db, 'coupons'),
                where('isUsed', '==', false),
                limit(req.quantityRequested)
            );
            const couponSnap = await getDocs(couponsQuery);

            if (couponSnap.size < req.quantityRequested) {
                alert(`庫存不足！請向企劃補充庫存，現有 ${couponSnap.size} 張，需求 ${req.quantityRequested} 張。`);
                return;
            }

            const batch = writeBatch(db);
            const assignedCodes = [];

            couponSnap.docs.forEach(cDoc => {
                assignedCodes.push(cDoc.data().code);
                batch.update(cDoc.ref, {
                    isUsed: true,
                    requestId: req.id,
                    usedAt: serverTimestamp()
                });
            });

            batch.update(doc(db, 'coupon_requests', req.id), {
                status: 'approved',
                assignedCoupons: assignedCodes,
                approvedBy: auth.currentUser.uid,
                approvedByName: profile?.displayName || '管理員',
                approvedAt: serverTimestamp()
            });

            await batch.commit();
            alert('核准成功');

            // 發送 LINE 通知
            if (req.lineUserId) {
                const couponListText = assignedCodes.join('\n');
                try {
                    await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: req.lineUserId,
                            messages: [{
                                type: 'flex',
                                altText: '申請核准通知',
                                contents: {
                                    type: 'bubble',
                                    header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: '✅ 電子券申請已核准', color: '#ffffff', weight: 'bold' }], backgroundColor: '#007130' },
                                    body: {
                                        type: 'box', layout: 'vertical', contents: [
                                            { type: 'text', text: `您的申請（單號：${req.displayId || req.id}）已由 ${profile?.displayName || '主管'} 核准！`, wrap: true, size: 'sm' },
                                            { type: 'text', text: '【核發券號如下】：', weight: 'bold', size: 'sm', margin: 'md' },
                                            { type: 'text', text: couponListText, wrap: true, size: 'sm', color: '#007130' }
                                        ]
                                    }
                                }
                            }],
                            apiKey: import.meta.env.VITE_INTERNAL_API_KEY
                        })
                    });
                } catch (e) {
                    console.error('LINE 通知發送失敗', e);
                }
            }
        } catch (err) {
            console.error(err);
            alert('操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (id, req) => {
        if (!confirm('確定要退回此申請？')) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'coupon_requests', id), {
                status: 'rejected',
                rejectedBy: auth.currentUser.uid,
                rejectedByName: profile?.displayName || '管理員',
                rejectedAt: serverTimestamp()
            });
            alert('已退回');

            // 發送 LINE 通知
            if (req?.lineUserId) {
                try {
                    await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: req.lineUserId,
                            text: `您的電子券申請（單號：${req?.displayId || id}）已被 ${profile?.displayName || '主管'} 退回。`,
                            apiKey: import.meta.env.VITE_INTERNAL_API_KEY
                        })
                    });
                } catch (e) {
                    console.error('LINE 通知發送失敗', e);
                }
            }
        } catch (err) {
            console.error(err);
            alert('操作失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page-content coupon-audit-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">電子券審核</h2>
            </div>

            <div className="tabs">
                <button
                    className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline tab-btn-outline'}`}
                    onClick={() => setActiveTab('pending')}
                >
                    待審核 ({requests.length})
                </button>
                <button
                    className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline tab-btn-outline'}`}
                    onClick={() => setActiveTab('history')}
                >
                    歷史紀錄 (最近50筆)
                </button>
            </div>

            <div className="card">
                {/* 手機版：卡片式列表 */}
                <div className="mobile-only">
                    {activeTab === 'pending' ? (
                        requests.length === 0 ? (
                            <div className="empty-text">目前無待審核申請</div>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="card mobile-card">
                                    <div className="card-header">
                                        <span className="card-title-text">{req.displayId || '無單號'}</span>
                                        <span className="card-date">{req.createdAt?.toDate().toLocaleDateString()}</span>
                                    </div>
                                    <div className="card-meta">申請人：{req.userName}</div>
                                    <div className="card-meta">門市：{req.storeName}</div>
                                    <div className="card-meta">張數：<strong>{req.quantityRequested}</strong></div>
                                    <div className="card-reason">
                                        原因：{req.reason || '未填寫'}
                                    </div>
                                    <div className="card-actions">
                                        <button
                                            className="btn btn-primary btn-action-primary"
                                            onClick={() => handleApprove(req)}
                                            disabled={loading}
                                        >
                                            核准
                                        </button>
                                        <button
                                            className="btn btn-outline btn-action-reject"
                                            onClick={() => handleReject(req.id, req)}
                                            disabled={loading}
                                        >
                                            退回
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        history.length === 0 ? (
                            <div className="empty-text">目前無歷史紀錄</div>
                        ) : (
                            history.map(req => (
                                <div key={req.id} className="card mobile-card">
                                    <div className="card-header">
                                        <span className="card-title-text">{req.displayId || '無單號'}</span>
                                        <span className={`tag tag-${req.status} card-status`}>
                                            {req.status === 'approved' ? '已核准' : '已退回'}
                                        </span>
                                    </div>
                                    <div className="card-meta">申請人：{req.userName}</div>
                                    <div className="card-meta">門市：{req.storeName}</div>
                                    <div className="card-meta">張數：<strong>{req.quantityRequested}</strong></div>
                                    <div className="card-meta">審核者：{req.approvedByName || req.rejectedByName || '管理員'}</div>
                                    <div className="card-date card-time-bottom">時間：{req.createdAt?.toDate().toLocaleString()}</div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* 電腦版：表格列表 */}
                <div className="desktop-only admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>單號</th>
                                <th>申請人</th>
                                <th>門市</th>
                                <th>張數</th>
                                <th>申請原因</th>
                                <th>時間</th>
                                <th>狀態 / 審核者</th>
                                {activeTab === 'pending' && <th>操作</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {activeTab === 'pending' ? (
                                requests.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="empty-text">目前無待審核申請</td>
                                    </tr>
                                ) : (
                                    requests.map(req => (
                                        <tr key={req.id}>
                                            <td className="cell-bold">{req.displayId || '-'}</td>
                                            <td>{req.userName}</td>
                                            <td>{req.storeName}</td>
                                            <td><strong>{req.quantityRequested}</strong></td>
                                            <td className="cell-reason">{req.reason || '-'}</td>
                                            <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                            <td>待審核</td>
                                            <td>
                                                <div className="card-actions-row">
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleApprove(req)}
                                                        disabled={loading}
                                                    >
                                                        核准
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline cell-reject"
                                                        onClick={() => handleReject(req.id, req)}
                                                        disabled={loading}
                                                    >
                                                        退回
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                history.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="empty-text">目前無歷史紀錄</td>
                                    </tr>
                                ) : (
                                    history.map(req => (
                                        <tr key={req.id}>
                                            <td className="cell-bold">{req.displayId || '-'}</td>
                                            <td>{req.userName}</td>
                                            <td>{req.storeName}</td>
                                            <td><strong>{req.quantityRequested}</strong></td>
                                            <td className="cell-reason">{req.reason || '-'}</td>
                                            <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                            <td>
                                                <div className="cell-status-wrap">
                                                    <span className={`tag tag-${req.status} cell-status-tag`}>
                                                        {req.status === 'approved' ? '已核准' : '已退回'}
                                                    </span>
                                                    <span className="cell-auditor">{req.approvedByName || req.rejectedByName || '管理員'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .coupon-audit-page .admin-content-header {
                    margin-bottom: 1rem;
                }
                .coupon-audit-page .tabs {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 0.5rem;
                }
                .coupon-audit-page .tab-btn-outline {
                    border: 1px solid #ddd;
                }
                .coupon-audit-page .mobile-only {
                    display: none;
                }
                .coupon-audit-page .empty-text {
                    padding: 3rem;
                    text-align: center;
                    color: #999;
                }
                .coupon-audit-page .mobile-card {
                    padding: 1rem;
                    margin-bottom: 0.75rem;
                    border: 1px solid #eee;
                }
                .coupon-audit-page .card-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }
                .coupon-audit-page .card-title-text {
                    fontWeight: 600;
                }
                .coupon-audit-page .card-date {
                    font-size: 0.75rem;
                    color: #666;
                }
                .coupon-audit-page .card-meta {
                    font-size: 0.875rem;
                    color: #444;
                    margin-bottom: 0.25rem;
                }
                .coupon-audit-page .card-reason {
                    background: #f8f9fa;
                    padding: 0.75rem;
                    border-radius: 6px;
                    font-size: 0.8125rem;
                    color: #555;
                    margin-bottom: 1rem;
                }
                .coupon-audit-page .card-actions {
                    display: flex;
                    gap: 0.75rem;
                }
                .coupon-audit-page .btn-action-primary {
                    flex: 1;
                    height: 40px;
                }
                .coupon-audit-page .btn-action-reject {
                    flex: 1;
                    height: 40px;
                    color: #800019;
                    borderColor: #800019;
                }
                .coupon-audit-page .card-status {
                    font-size: 0.7rem;
                }
                .coupon-audit-page .card-time-bottom {
                    margin-top: 0.5rem;
                }
                .coupon-audit-page .cell-bold {
                    font-weight: 600;
                }
                .coupon-audit-page .cell-reason {
                    max-width: 200px;
                    font-size: 0.875rem;
                }
                .coupon-audit-page .cell-reject {
                    color: #800019;
                    border-color: #800019;
                }
                .coupon-audit-page .card-actions-row {
                    display: flex;
                    gap: 0.5rem;
                }
                .coupon-audit-page .cell-status-wrap {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .coupon-audit-page .cell-status-tag {
                    align-self: flex-start;
                }
                .coupon-audit-page .cell-auditor {
                    font-size: 0.85rem;
                }

                @media (max-width: 768px) {
                    .coupon-audit-page .desktop-only { display: none !important; }
                    .coupon-audit-page .mobile-only { display: block !important; }
                }
            `}} />
        </div>
    );
}

export default CouponAuditPage;
