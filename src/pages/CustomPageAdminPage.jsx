import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils';

function CustomPageAdminPage() {
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPages();
    }, []);

    async function fetchPages() {
        try {
            const q = query(collection(db, 'custom_pages'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            setPages(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            console.error('讀取頁面失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id, title) {
        if (!window.confirm(`確定要刪除頁面「${title}」嗎？`)) return;
        try {
            await deleteDoc(doc(db, 'custom_pages', id));
            setPages(pages.filter(p => p.id !== id));
        } catch (err) {
            alert('刪除失敗');
        }
    }

    async function toggleStatus(id, currentStatus) {
        const newStatus = currentStatus === 'published' ? 'draft' : 'published';
        try {
            await updateDoc(doc(db, 'custom_pages', id), { status: newStatus });
            setPages(pages.map(p => p.id === id ? { ...p, status: newStatus } : p));
        } catch (err) {
            alert('更新狀態失敗');
        }
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">自訂頁面管理</h2>
                <Link to="/admin/pages/edit" className="btn btn-primary">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    新增頁面
                </Link>
            </div>

            <div className="info-card" style={{ marginBottom: '1.5rem' }}>
                <p>💡 您可以建立自訂頁面（如：會員條款、關於我們），並在「導航管理」中將其加入選單。</p>
            </div>

            {loading ? (
                <div className="loading-container"><div className="loading-spinner"></div></div>
            ) : (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>頁面標題</th>
                                <th>路徑 (ID)</th>
                                <th>狀態</th>
                                <th>建立時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map(page => (
                                <tr key={page.id}>
                                    <td className="font-medium">{page.title}</td>
                                    <td className="text-dim">/p/{page.id}</td>
                                    <td>
                                        <button
                                            onClick={() => toggleStatus(page.id, page.status)}
                                            className={`tag-status ${page.status === 'published' ? 'status-published' : 'status-draft'}`}
                                            title="點擊切換狀態"
                                        >
                                            {page.status === 'published' ? '已上檔' : '下檔中'}
                                        </button>
                                    </td>
                                    <td className="text-dim">{formatDate(page.createdAt)}</td>
                                    <td>
                                        <div className="admin-table-actions">
                                            <Link to={`/admin/pages/edit/${page.id}`} className="btn-icon" title="編輯">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </Link>
                                            <button onClick={() => handleDelete(page.id, page.title)} className="btn-icon btn-delete" title="刪除">
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

export default CustomPageAdminPage;
