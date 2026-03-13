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
        <div className="admin-page-content">
            <div className="admin-content-header" style={{ marginBottom: '1rem' }}>
                <h2 className="admin-content-title">電子券審核</h2>
            </div>

            <div className="tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
                <button
                    className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ border: activeTab === 'pending' ? 'none' : '1px solid #ddd' }}
                    onClick={() => setActiveTab('pending')}
                >
                    待審核 ({requests.length})
                </button>
                <button
                    className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ border: activeTab === 'history' ? 'none' : '1px solid #ddd' }}
                    onClick={() => setActiveTab('history')}
                >
                    歷史紀錄 (最近50筆)
                </button>
            </div>

            <div className="card">
                {/* 手機版：卡片式列表 */}
                <div className="mobile-only" style={{ display: 'none' }}>
                    {activeTab === 'pending' ? (
                        requests.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>目前無待審核申請</div>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="card" style={{ padding: '1rem', marginBottom: '0.75rem', border: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: '600' }}>{req.displayId || '無單號'}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#666' }}>{req.createdAt?.toDate().toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#444', marginBottom: '0.25rem' }}>申請人：{req.userName}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#444', marginBottom: '0.25rem' }}>門市：{req.storeName}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#444', marginBottom: '0.5rem' }}>張數：<strong>{req.quantityRequested}</strong></div>
                                    <div style={{
                                        background: '#f8f9fa',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.8125rem',
                                        color: '#555',
                                        marginBottom: '1rem'
                                    }}>
                                        原因：{req.reason || '未填寫'}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1, height: '40px' }}
                                            onClick={() => handleApprove(req)}
                                            disabled={loading}
                                        >
                                            核准
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            style={{ flex: 1, height: '40px', color: '#DC2626', borderColor: '#DC2626' }}
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
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>目前無歷史紀錄</div>
                        ) : (
                            history.map(req => (
                                <div key={req.id} className="card" style={{ padding: '1rem', marginBottom: '0.75rem', border: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span style={{ fontWeight: '600' }}>{req.displayId || '無單號'}</span>
                                        <span className={`tag tag-${req.status}`} style={{ fontSize: '0.7rem' }}>
                                            {req.status === 'approved' ? '已核准' : '已退回'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#444', marginBottom: '0.25rem' }}>申請人：{req.userName}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#444', marginBottom: '0.25rem' }}>門市：{req.storeName}</div>
                                    <div style={{ fontSize: '0.875rem', color: '#444', marginBottom: '0.5rem' }}>張數：<strong>{req.quantityRequested}</strong></div>
                                    <div style={{ fontSize: '0.875rem', color: '#444', marginBottom: '0.25rem' }}>審核者：{req.approvedByName || req.rejectedByName || '管理員'}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>時間：{req.createdAt?.toDate().toLocaleString()}</div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* 電腦版：表格列表 */}
                <div className="desktop-only table-responsive">
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
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>目前無待審核申請</td>
                                    </tr>
                                ) : (
                                    requests.map(req => (
                                        <tr key={req.id}>
                                            <td style={{ fontWeight: '600' }}>{req.displayId || '-'}</td>
                                            <td>{req.userName}</td>
                                            <td>{req.storeName}</td>
                                            <td><strong>{req.quantityRequested}</strong></td>
                                            <td style={{ maxWidth: '200px', fontSize: '0.875rem' }}>{req.reason || '-'}</td>
                                            <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                            <td>待審核</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleApprove(req)}
                                                        disabled={loading}
                                                    >
                                                        核准
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline"
                                                        style={{ color: '#DC2626', borderColor: '#DC2626' }}
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
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>目前無歷史紀錄</td>
                                    </tr>
                                ) : (
                                    history.map(req => (
                                        <tr key={req.id}>
                                            <td style={{ fontWeight: '600' }}>{req.displayId || '-'}</td>
                                            <td>{req.userName}</td>
                                            <td>{req.storeName}</td>
                                            <td><strong>{req.quantityRequested}</strong></td>
                                            <td style={{ maxWidth: '200px', fontSize: '0.875rem' }}>{req.reason || '-'}</td>
                                            <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span className={`tag tag-${req.status}`} style={{ alignSelf: 'flex-start' }}>
                                                        {req.status === 'approved' ? '已核准' : '已退回'}
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem' }}>{req.approvedByName || req.rejectedByName || '管理員'}</span>
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
                @media (max-width: 768px) {
                    .desktop-only { display: none !important; }
                    .mobile-only { display: block !important; }
                }
            `}} />
        </div>
    );
}

export default CouponAuditPage;
