import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, getDocs, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { formatDate, formatDateTime } from '../utils';

function AdminPage() {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, []);

    async function fetchPosts() {
        setLoading(true);
        try {
            const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            setPosts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error('取得公告失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id, title) {
        if (!window.confirm(`確定要刪除「${title}」嗎？`)) return;
        try {
            await deleteDoc(doc(db, 'posts', id));
            setPosts((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            console.error('刪除失敗:', err);
            alert('刪除失敗，請重試');
        }
    }

    // 下檔 / 重新上檔
    async function handleToggleArchive(post) {
        const newStatus = post.status === 'published' ? 'archived' : 'published';
        const action = post.status === 'published' ? '下檔' : '重新上檔';
        try {
            await updateDoc(doc(db, 'posts', post.id), { status: newStatus });
            setPosts((prev) =>
                prev.map((p) => p.id === post.id ? { ...p, status: newStatus } : p)
            );
        } catch (err) {
            console.error(`${action}失敗:`, err);
            alert(`${action}失敗，請重試`);
        }
    }

    // 置頂 / 取消置頂
    async function handleTogglePin(post) {
        const newPinned = !post.pinned;
        const action = newPinned ? '置頂' : '取消置頂';
        try {
            await updateDoc(doc(db, 'posts', post.id), { pinned: newPinned });
            setPosts((prev) =>
                prev.map((p) => p.id === post.id ? { ...p, pinned: newPinned } : p)
            );
        } catch (err) {
            console.error(`${action}失敗:`, err);
            alert(`${action}失敗，請重試`);
        }
    }

    async function handleLogout() {
        await signOut(auth);
        navigate('/');
    }

    function getStatusLabel(post) {
        if (post.status === 'archived') return '已下檔';
        if (post.status === 'draft') return '草稿';
        if (post.status === 'published' && post.scheduledAt) {
            const schedDate = post.scheduledAt.toDate ? post.scheduledAt.toDate() : new Date(post.scheduledAt);
            if (schedDate > new Date()) return '排程中';
        }
        if (post.status === 'published') return '已發布';
        return post.status;
    }

    function getStatusClass(post) {
        const label = getStatusLabel(post);
        if (label === '已下檔') return 'status-archived';
        if (label === '草稿') return 'status-draft';
        if (label === '排程中') return 'status-scheduled';
        return 'status-published';
    }

    return (
        <div className="page-container">
            <div className="admin-header">
                <h1 className="page-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    公告管理
                </h1>
                <div className="admin-actions">
                    <Link to="/admin/edit" className="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        新增公告
                    </Link>
                    <Link to="/admin/converter" className="btn btn-secondary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <path d="M12 18v-6" />
                            <path d="M9 15l3 3 3-3" />
                        </svg>
                        資料轉換
                    </Link>
                    <button onClick={handleLogout} className="btn btn-outline">
                        登出
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>狀態</th>
                                <th>標題</th>
                                <th>分類</th>
                                <th>建立日期</th>
                                <th>排程時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...Array(5)].map((_, i) => (
                                <tr key={i}>
                                    <td><div className="skeleton skeleton-tag" /></td>
                                    <td><div className="skeleton skeleton-title" /></td>
                                    <td><div className="skeleton skeleton-tag" /></td>
                                    <td><div className="skeleton skeleton-date" /></td>
                                    <td><div className="skeleton skeleton-date" /></td>
                                    <td><div className="skeleton skeleton-actions" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : posts.length === 0 ? (
                <div className="empty-state">
                    <p>尚未發布任何公告</p>
                    <Link to="/admin/edit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        新增第一則公告
                    </Link>
                </div>
            ) : (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>狀態</th>
                                <th>標題</th>
                                <th>分類</th>
                                <th>建立日期</th>
                                <th>排程時間</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {posts.map((post) => (
                                <tr key={post.id} className={post.status === 'archived' ? 'row-archived' : ''}>
                                    <td>
                                        <div className="status-badge-group">
                                            <span className={`status-badge ${getStatusClass(post)}`}>
                                                {getStatusLabel(post)}
                                            </span>
                                            {post.pinned && (
                                                <span className="status-badge status-pinned" title="置頂">
                                                    📌
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="admin-table-title">{post.title}</td>
                                    <td>{post.category || '-'}</td>
                                    <td>{formatDate(post.createdAt)}</td>
                                    <td>{post.scheduledAt ? formatDateTime(post.scheduledAt) : '-'}</td>
                                    <td>
                                        <div className="admin-table-actions">
                                            {/* 置頂按鈕 */}
                                            {post.status === 'published' && (
                                                <button
                                                    onClick={() => handleTogglePin(post)}
                                                    className={`btn-icon ${post.pinned ? 'btn-icon-pinned' : 'btn-icon-pin'}`}
                                                    title={post.pinned ? '取消置頂' : '置頂'}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill={post.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 2L12 22" />
                                                        <path d="M5 5.5C5 5.5 5 12 12 12C19 12 19 5.5 19 5.5" />
                                                    </svg>
                                                </button>
                                            )}
                                            {/* 下檔 / 上檔 按鈕 */}
                                            {post.status !== 'draft' && (
                                                <button
                                                    onClick={() => handleToggleArchive(post)}
                                                    className={`btn-icon ${post.status === 'published' ? 'btn-icon-archive' : 'btn-icon-restore'}`}
                                                    title={post.status === 'published' ? '下檔' : '重新上檔'}
                                                >
                                                    {post.status === 'published' ? (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="17 1 21 5 17 9" />
                                                            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                                            <polyline points="7 23 3 19 7 15" />
                                                            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="1 4 1 10 7 10" />
                                                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                            <Link to={`/admin/edit/${post.id}`} className="btn-icon" title="編輯">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </Link>
                                            <button onClick={() => handleDelete(post.id, post.title)} className="btn-icon btn-icon-danger" title="刪除">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6" />
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

export default AdminPage;
