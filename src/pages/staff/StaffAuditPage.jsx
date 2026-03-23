import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    doc,
    updateDoc
} from 'firebase/firestore';

function StaffAuditPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchUnapprovedUsers();
    }, []);

    const fetchUnapprovedUsers = async () => {
        const q = query(
            collection(db, 'users'),
            where('isApproved', '==', false),
            where('role', '==', 'staff')
        );
        const querySnapshot = await getDocs(q);
        setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };

    const handleApprove = async (id) => {
        setLoading(true);
        try {
            await updateDoc(doc(db, 'users', id), {
                isApproved: true
            });
            alert('帳號已核准');
            fetchUnapprovedUsers();
        } catch (err) {
            console.error(err);
            alert('操作失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (id) => {
        if (!confirm('確定要拒絕此申請？這將不會從資料庫刪除用戶，但他們無法訪問。')) return;
        // 這裡可以選擇刪除或保持 isApproved 為 false
        alert('已忽略此申請');
    };

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">員工帳號審核</h2>
            </div>

            <div className="card">
                <div className="table-responsive">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>姓名</th>
                                <th>門市</th>
                                <th>電子信箱</th>
                                <th>註冊時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>目前無待審核員工</td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id}>
                                        <td>{user.displayName}</td>
                                        <td>{user.storeName}</td>
                                        <td>{user.email}</td>
                                        <td>{user.createdAt?.toDate().toLocaleString() || '...'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    className="btn btn-sm btn-primary"
                                                    onClick={() => handleApprove(user.id)}
                                                    disabled={loading}
                                                >
                                                    核准
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-outline"
                                                    style={{ color: '#800019', borderColor: '#800019' }}
                                                    onClick={() => handleReject(user.id)}
                                                    disabled={loading}
                                                >
                                                    不核准
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
        </div>
    );
}

export default StaffAuditPage;
