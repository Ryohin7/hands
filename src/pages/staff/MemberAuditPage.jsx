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
                    await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: req.submittedByLineId,
                            text: `您的會員資料異動申請（類型：${getTypeName(req.type)}）已由 ${reviewerName} ${status === 'approved' ? '核准' : '駁回'}。${adminNote[id] ? `\n備註：${adminNote[id]}` : ''}`,
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
        <div className="admin-page-content" style={{ padding: '1rem' }}>
            <div className="admin-content-header" style={{ marginBottom: '1rem' }}>
                <h2 className="admin-content-title" style={{ fontSize: '1.5rem' }}>會員異動審核</h2>
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

            <div className="audit-container">
                {/* 手機版：卡片式列表 */}
                <div className="mobile-only" style={{ display: 'none' }}>
                    {activeTab === 'pending' ? (
                        requests.length === 0 ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>目前無待審核異動</div>
                        ) : (
                            requests.map(req => (
                                <div key={req.id} className="card" style={{ padding: '1.25rem', marginBottom: '1rem', borderLeft: '4px solid #007130' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <div style={{ fontWeight: '600' }}>{req.submittedByName}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{req.createdAt?.toDate().toLocaleDateString()}</div>
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#666' }}>類型：</span>
                                        <span className="tag tag-pending" style={{ background: '#e6f4ec', color: '#007130' }}>{getTypeName(req.type)}</span>
                                    </div>
                                    <div style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                                        <strong>{req.memberId}</strong>
                                    </div>
                                    <div style={{ fontSize: '0.875rem', background: '#f8f9fa', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem' }}>
                                        {req.detail}
                                    </div>
                                    <div style={{ marginBottom: '1rem' }}>
                                        <input 
                                            type="text" 
                                            placeholder="審核備註..."
                                            className="form-control"
                                            style={{ fontSize: '0.875rem', width: '100%' }}
                                            value={adminNote[req.id] || ''}
                                            onChange={(e) => handleNoteChange(req.id, e.target.value)}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button 
                                            className="btn btn-primary"
                                            style={{ flex: 1 }}
                                            onClick={() => handleAction(req.id, 'approved')}
                                            disabled={loading}
                                        >
                                            核准
                                        </button>
                                        <button 
                                            className="btn btn-outline"
                                            style={{ flex: 1, color: '#DC2626', borderColor: '#DC2626' }}
                                            onClick={() => handleAction(req.id, 'rejected')}
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
                            <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>目前無歷史紀錄</div>
                        ) : (
                            history.map(req => (
                                <div key={req.id} className="card" style={{ padding: '1.25rem', marginBottom: '1rem', borderLeft: req.status === 'approved' ? '4px solid #007130' : '4px solid #DC2626' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                        <div style={{ fontWeight: '600' }}>{req.submittedByName}</div>
                                        <span className={`tag tag-${req.status}`} style={{ fontSize: '0.7rem' }}>
                                            {req.status === 'approved' ? '已核准' : '已駁回'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                                        <span style={{ color: '#666' }}>類型：</span>
                                        <strong>{getTypeName(req.type)}</strong>
                                    </div>
                                    <div style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                                        <strong>{req.memberId}</strong>
                                    </div>
                                    <div style={{ fontSize: '0.875rem', background: '#f8f9fa', padding: '0.75rem', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                        {req.detail}
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#444', marginBottom: '0.25rem' }}>審核者：{req.reviewedByName || '管理員'}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>時間：{req.createdAt?.toDate().toLocaleString()}</div>
                                </div>
                            ))
                        )
                    )}
                </div>

                {/* 電腦版：表格列表 */}
                <div className="desktop-only card">
                    <div className="table-responsive">
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
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>目前無待審核異動</td>
                                        </tr>
                                    ) : (
                                        requests.map(req => (
                                            <tr key={req.id}>
                                                <td>
                                                    <div style={{ fontWeight: '500' }}>{req.submittedByName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{req.submittedByStore}</div>
                                                </td>
                                                <td>{getTypeName(req.type)}</td>
                                                <td>{req.memberId}</td>
                                                <td>{req.detail}</td>
                                                <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                                <td>
                                                    <input 
                                                        type="text" 
                                                        placeholder="輸入紀錄或原因"
                                                        className="form-control"
                                                        style={{ fontSize: '0.875rem' }}
                                                        value={adminNote[req.id] || ''}
                                                        onChange={(e) => handleNoteChange(req.id, e.target.value)}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button 
                                                            className="btn btn-sm btn-primary"
                                                            onClick={() => handleAction(req.id, 'approved')}
                                                            disabled={loading}
                                                        >
                                                            核准
                                                        </button>
                                                        <button 
                                                            className="btn btn-sm btn-outline"
                                                            style={{ color: '#DC2626', borderColor: '#DC2626' }}
                                                            onClick={() => handleAction(req.id, 'rejected')}
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
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>目前無歷史紀錄</td>
                                        </tr>
                                    ) : (
                                        history.map(req => (
                                            <tr key={req.id}>
                                                <td>
                                                    <div style={{ fontWeight: '500' }}>{req.submittedByName}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{req.submittedByStore}</div>
                                                </td>
                                                <td>{getTypeName(req.type)}</td>
                                                <td>{req.memberId}</td>
                                                <td>{req.detail}</td>
                                                <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span className={`tag tag-${req.status}`} style={{ alignSelf: 'flex-start' }}>
                                                            {req.status === 'approved' ? '已核准' : '已駁回'}
                                                        </span>
                                                        <span style={{ fontSize: '0.85rem' }}>{req.reviewedByName || '管理員'}</span>
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
                @media (max-width: 768px) {
                    .desktop-only { display: none !important; }
                    .mobile-only { display: block !important; }
                }
            `}} />
        </div>
    );
}

export default MemberAuditPage;
