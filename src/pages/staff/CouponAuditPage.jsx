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
        const q = query(
            collection(db, 'coupon_requests'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsub();
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
                alert(`庫存不足！現有 ${couponSnap.size} 張，需求 ${req.quantityRequested} 張。`);
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

            // 2. 更新申請單狀態
            batch.update(doc(db, 'coupon_requests', req.id), {
                status: 'approved',
                assignedCoupons: assignedCodes,
                approvedBy: auth.currentUser.uid,
                approvedAt: serverTimestamp()
            });

            await batch.commit();
            alert('核准成功');
        } catch (err) {
            console.error(err);
            alert('操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (id) => {
        if (!confirm('確定要退回此申請？')) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'coupon_requests', id), {
                status: 'rejected',
                rejectedBy: auth.currentUser.uid,
                rejectedAt: serverTimestamp()
            });
            alert('已退回');
        } catch (err) {
            console.error(err);
            alert('操作失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">電子券審核</h2>
            </div>

            <div className="card">
                {/* 手機版：卡片式列表 */}
                <div className="mobile-only" style={{ display: 'none' }}>
                    {requests.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>目前無待審核申請</div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="card" style={{ padding: '1rem', marginBottom: '0.75rem', border: '1px solid #eee' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: '600' }}>{req.userName}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#666' }}>{req.createdAt?.toDate().toLocaleDateString()}</span>
                                </div>
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
                                        onClick={() => handleReject(req.id)}
                                        disabled={loading}
                                    >
                                        退回
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 電腦版：表格列表 */}
                <div className="desktop-only table-responsive">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>申請人</th>
                                <th>門市</th>
                                <th>張數</th>
                                <th>申請原因</th>
                                <th>時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>目前無待審核申請</td>
                                </tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req.id}>
                                        <td>{req.userName}</td>
                                        <td>{req.storeName}</td>
                                        <td><strong>{req.quantityRequested}</strong></td>
                                        <td style={{ maxWidth: '200px', fontSize: '0.875rem' }}>{req.reason || '-'}</td>
                                        <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
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
                                                    onClick={() => handleReject(req.id)}
                                                    disabled={loading}
                                                >
                                                    退回
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @media (max-width: 768px) {
                    .desktop-only { display: none !important; }
                    .mobile-only { display: block !important; }
                }
            `}} />
        </div>
    );
}

export default CouponAuditPage;
