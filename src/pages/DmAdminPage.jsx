import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

function DmAdminPage() {
    const [dms, setDms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDms();
    }, []);

    async function fetchDms() {
        try {
            const q = query(collection(db, 'dms'), orderBy('startDate', 'desc'));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDms(data);
        } catch (err) {
            console.error('讀取 DM 失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id, title) {
        if (!window.confirm(`確定要刪除「${title}」嗎？`)) return;
        try {
            await deleteDoc(doc(db, 'dms', id));
            setDms(dms.filter(d => d.id !== id));
        } catch (err) {
            alert('刪除失敗');
        }
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">DM 頁面管理</h2>
                <Link to="/admin/dm/edit" className="btn btn-primary">
                    新增 DM 檔期
                </Link>
            </div>

            {loading ? (
                <div className="loading-container"><div className="loading-spinner"></div></div>
            ) : (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>標題</th>
                                <th>檔期時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dms.map(dm => (
                                <tr key={dm.id}>
                                    <td className="font-medium">{dm.title}</td>
                                    <td>{dm.period}</td>
                                    <td>
                                        <div className="table-actions">
                                            <Link to={`/admin/dm/edit/${dm.id}`} className="btn-icon">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </Link>
                                            <button onClick={() => handleDelete(dm.id, dm.title)} className="btn-icon btn-delete">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default DmAdminPage;
