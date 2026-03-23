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
    doc,
    getDoc
} from 'firebase/firestore';

function MemberActionPage() {
    const [actionType, setActionType] = useState('points'); // points, edit_phone, edit_birthday, delete_member
    const [memberId, setMemberId] = useState(''); // 卡號或手機
    const [points, setPoints] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newBirthday, setNewBirthday] = useState('');
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState([]);
    const [showConfirm, setShowConfirm] = useState(false); // 控制確認彈窗

    useEffect(() => {
        if (!auth.currentUser) return;

        // 即時監聽該員工提交的異動紀錄
        const q = query(
            collection(db, 'member_actions'),
            where('submittedBy', '==', auth.currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsub();
    }, []);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!memberId) return alert('請輸入卡號或手機');
        setShowConfirm(true);
    };

    const handleConfirmSubmit = async () => {
        setLoading(true);
        setShowConfirm(false);
        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userData = userDoc.data();

            let changeDetail = '';
            if (actionType === 'points') changeDetail = `補登點數: ${points}`;
            else if (actionType === 'edit_phone') changeDetail = `修改手機: ${newPhone}`;
            else if (actionType === 'edit_birthday') changeDetail = `修改生日: ${newBirthday}`;
            else if (actionType === 'delete_member') changeDetail = `申請刪除會員`;

            await addDoc(collection(db, 'member_actions'), {
                type: actionType,
                memberId,
                points: actionType === 'points' ? points : null,
                newData: actionType === 'edit_phone' ? newPhone : (actionType === 'edit_birthday' ? newBirthday : null),
                detail: changeDetail,
                status: 'pending',
                submittedBy: auth.currentUser.uid,
                submittedByName: userData.displayName || '未命名',
                submittedByStore: userData.storeName || '未設定',
                submittedByLineId: userData.lineUserId || null,
                createdAt: serverTimestamp()
            });

            alert('異動申請已送出');
            // 清空表單
            setMemberId('');
            setPoints('');
            setNewPhone('');
            setNewBirthday('');
        } catch (err) {
            console.error(err);
            alert('送出失敗');
        } finally {
            setLoading(false);
        }
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
            <div className="admin-content-header">
                <h2 className="admin-content-title" style={{ fontSize: '1.5rem' }}>會員資料異動</h2>
            </div>

            {/* 確認彈窗 */}
            {showConfirm && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-content card" style={{ width: '90%', maxWidth: '400px', padding: '1.5rem', borderRadius: '12px', background: '#fff' }}>
                        <h3 style={{ marginBottom: '1rem' }}>確認提交異動？</h3>
                        <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
                            <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#666' }}>異動類型：</span><strong>{getTypeName(actionType)}</strong></div>
                            <div style={{ marginBottom: '0.5rem' }}><span style={{ color: '#666' }}>會員識別：</span><strong>{memberId}</strong></div>
                            {actionType === 'points' && <div><span style={{ color: '#666' }}>補登點數：</span><strong>{points} 點</strong></div>}
                            {actionType === 'edit_phone' && <div><span style={{ color: '#666' }}>新手機：</span><strong>{newPhone}</strong></div>}
                            {actionType === 'edit_birthday' && <div><span style={{ color: '#666' }}>新生日：</span><strong>{newBirthday}</strong></div>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>取消</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleConfirmSubmit}>確認送出</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>新增異動申請</h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label>異動類型</label>
                        <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="form-control" style={{ width: '100%', height: '45px' }}>
                            <option value="points">補登點數</option>
                            <option value="edit_phone">修改手機</option>
                            <option value="edit_birthday">修改生日</option>
                            <option value="delete_member">刪除會員</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>卡號或手機</label>
                        <input
                            type="text"
                            className="form-control"
                            style={{ height: '45px' }}
                            value={memberId}
                            onChange={(e) => setMemberId(e.target.value.substring(0, 10))}
                            placeholder="輸入會員識別碼 (最多10碼)"
                            maxLength="10"
                            required
                        />
                    </div>

                    {actionType === 'points' && (
                        <div className="form-group">
                            <label>補登點數</label>
                            <input
                                type="number"
                                className="form-control"
                                style={{ height: '45px' }}
                                value={points}
                                onChange={(e) => setPoints(e.target.value)}
                                placeholder="點數"
                                required
                            />
                        </div>
                    )}

                    {actionType === 'edit_phone' && (
                        <div className="form-group">
                            <label>新手機號碼</label>
                            <input
                                type="tel"
                                className="form-control"
                                style={{ height: '45px' }}
                                value={newPhone}
                                onChange={(e) => setNewPhone(e.target.value)}
                                placeholder="輸入新手機"
                                required
                            />
                        </div>
                    )}

                    {actionType === 'edit_birthday' && (
                        <div className="form-group">
                            <label>新生日</label>
                            <input
                                type="date"
                                className="form-control"
                                style={{ height: '45px' }}
                                value={newBirthday}
                                min="1926-01-01"
                                max={`${new Date().getFullYear()}-12-31`}
                                onChange={(e) => setNewBirthday(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '45px', marginTop: '0.5rem' }}>
                        {loading ? '送出中...' : '確認提交申請'}
                    </button>
                </form>
            </div>

            <div className="history-container">
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                                        {req.status === 'pending' ? '待審核' : req.status === 'approved' ? '已核准' : '已駁回'}
                                    </span>
                                </div>
                                <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{getTypeName(req.type)}</div>
                                <div style={{ fontSize: '0.85rem', color: '#444', marginBottom: '0.5rem' }}>會員：{req.memberId}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666', background: '#f8f9fa', padding: '0.5rem', borderRadius: '4px' }}>
                                    {req.detail}
                                </div>
                                {(req.status === 'approved' || req.status === 'rejected') && (
                                    <div style={{ fontSize: '0.8125rem', color: '#888', marginTop: '0.5rem' }}>
                                        審核者：{req.reviewedByName || '管理員'}
                                    </div>
                                )}
                                {req.adminNote && (
                                    <div style={{ fontSize: '0.75rem', color: '#800019', marginTop: '0.5rem' }}>
                                        備註：{req.adminNote}
                                    </div>
                                )}
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
                                    <th>類型</th>
                                    <th>會員ID</th>
                                    <th>詳細內容</th>
                                    <th>狀態</th>
                                    <th>審核者</th>
                                    <th>備註</th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>暫無紀錄</td>
                                    </tr>
                                ) : (
                                    requests.map(req => (
                                        <tr key={req.id}>
                                            <td>{req.createdAt?.toDate().toLocaleString() || '...'}</td>
                                            <td>{getTypeName(req.type)}</td>
                                            <td>{req.memberId}</td>
                                            <td>{req.detail}</td>
                                            <td>
                                                <span className={`tag tag-${req.status}`}>
                                                    {req.status === 'pending' ? '待審核' : req.status === 'approved' ? '已核准' : '已駁回'}
                                                </span>
                                            </td>
                                            <td>
                                                {(req.status === 'approved' || req.status === 'rejected') ? (req.reviewedByName || '管理員') : '-'}
                                            </td>
                                            <td>{req.adminNote || '-'}</td>
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
                }
            `}} />
        </div>
    );
}

export default MemberActionPage;
