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
    getDoc,
    limit
} from 'firebase/firestore';

function MemberAuditPage() {
    const [requests, setRequests] = useState([]);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'history'
    const [loading, setLoading] = useState(false);
    const [adminNote, setAdminNote] = useState({});

    useEffect(() => {
        // 監聽所有待審核的會員資料異動
        const qPending = query(
            collection(db, 'member_actions'),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );
        const unsubPending = onSnapshot(qPending, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 監聽歷史紀錄 (最近50筆)
        const qHistory = query(
            collection(db, 'member_actions'),
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

    const handleAction = async (id, status, req) => {
        setLoading(true);
        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const reviewerName = userDoc.exists() ? userDoc.data().displayName : '管理員';

            await updateDoc(doc(db, 'member_actions', id), {
                status: status,
                reviewedBy: auth.currentUser.uid,
                reviewedByName: reviewerName,
                reviewedAt: serverTimestamp(),
                adminNote: adminNote[id] || ''
            });
            alert(status === 'approved' ? '已核准' : '已駁回');

            // 發送 LINE 通知
            if (req?.submittedByLineId) {
                try {
                    await fetch('/api/line-webhook', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'notify_member_action',
                            to: req.submittedByLineId,
                            status: status,
                            typeName: getTypeName(req.type),
                            reviewerName: reviewerName,
                            memberId: req.memberId,
                            detail: req.detail,
                            note: adminNote[id] || '',
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

    const handleNoteChange = (id, val) => {
        setAdminNote(prev => ({ ...prev, [id]: val }));
    };

    const getTypeName = (type) => {
        const types = {
            'points': '補登點數',
            'edit_phone': '手機修改',
            'edit_birthday': '生日修改',
            'delete_member': '刪除會員'
        };
        return types[type] || type;
    };

    return (
        <div className="admin-page-content member-audit-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">會員異動審核</h2>
            </div>
            
            <div className="admin-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                    onClick={() => setActiveTab('pending')}
                >
                    待審核 ({requests.length})
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    歷史紀錄 (最近50筆)
                </button>
            </div>

            <div className="audit-container">
                {/* 手機版：卡片式列表 */}
                <div className="mobile-only">
                    {activeTab === 'pending' ? (
                        requests.length === 0 ? (
                            <div className="card list-empty">目前無待審核異動</div>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="card audit-card card-pending">
                                    <div className="card-top-row">
                                        <div className="submitter-name">{req.submittedByName}</div>
                                        <div className="submit-date">{req.createdAt?.toDate().toLocaleDateString()}</div>
                                    </div>
                                    <div className="type-row">
                                        <span className="type-label">類型：</span>
                                        <span className="tag tag-pending">{getTypeName(req.type)}</span>
                                    </div>
                                    <div className="member-id-row">
                                        <strong>{req.memberId}</strong>
                                    </div>
                                    <div className="detail-box">
                                        {req.detail}
                                    </div>
                                    <div className="note-input-row">
                                        <input 
                                            type="text" 
                                            placeholder="審核備註..."
                                            className="form-control"
                                            value={adminNote[req.id] || ''}
                                            onChange={(e) => handleNoteChange(req.id, e.target.value)}
                                        />
                                    </div>
                                    <div className="actions-row">
                                        <button 
                                            className="btn btn-primary btn-action"
                                            onClick={() => handleAction(req.id, 'approved', req)}
                                            disabled={loading}
                                        >
                                            核准
                                        </button>
                                        <button 
                                            className="btn btn-outline btn-reject btn-action"
                                            onClick={() => handleAction(req.id, 'rejected', req)}
                                            disabled={loading}
                                        >
                                            駁回
                                        </button>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        history.length === 0 ? (
                            <div className="card list-empty">目前無歷史紀錄</div>
                        ) : (
                            history.map(req => (
                                <div key={req.id} className={`card audit-card ${req.status === 'approved' ? 'card-approved' : 'card-rejected'}`}>
                                    <div className="card-top-row">
                                        <div className="submitter-name">{req.submittedByName}</div>
                                        <span className={`tag tag-${req.status}`}>
                                            {req.status === 'approved' ? '已核准' : '已駁回'}
                                        </span>
                                    </div>
                                    <div className="type-row">
                                        <span className="type-label">類型：</span>
                                        <strong>{getTypeName(req.type)}</strong>
                                    </div>
                                    <div className="member-id-row">
                                        <strong>{req.memberId}</strong>
                                    </div>
                                    <div className="detail-box">
                                        {req.detail}
                                    </div>
                                    <div className="reviewer-info">審核者：{req.reviewedByName || '管理員'}</div>
                                    <div className="review-time">時間：{req.createdAt?.toDate().toLocaleString()}</div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* 電腦版：表格列表 */}
                <div className="desktop-only card">
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>申請人</th>
                                    <th>類型</th>
                                    <th>會員ID</th>
                                    <th>詳細內容</th>
                                    <th>申請時間</th>
                                    {activeTab === 'pending' ? (
                                        <>
                                            <th>審核備註</th>
                                            <th>操作</th>
                                        </>
                                    ) : (
                                        <>
                                            <th>狀態 / 審核者</th>
                                            <th>備註</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {activeTab === 'pending' ? (
                                    requests.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="table-empty">目前無待審核異動</td>
                                        </tr>
                                    ) : (
                                        requests.map(req => (
                                            <tr key={req.id}>
                                                <td>
                                                    <div className="cell-submitter">{req.submittedByName}</div>
                                                    <div className="cell-store">{req.submittedByStore}</div>
                                                </td>
                                                <td>{getTypeName(req.type)}</td>
                                                <td>{req.memberId}</td>
                                                <td>{req.detail}</td>
                                                <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                                <td>
                                                    <input 
                                                        type="text" 
                                                        placeholder="輸入紀錄或原因"
                                                        className="form-control input-note"
                                                        value={adminNote[req.id] || ''}
                                                        onChange={(e) => handleNoteChange(req.id, e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="cell-actions">
                                                        <button 
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => handleAction(req.id, 'approved', req)}
                                                            disabled={loading}
                                                        >
                                                            核准
                                                        </button>
                                                        <button 
                                                            className="btn btn-sm btn-outline btn-reject"
                                                            onClick={() => handleAction(req.id, 'rejected', req)}
                                                            disabled={loading}
                                                        >
                                                            駁回
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )
                                ) : (
                                    history.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="table-empty">目前無歷史紀錄</td>
                                        </tr>
                                    ) : (
                                        history.map(req => (
                                            <tr key={req.id}>
                                                <td>
                                                    <div className="cell-submitter">{req.submittedByName}</div>
                                                    <div className="cell-store">{req.submittedByStore}</div>
                                                </td>
                                                <td>{getTypeName(req.type)}</td>
                                                <td>{req.memberId}</td>
                                                <td>{req.detail}</td>
                                                <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                                <td>
                                                    <div className="cell-reviewer">
                                                        <span className={`tag tag-${req.status}`}>
                                                            {req.status === 'approved' ? '已核准' : '已駁回'}
                                                        </span>
                                                        <span className="reviewer-name">{req.reviewedByName || '管理員'}</span>
                                                    </div>
                                                </td>
                                                <td>{req.adminNote || '-'}</td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .member-audit-page .admin-tabs {
                    margin-bottom: 1.5rem;
                    display: flex;
                    gap: 0.5rem;
                    border-bottom: 1px solid #ddd;
                }
                .member-audit-page .admin-tabs .tab-btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    color: #666;
                    font-weight: normal;
                    transition: all 0.2s;
                }
                .member-audit-page .admin-tabs .tab-btn.active {
                    border-bottom: 3px solid #007130;
                    color: #007130;
                    font-weight: bold;
                }
                .member-audit-page .mobile-only {
                    display: none;
                }
                .member-audit-page .desktop-only {
                    display: block;
                }
                .member-audit-page .list-empty {
                    padding: 2rem;
                    text-align: center;
                    color: #999;
                }
                .member-audit-page .audit-card {
                    padding: 1.25rem;
                    margin-bottom: 1rem;
                }
                .member-audit-page .card-pending {
                    border-left: 4px solid #007130;
                }
                .member-audit-page .card-approved {
                    border-left: 4px solid #007130;
                }
                .member-audit-page .card-rejected {
                    border-left: 4px solid #800019;
                }
                .member-audit-page .card-top-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.75rem;
                }
                .member-audit-page .submitter-name {
                    font-weight: 600;
                }
                .member-audit-page .submit-date {
                    font-size: 0.75rem;
                    color: #666;
                }
                .member-audit-page .type-row {
                    font-size: 0.8125rem;
                    margin-bottom: 0.5rem;
                }
                .member-audit-page .type-label {
                    color: #666;
                }
                .member-audit-page .member-id-row {
                    font-size: 0.9375rem;
                    margin-bottom: 0.5rem;
                }
                .member-audit-page .detail-box {
                    font-size: 0.875rem;
                    background: #f8f9fa;
                    padding: 0.75rem;
                    border-radius: 4px;
                    margin-bottom: 1rem;
                }
                .member-audit-page .note-input-row {
                    margin-bottom: 1rem;
                }
                .member-audit-page .note-input-row .form-control {
                    font-size: 0.875rem;
                    width: 100%;
                }
                .member-audit-page .actions-row {
                    display: flex;
                    gap: 0.75rem;
                }
                .member-audit-page .btn-action {
                    flex: 1;
                }
                .member-audit-page .btn-reject {
                    color: #800019;
                    border-color: #800019;
                }
                .member-audit-page .reviewer-info {
                    font-size: 0.8125rem;
                    color: #444;
                    margin-bottom: 0.25rem;
                }
                .member-audit-page .review-time {
                    font-size: 0.75rem;
                    color: #666;
                }
                .member-audit-page .tag-pending {
                    background: #e6f4ec;
                    color: #007130;
                }
                .member-audit-page .table-empty {
                    text-align: center;
                    padding: 2rem;
                    color: #999;
                }
                .member-audit-page .cell-submitter {
                    font-weight: 500;
                }
                .member-audit-page .cell-store {
                    font-size: 0.75rem;
                    color: #666;
                }
                .member-audit-page .input-note {
                    font-size: 0.875rem;
                }
                .member-audit-page .cell-actions {
                    display: flex;
                    gap: 0.5rem;
                }
                .member-audit-page .cell-reviewer {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .member-audit-page .cell-reviewer .reviewer-name {
                    font-size: 0.85rem;
                }
                .member-audit-page .cell-reviewer .tag {
                    align-self: flex-start;
                }

                @media (max-width: 768px) {
                    .member-audit-page .desktop-only { display: none !important; }
                    .member-audit-page .mobile-only { display: block !important; }
                }
            `}} />
        </div>
    );
}

export default MemberAuditPage;
