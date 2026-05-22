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
        <div className="admin-page-content member-action-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">會員資料異動</h2>
            </div>

            {/* 確認彈窗 */}
            {showConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content card">
                        <h3 className="modal-title">確認提交異動？</h3>
                        <div className="confirm-details">
                            <div className="detail-row"><span className="detail-label">異動類型：</span><strong>{getTypeName(actionType)}</strong></div>
                            <div className="detail-row"><span className="detail-label">會員識別：</span><strong>{memberId}</strong></div>
                            {actionType === 'points' && <div className="detail-row"><span className="detail-label">補登點數：</span><strong>{points} 點</strong></div>}
                            {actionType === 'edit_phone' && <div className="detail-row"><span className="detail-label">新手機：</span><strong>{newPhone}</strong></div>}
                            {actionType === 'edit_birthday' && <div className="detail-row"><span className="detail-label">新生日：</span><strong>{newBirthday}</strong></div>}
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-outline btn-cancel" onClick={() => setShowConfirm(false)}>取消</button>
                            <button className="btn btn-primary btn-confirm" onClick={handleConfirmSubmit}>確認送出</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="card form-card">
                <h3 className="card-subtitle">新增異動申請</h3>
                <form onSubmit={handleSubmit} className="action-form">
                    <div className="form-group">
                        <label>異動類型</label>
                        <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="form-control select-action">
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
                            className="form-control input-action"
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
                                className="form-control input-action"
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
                                className="form-control input-action"
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
                                className="form-control input-action"
                                value={newBirthday}
                                min="1926-01-01"
                                max={`${new Date().getFullYear()}-12-31`}
                                onChange={(e) => setNewBirthday(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-submit" disabled={loading}>
                        {loading ? '送出中...' : '確認提交申請'}
                    </button>
                </form>
            </div>

            <div className="history-container">
                <div className="history-header">
                    <h3 className="card-subtitle">申請紀錄</h3>
                </div>

                {/* 手機版：卡片式列表 */}
                <div className="mobile-only">
                    {requests.length === 0 ? (
                        <div className="card list-empty">暫無紀錄</div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="card request-card">
                                <div className="request-card-header">
                                    <span className="request-date">{req.createdAt?.toDate().toLocaleDateString()}</span>
                                    <span className={`tag tag-${req.status}`}>
                                        {req.status === 'pending' ? '待審核' : req.status === 'approved' ? '已核准' : '已駁回'}
                                    </span>
                                </div>
                                <div className="request-type">{getTypeName(req.type)}</div>
                                <div className="request-member">會員：{req.memberId}</div>
                                <div className="request-detail">
                                    {req.detail}
                                </div>
                                {(req.status === 'approved' || req.status === 'rejected') && (
                                    <div className="request-reviewer">
                                        審核者：{req.reviewedByName || '管理員'}
                                    </div>
                                )}
                                {req.adminNote && (
                                    <div className="request-note">
                                        備註：{req.adminNote}
                                    </div>
                                )}
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
                                        <td colSpan="7" className="table-empty">暫無紀錄</td>
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
                .member-action-page .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    zIndex: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .member-action-page .modal-content {
                    width: 90%;
                    max-width: 400px;
                    padding: 1.5rem;
                    border-radius: 12px;
                    background: #fff;
                }
                .member-action-page .modal-title {
                    margin-bottom: 1rem;
                }
                .member-action-page .confirm-details {
                    background: #f8f9fa;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1.5rem;
                    font-size: 0.9375rem;
                }
                .member-action-page .detail-row {
                    margin-bottom: 0.5rem;
                }
                .member-action-page .detail-row:last-child {
                    margin-bottom: 0;
                }
                .member-action-page .detail-label {
                    color: #666;
                }
                .member-action-page .modal-actions {
                    display: flex;
                    gap: 0.75rem;
                }
                .member-action-page .btn-cancel,
                .member-action-page .btn-confirm {
                    flex: 1;
                }
                .member-action-page .form-card {
                    padding: 1.25rem;
                    margin-bottom: 1.5rem;
                }
                .member-action-page .card-subtitle {
                    font-size: 1.1rem;
                    margin-bottom: 1rem;
                }
                .member-action-page .action-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .member-action-page .select-action,
                .member-action-page .input-action {
                    width: 100%;
                    height: 45px;
                }
                .member-action-page .btn-submit {
                    height: 45px;
                    margin-top: 0.5rem;
                }
                .member-action-page .history-header {
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .member-action-page .table-empty {
                    text-align: center;
                    padding: 2rem;
                    color: #999;
                }
                .member-action-page .mobile-only {
                    display: none;
                }
                .member-action-page .desktop-only {
                    display: block;
                }
                .member-action-page .list-empty {
                    padding: 2rem;
                    text-align: center;
                    color: #999;
                }
                .member-action-page .request-card {
                    padding: 1rem;
                    margin-bottom: 0.75rem;
                }
                .member-action-page .request-card-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }
                .member-action-page .request-date {
                    font-size: 0.75rem;
                    color: #666;
                }
                .member-action-page .request-type {
                    font-weight: 600;
                    margin-bottom: 0.25rem;
                }
                .member-action-page .request-member {
                    font-size: 0.85rem;
                    color: #444;
                    margin-bottom: 0.5rem;
                }
                .member-action-page .request-detail {
                    font-size: 0.85rem;
                    color: #666;
                    background: #f8f9fa;
                    padding: 0.5rem;
                    border-radius: 4px;
                }
                .member-action-page .request-reviewer {
                    font-size: 0.8125rem;
                    color: #888;
                    margin-top: 0.5rem;
                }
                .member-action-page .request-note {
                    font-size: 0.75rem;
                    color: #800019;
                    margin-top: 0.5rem;
                }

                @media (max-width: 768px) {
                    .member-action-page .desktop-only { display: none !important; }
                    .member-action-page .mobile-only { display: block !important; }
                }
            `}} />
        </div>
    );
}

export default MemberActionPage;
