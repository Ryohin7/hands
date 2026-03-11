import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate, groupByMonth } from '../utils';
import { autoSpace } from '../utils/textUtils';

const PAGE_SIZE = 20;

function HomePage() {
    const [posts, setPosts] = useState([]);
    const [pinnedPosts, setPinnedPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSnapshots, setPageSnapshots] = useState({});

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    useEffect(() => {
        fetchPinnedPosts();
        fetchCount();
    }, []);

    useEffect(() => {
        fetchPosts();
    }, [currentPage]);

    // 取得置頂公告
    async function fetchPinnedPosts() {
        try {
            const q = query(
                collection(db, 'posts'),
                where('status', '==', 'published'),
                where('pinned', '==', true),
                orderBy('createdAt', 'desc')
            );
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
            setPinnedPosts(data);
        } catch (err) {
            console.error('取得置頂公告失敗:', err);
        }
    }

    async function fetchCount() {
        try {
            const q = query(
                collection(db, 'posts'),
                where('status', '==', 'published'),
                where('pinned', 'in', [false, null])
            );
            const snapshot = await getCountFromServer(q);
            setTotalCount(snapshot.data().count);
        } catch (err) {
            // Firestore 'in' 查詢可能需要索引，fallback 到原本的方式
            try {
                const q = query(
                    collection(db, 'posts'),
                    where('status', '==', 'published')
                );
                const snapshot = await getCountFromServer(q);
                setTotalCount(snapshot.data().count);
            } catch (err2) {
                console.error('取得公告數量失敗:', err2);
            }
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
                    orderBy('createdAt', 'desc'),
                    limit(PAGE_SIZE)
                );
            } else {
                const lastDoc = pageSnapshots[currentPage - 1];
                if (!lastDoc) return;
                q = query(
                    collection(db, 'posts'),
                    where('status', '==', 'published'),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastDoc),
                    limit(PAGE_SIZE)
                );
            }

            const snapshot = await getDocs(q);
            const now = new Date();
            const pinnedIds = new Set(pinnedPosts.map((p) => p.id));

            const data = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((post) => {
                    // 排除置頂文章（已在上方顯示）
                    if (post.pinned && pinnedIds.has(post.id)) return false;
                    // 過濾掉尚未到排程時間的文章
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
            console.error('取得公告失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    const monthGroups = groupByMonth(posts);

    // Skeleton Loading
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
                <h1 className="page-title">最新公告</h1>
                {totalCount > 0 && (
                    <span className="page-count">共 {totalCount} 則</span>
                )}
            </div>

            {loading ? renderSkeleton() : posts.length === 0 && pinnedPosts.length === 0 ? (
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p>目前沒有公告</p>
                </div>
            ) : (
                <>
                    {/* 置頂公告區塊 */}
                    {pinnedPosts.length > 0 && currentPage === 1 && (
                        <div className="pinned-section">
                            <div className="pinned-list">
                                {pinnedPosts.map((post, index) => (
                                    <Link
                                        to={`/post/${post.id}`}
                                        key={post.id}
                                        className="post-card pinned-card"
                                        style={{ animationDelay: `${index * 0.03}s` }}
                                    >
                                        <div className="post-card-content">
                                            <div className="post-card-meta">
                                                <span className="post-date">{formatDate(post.createdAt)}</span>
                                                {post.category && (
                                                    <span className="post-category-tag">
                                                        {post.category}
                                                    </span>
                                                )}

                                            </div>
                                            <h2 className="post-title">{autoSpace(post.title)}</h2>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 一般公告列表 */}
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
                                                        <span className="post-category-tag">
                                                            {post.category}
                                                        </span>
                                                    )}
                                                </div>
                                                <h2 className="post-title">{autoSpace(post.title)}</h2>
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

export default HomePage;
