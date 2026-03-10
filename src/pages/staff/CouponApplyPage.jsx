import { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    serverTimestamp,
    limit,
    writeBatch,
    doc,
    getDoc
} from 'firebase/firestore';

function CouponApplyPage() {
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState(''); // 申請原因
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [hasAuditPermission, setHasAuditPermission] = useState(false); // 審核權限
    const [importText, setImportText] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [couponCount, setCouponCount] = useState(0);
    const [viewCoupons, setViewCoupons] = useState(null);

    useEffect(() => {
        const checkRole = async () => {
            if (auth.currentUser) {
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.role === 'admin') {
                        setIsAdmin(true);
                        setHasAuditPermission(true);
                    } else if (userData.permissions && userData.permissions.includes('coupon_audit')) {
                        setHasAuditPermission(true);
                    }
                }
            }
        };
        checkRole();

        // 即時監聽申請紀錄
        let unsubRequests = () => { };
        if (auth.currentUser) {
            const qReq = query(
                collection(db, 'coupon_requests'),
                where('userId', '==', auth.currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            unsubRequests = onSnapshot(qReq, (snapshot) => {
                setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
        }

        // 即時監聽庫存數量
        const qCount = query(collection(db, 'coupons'), where('isUsed', '==', false));
        const unsubCount = onSnapshot(qCount, (snapshot) => {
            setCouponCount(snapshot.size);
        });

        return () => {
            unsubRequests();
            unsubCount();
        };
    }, []);

    const handleApply = async (e) => {
        e.preventDefault();
        if (quantity <= 0) return;
        setLoading(true);
        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userData = userDoc.data();

            await addDoc(collection(db, 'coupon_requests'), {
                userId: auth.currentUser.uid,
                userName: userData.displayName || '未命名',
                storeName: userData.storeName || '未設定門市',
                quantityRequested: quantity,
                reason: reason, // 紀錄原因
                status: 'pending',
                createdAt: serverTimestamp()
            });
            alert('申請已送出，等待主管審核');
            setQuantity(1);
            setReason('');
        } catch (err) {
            console.error(err);
            alert('申請失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        const lines = importText.split('\n').map(l => l.trim()).filter(l => l !== '');
        if (lines.length === 0) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            lines.forEach(code => {
                const newDocRef = doc(collection(db, 'coupons'));
                batch.set(newDocRef, {
                    code,
                    isUsed: false,
                    createdAt: serverTimestamp()
                });
            });
            await batch.commit();
            alert(`成功導入 ${lines.length} 筆電子券`);
            setImportText('');
            setShowImport(false);
        } catch (err) {
            console.error(err);
            alert('導入失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page-content">
            {/* 彈窗：查看多張券碼 */}
            {viewCoupons && (
                <div className="modal-overlay" onClick={() => setViewCoupons(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', borderRadius: '12px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>券號清單 ({viewCoupons.length} 張)</h3>
                            <button onClick={() => setViewCoupons(null)} className="btn-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div style={{ maxHeight: '400px', overflowY: 'auto', background: '#f8f9fa', padding: '1rem', borderRadius: '8px', border: '1px solid #eee' }}>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {viewCoupons.map((code, idx) => (
                                    <li key={idx} style={{ padding: '0.75rem 0', borderBottom: idx === viewCoupons.length - 1 ? 'none' : '1px solid #efefef', fontFamily: 'monospace', fontSize: '1.1rem', textAlign: 'center', color: '#1a1a1a' }}>
                                        {code}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button className="btn btn-primary btn-full" style={{ marginTop: '1.5rem' }} onClick={() => setViewCoupons(null)}>關閉</button>
                    </div>
                </div>
            )}

            <div className="admin-content-header">
                <h2 className="admin-content-title">電子券申請</h2>
                {isAdmin && (
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowImport(!showImport)}
                    >
                        {showImport ? '取消導入' : '電子券入庫'}
                    </button>
                )}
            </div>

            {isAdmin && showImport && (
                <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>批量導入電子券</h3>
                    <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                        請在下方輸入電子券碼，每行一筆。
                    </p>
                    <textarea
                        className="form-control"
                        style={{ width: '100%', height: '200px', marginBottom: '1rem', padding: '10px', border: '1px solid #ddd' }}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="請輸入券碼..."
                    />
                    <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={loading || !importText.trim()}
                    >
                        {loading ? '處理中...' : '確認導入'}
                    </button>
                </div>
            )}

            {hasAuditPermission && (
                <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>剩餘在庫數量</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>{couponCount}</div>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>申請電子券</h3>
                <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label>申請張數</label>
                        <input
                            type="number"
                            className="form-control"
                            style={{ height: '45px', fontSize: '1rem' }}
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value))}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>申請原因 (必要)</label>
                        <input
                            type="text"
                            className="form-control"
                            style={{ height: '45px', fontSize: '1rem' }}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="例如：門市活動發放、補償會員等"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '45px' }}>
                        {loading ? '送出中...' : '確認提交申請'}
                    </button>
                </form>
            </div>

            <div className="history-section">
                <div style={{ padding: '0 0.5rem 1rem' }}>
                    <h3 style={{ fontSize: '1.1rem' }}>申請紀錄</h3>
                </div>

                {/* 手機版：卡片式列表 */}
                <div className="mobile-only" style={{ display: 'none' }}>
                    {requests.length === 0 ? (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>暫無紀錄</div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#666' }}>{req.createdAt?.toDate().toLocaleDateString()}</span>
                                    <span className={`tag tag-${req.status}`} style={{ fontSize: '0.7rem' }}>
                                        {req.status === 'pending' ? '待審核' : req.status === 'approved' ? '已核准' : '已退回'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.85rem', color: '#666' }}>申請張數：<strong>{req.quantityRequested} 張</strong></div>
                                        <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: '0.25rem' }}>原因：{req.reason || '未填寫'}</div>
                                    </div>
                                    <div style={{ textAlign: 'right', marginLeft: '0.5rem' }}>
                                        {req.status === 'approved' && req.assignedCoupons && (
                                            req.assignedCoupons.length === 1 ? (
                                                <code style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                    {req.assignedCoupons[0]}
                                                </code>
                                            ) : (
                                                <button
                                                    className="btn btn-sm btn-outline"
                                                    onClick={() => setViewCoupons(req.assignedCoupons)}
                                                    style={{ padding: '4px 8px' }}
                                                >
                                                    查看券碼 ({req.assignedCoupons.length}張)
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 電腦版：表格列表 */}
                <div className="desktop-only card">
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>日期</th>
                                    <th>張數</th>
                                    <th>原因</th>
                                    <th>狀態</th>
                                    <th>電子券碼</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>暫無紀錄</td>
                                    </tr>
                                ) : (
                                    requests.map(req => (
                                        <tr key={req.id}>
                                            <td>{req.createdAt?.toDate().toLocaleString() || '處理中...'}</td>
                                            <td>{req.quantityRequested}</td>
                                            <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={req.reason}>
                                                {req.reason || '-'}
                                            </td>
                                            <td>
                                                <span className={`tag tag-${req.status}`}>
                                                    {req.status === 'pending' ? '待審核' : req.status === 'approved' ? '已核准' : '已退回'}
                                                </span>
                                            </td>
                                            <td>
                                                {req.status === 'approved' && req.assignedCoupons && (
                                                    req.assignedCoupons.length === 1 ? (
                                                        <code style={{ background: '#f0f0f0', padding: '4px 8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                            {req.assignedCoupons[0]}
                                                        </code>
                                                    ) : (
                                                        <button
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => setViewCoupons(req.assignedCoupons)}
                                                        >
                                                            查看券碼 ({req.assignedCoupons.length}張)
                                                        </button>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @media (max-width: 768px) {
                    .desktop-only { display: none !important; }
                    .mobile-only { display: block !important; }
                    .admin-content-header { margin-bottom: 1rem !important; }
                    .stats-grid { margin-bottom: 1.5rem !important; }
                }
            `}} />
        </div>
    );
}

export default CouponApplyPage;
