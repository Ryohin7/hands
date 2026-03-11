import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate, groupByMonth } from '../utils';

const PAGE_SIZE = 20;

function WinnersPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSnapshots, setPageSnapshots] = useState({});

    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

    useEffect(() => {
        fetchCount();
    }, []);

    useEffect(() => {
        fetchPosts();
    }, [currentPage]);

    async function fetchCount() {
        try {
            const q = query(
                collection(db, 'posts'),
                where('status', '==', 'published'),
                where('category', '==', '中獎名單公告')
            );
            const snapshot = await getCountFromServer(q);
            setTotalCount(snapshot.data().count);
        } catch (err) {
            console.error('取得中獎名單數量失敗:', err);
        }
    }

    async function fetchPosts() {
        setLoading(true);
        try {
            let q;
            if (currentPage === 1) {
                q = query(
                    collection(db, 'posts'),
                    where('status', '==', 'published'),
                    where('category', '==', '中獎名單公告'),
                    orderBy('createdAt', 'desc'),
                    limit(PAGE_SIZE)
                );
            } else {
                const lastDoc = pageSnapshots[currentPage - 1];
                if (!lastDoc) return;
                q = query(
                    collection(db, 'posts'),
                    where('status', '==', 'published'),
                    where('category', '==', '中獎名單公告'),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDoc),
                    limit(PAGE_SIZE)
                );
            }

            const snapshot = await getDocs(q);
            const now = new Date();

            const data = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((post) => {
                    if (post.scheduledAt) {
                        const schedDate = post.scheduledAt.toDate ? post.scheduledAt.toDate() : new Date(post.scheduledAt);
                        return schedDate <= now;
                    }
                    return true;
                });

            if (snapshot.docs.length > 0) {
                setPageSnapshots((prev) => ({
                    ...prev,
                    [currentPage]: snapshot.docs[snapshot.docs.length - 1],
                }));
            }

            setPosts(data);
        } catch (err) {
            console.error('取得中獎名單失敗 (可能需要建立 Firebase 複合索引):', err);
            // Fallback: 如果因為缺乏索引報錯，改用前端過濾 (較慢，但能確保程式可運作)
            try {
                let fallbackQ = query(collection(db, 'posts'), where('status', '==', 'published'), orderBy('createdAt', 'desc'));
                const fallbackSnapshot = await getDocs(fallbackQ);
                const now = new Date();
                const allData = fallbackSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(post => post.category === '中獎名單公告')
                    .filter(post => {
                        if (post.scheduledAt) {
                            const schedDate = post.scheduledAt.toDate ? post.scheduledAt.toDate() : new Date(post.scheduledAt);
                            return schedDate <= now;
                        }
                        return true;
                    });
                
                setTotalCount(allData.length);
                const startIdx = (currentPage - 1) * PAGE_SIZE;
                setPosts(allData.slice(startIdx, startIdx + PAGE_SIZE));
            } catch (err2) {
                console.error('Fallback 取得中獎名單失敗:', err2);
            }
        } finally {
            setLoading(false);
        }
    }

    const monthGroups = groupByMonth(posts);

    function renderSkeleton() {
        return (
            <div className="post-list">
                <div className="month-group">
                    <div className="month-label">
                        <div className="skeleton skeleton-month" />
                    </div>
                    <div className="month-items">
                        {[...Array(5)].map((_, i) => (
                            <div className="post-card-skeleton" key={i}>
                                <div className="post-card-content">
                                    <div className="post-card-meta">
                                        <div className="skeleton skeleton-date" />
                                        <div className="skeleton skeleton-tag" />
                                    </div>
                                    <div className="skeleton skeleton-title" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">中獎名單</h1>
                {totalCount > 0 && (
                    <span className="page-count">共 {totalCount} 則</span>
                )}
            </div>

            {loading ? renderSkeleton() : posts.length === 0 ? (
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p>目前沒有中獎名單</p>
                </div>
            ) : (
                <>
                    <div className="post-list">
                        {monthGroups.map((group) => (
                            <div className="month-group" key={group.yearMonth}>
                                <div className="month-label">{group.month}</div>
                                <div className="month-items">
                                    {group.posts.map((post, index) => (
                                        <Link
                                            to={`/post/${post.id}`}
                                            key={post.id}
                                            className="post-card"
                                            style={{ animationDelay: `${index * 0.03}s` }}
                                        >
                                            <div className="post-card-content">
                                                <div className="post-card-meta">
                                                    <span className="post-date">{formatDate(post.createdAt)}</span>
                                                    {post.category && (
                                                        <span className="post-category-tag" style={{ backgroundColor: '#007130', color: 'white' }}>
                                                            {post.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <h2 className="post-title">{post.title}</h2>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="pagination-btn"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage((p) => p - 1)}
                            >
                                ← 上一頁
                            </button>
                            <span className="pagination-info">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                className="pagination-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage((p) => p + 1)}
                            >
                                下一頁 →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default WinnersPage;
