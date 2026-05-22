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
    getDoc,
    getDocs,
    doc
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

            // 1. 生成自定義單號 CP[YYYYMMDD][XXXX]
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            const dateStr = `${year}${month}${day}`;
            
            // 查詢當天已有的申請數量來決定流水號
            const todayStart = new Date(now.setHours(0,0,0,0));
            const todayEnd = new Date(now.setHours(23,59,59,999));
            const qCountToday = query(
                collection(db, 'coupon_requests'),
                where('createdAt', '>=', todayStart),
                where('createdAt', '<=', todayEnd)
            );
            const todaySnap = await getDocs(qCountToday);
            const sequence = (todaySnap.size + 1).toString().padStart(4, '0');
            const displayId = `CP${dateStr}${sequence}`;

            const docRef = await addDoc(collection(db, 'coupon_requests'), {
                displayId: displayId,
                userId: auth.currentUser.uid,
                userName: userData.displayName || '未命名',
                storeName: userData.storeName || '未設定門市',
                quantityRequested: quantity,
                reason: reason,
                lineUserId: userData.lineUserId || null,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            // 觸發主管 LINE 通知
            try {
                await fetch('/api/notify-supervisors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requestId: docRef.id,
                        displayId: displayId,
                        applicantName: userData.displayName || '員工',
                        quantity: quantity,
                        reason: reason,
                        apiKey: import.meta.env.VITE_INTERNAL_API_KEY
                    })
                });
            } catch (e) {
                console.error('LINE 通知發送失敗', e);
            }

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
        <div className="admin-page-content coupon-apply-page">
            {/* 彈窗：查看多張券碼 */}
            {viewCoupons && (
                <div className="modal-overlay" onClick={() => setViewCoupons(null)}>
                    <div className="modal-content card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">券號清單 ({viewCoupons.length} 張)</h3>
                            <button onClick={() => setViewCoupons(null)} className="btn-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div className="modal-list-wrap">
                            <ul className="modal-list">
                                {viewCoupons.map((code, idx) => (
                                    <li key={idx} className="modal-item">
                                        {code}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <button className="btn btn-primary btn-full modal-close-btn" onClick={() => setViewCoupons(null)}>關閉</button>
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
                <div className="edit-section-card import-card">
                    <h3 className="card-title">批量導入電子券</h3>
                    <p className="card-description">
                        請在下方輸入電子券碼，每行一筆。
                    </p>
                    <textarea
                        className="form-control import-textarea"
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
                <div className="stats-grid">
                    <div className="card stat-card">
                        <div className="stat-label">剩餘在庫數量</div>
                        <div className="stat-value">{couponCount}</div>
                    </div>
                </div>
            )}

            <div className="edit-section-card apply-form-card">
                <h3 className="card-title">申請電子券</h3>
                <form onSubmit={handleApply} className="apply-form">
                    <div className="form-group">
                        <label>申請張數</label>
                        <input
                            type="number"
                            className="form-control form-input-lg"
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
                            className="form-control form-input-lg"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="例如：檔期結束退貨補券"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-submit-lg" disabled={loading}>
                        {loading ? '送出中...' : '確認提交申請'}
                    </button>
                </form>
            </div>

            <div className="history-section">
                <div className="section-header">
                    <h3 className="section-title">申請紀錄</h3>
                </div>

                {/* 手機版：卡片式列表 */}
                <div className="mobile-only">
                    {requests.length === 0 ? (
                        <div className="card empty-record">暫無紀錄</div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="card mobile-req-card">
                                <div className="card-header-row">
                                    <span className="card-display-id">{req.displayId || req.id.substring(0, 8)}</span>
                                    <span className="card-date">{req.createdAt?.toDate().toLocaleDateString()}</span>
                                    <span className={`tag tag-${req.status} card-status`}>
                                        {req.status === 'pending' ? '待審核' : req.status === 'approved' ? '已核准' : '已退回'}
                                    </span>
                                </div>
                                <div className="card-body-row">
                                    <div className="card-info-col">
                                        <div className="card-quantity">申請張數：<strong>{req.quantityRequested} 張</strong></div>
                                        <div className="card-reason">原因：{req.reason || '未填寫'}</div>
                                        {(req.status === 'approved' || req.status === 'rejected') && (
                                            <div className="card-auditor">審核者：{req.approvedByName || req.rejectedByName || '管理員'}</div>
                                        )}
                                    </div>
                                    <div className="card-action-col">
                                        {req.status === 'approved' && req.assignedCoupons && (
                                            req.assignedCoupons.length === 1 ? (
                                                <code className="coupon-code">
                                                    {req.assignedCoupons[0]}
                                                </code>
                                            ) : (
                                                <button
                                                    className="btn btn-sm btn-outline btn-view-coupons"
                                                    onClick={() => setViewCoupons(req.assignedCoupons)}
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
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th className="col-id">單號</th>
                                    <th>日期</th>
                                    <th>張數</th>
                                    <th>原因</th>
                                    <th>狀態</th>
                                    <th>審核者</th>
                                    <th>電子券碼</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="table-empty">暫無紀錄</td>
                                    </tr>
                                ) : (
                                    requests.map(req => (
                                        <tr key={req.id}>
                                            <td className="cell-id">{req.displayId || '-'}</td>
                                            <td>{req.createdAt?.toDate().toLocaleString() || '處理中...'}</td>
                                            <td>{req.quantityRequested}</td>
                                            <td className="cell-reason" title={req.reason}>
                                                {req.reason || '-'}
                                            </td>
                                            <td>
                                                <span className={`tag tag-${req.status}`}>
                                                    {req.status === 'pending' ? '待審核' : req.status === 'approved' ? '已核准' : '已退回'}
                                                </span>
                                            </td>
                                            <td>
                                                {(req.status === 'approved' || req.status === 'rejected') ? (req.approvedByName || req.rejectedByName || '管理員') : '-'}
                                            </td>
                                            <td>
                                                {req.status === 'approved' && req.assignedCoupons && (
                                                    req.assignedCoupons.length === 1 ? (
                                                        <code className="coupon-code">
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
                .coupon-apply-page .mobile-only {
                    display: none;
                }
                .coupon-apply-page .empty-record {
                    padding: 2rem;
                    text-align: center;
                    color: #999;
                }
                .coupon-apply-page .mobile-req-card {
                    padding: 1rem;
                    margin-bottom: 0.75rem;
                }
                .coupon-apply-page .card-header-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }
                .coupon-apply-page .card-display-id {
                    font-size: 0.75rem;
                    font-weight: bold;
                    color: #111;
                }
                .coupon-apply-page .card-date {
                    font-size: 0.75rem;
                    color: #666;
                }
                .coupon-apply-page .card-status {
                    font-size: 0.7rem;
                }
                .coupon-apply-page .card-body-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .coupon-apply-page .card-info-col {
                    flex: 1;
                }
                .coupon-apply-page .card-quantity {
                    font-size: 0.85rem;
                    color: #666;
                }
                .coupon-apply-page .card-reason {
                    font-size: 0.8125rem;
                    color: #888;
                    margin-top: 0.25rem;
                }
                .coupon-apply-page .card-auditor {
                    font-size: 0.8125rem;
                    color: #888;
                    margin-top: 0.25rem;
                }
                .coupon-apply-page .card-action-col {
                    text-align: right;
                    margin-left: 0.5rem;
                }
                .coupon-apply-page .coupon-code {
                    background: #f0f0f0;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-family: monospace;
                    font-weight: bold;
                }
                .coupon-apply-page .btn-view-coupons {
                    padding: 4px 8px;
                }
                .coupon-apply-page th.col-id {
                    width: 130px;
                }
                .coupon-apply-page td.cell-id {
                    font-weight: 600;
                    color: #111;
                }
                .coupon-apply-page td.cell-reason {
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .coupon-apply-page td.table-empty {
                    text-align: center;
                    padding: 2rem;
                    color: #999;
                }

                @media (max-width: 768px) {
                    .coupon-apply-page .desktop-only { display: none !important; }
                    .coupon-apply-page .mobile-only { display: block !important; }
                    .coupon-apply-page .admin-content-header { margin-bottom: 1rem !important; }
                    .coupon-apply-page .stats-grid { margin-bottom: 1.5rem !important; }
                }
            `}} />
        </div>
    );
}

export default CouponApplyPage;
