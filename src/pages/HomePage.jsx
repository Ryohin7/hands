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
    const [physicalEvents, setPhysicalEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSnapshots, setPageSnapshots] = useState({});

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    useEffect(() => {
        fetchPinnedPosts();
        fetchPhysicalEvents();
        fetchCount();
    }, []);

    // 取得實體活動
    async function fetchPhysicalEvents() {
        try {
            const q = query(
                collection(db, 'posts'),
                where('category', '==', '實體活動'),
                where('status', '==', 'published'),
                orderBy('createdAt', 'desc'),
                limit(4)
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // 取得每個活動的報名人數
            const eventsWithCounts = await Promise.all(data.map(async (event) => {
                const regQ = query(collection(db, 'event_registrations'), where('postId', '==', event.id));
                const regSnap = await getDocs(regQ);
                return { ...event, currentCount: regSnap.size };
            }));

            setPhysicalEvents(eventsWithCounts);
        } catch (err) {
            console.error('取得實體活動失敗:', err);
        } finally {
            setLoadingEvents(false);
        }
    }

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
            // 由於 Firestore 不能直接在非排序欄位做 != 且同時做其他排序，
            // 這裡抓取所有 published 文章並過濾 count 是較保險做法 (若文章量極大才需優化方案)
            const q = query(
                collection(db, 'posts'),
                where('status', '==', 'published')
            );
            const snapshot = await getDocs(q);
            const count = snapshot.docs.filter(doc => doc.data().category !== '實體活動').length;
            setTotalCount(count);
        } catch (err) {
            console.error('取得公告數量失敗:', err);
        }
    }

    async function fetchPosts() {
        setLoading(true);
        try {
            let q;
            const commonFilters = [
                where('status', '==', 'published'),
                orderBy('createdAt', 'desc')
            ];

            if (currentPage === 1) {
                q = query(
                    collection(db, 'posts'),
                    ...commonFilters,
                    limit(PAGE_SIZE * 2) // 取多一點以補足被過濾掉的數量
                );
            } else {
                const lastDoc = pageSnapshots[currentPage - 1];
                if (!lastDoc) return;
                q = query(
                    collection(db, 'posts'),
                    ...commonFilters,
                    startAfter(lastDoc),
                    limit(PAGE_SIZE * 2)
                );
            }

            const snapshot = await getDocs(q);
            const now = new Date();
            const pinnedIds = new Set(pinnedPosts.map((p) => p.id));

            const data = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((post) => {
                    // 排除實體活動
                    if (post.category === '實體活動') return false;
                    // 排除置頂文章（已在上方顯示）
                    if (post.pinned && pinnedIds.has(post.id)) return false;
                    // 過濾掉尚未到排程時間的文章
                    if (post.scheduledAt) {
                        const schedDate = post.scheduledAt.toDate ? post.scheduledAt.toDate() : new Date(post.scheduledAt);
                        return schedDate <= now;
                    }
                    return true;
                })
                .slice(0, PAGE_SIZE); // 確保每頁顯示固定數量

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

    const getFirstImage = (content) => {
        const div = document.createElement('div');
        div.innerHTML = content;
        const img = div.querySelector('img');
        return img ? img.src : null;
    };

    const getEventStatus = (event) => {
        const now = new Date();
        const deadline = event.formDeadline?.toDate ? event.formDeadline.toDate() : new Date(event.formDeadline);
        const eventTime = event.eventTime?.toDate ? event.eventTime.toDate() : new Date(event.eventTime);
        const limit = Number(event.registrationLimit) || 0;
        const waitLimit = Number(event.waitlistLimit) || 0;
        const count = Number(event.currentCount) || 0;

        if (now > eventTime) return { label: '活動已結束', color: '#999' };
        if (event.isOnsiteRegistration) return { label: '實體報名', color: '#007130' };
        if (now > deadline) return { label: '報名已截止', color: '#d32f2f' };

        if (limit > 0 && count >= limit) {
            if (event.allowWaitlist === false) {
                return { label: '報名已額滿', color: '#d32f2f' };
            }
            // 開啟候補：檢查候補是否也滿了
            if (waitLimit > 0 && count >= (limit + waitLimit)) {
                return { label: '報名已額滿', color: '#d32f2f' };
            }
            return { label: '報名候補中', color: '#ef6c00' };
        }
        return { label: '熱烈報名中', color: '#007130' };
    };

    return (
        <div className="page-container post-detail-container">
            {loading ? renderSkeleton() : posts.length === 0 && pinnedPosts.length === 0 && physicalEvents.length === 0 ? (
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p>目前沒有公告</p>
                </div>
            ) : (
                <>
                    {/* 實體活動橫向區塊 */}
                    {physicalEvents.length > 0 && (
                        <div className="physical-events-section" style={{ marginBottom: '3rem' }}>
                            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                    實體活動
                                </h2>
                                <Link 
                                    to="/registration-inquiry" 
                                    className="btn btn-outline"
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px',
                                        padding: '0.6rem 1.25rem',
                                        borderRadius: '20px',
                                        fontSize: '0.9rem',
                                        fontWeight: '600',
                                        color: '#007130',
                                        borderColor: '#007130',
                                        textDecoration: 'none'
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                    報名查詢
                                </Link>
                            </div>

                            <div className="physical-events-grid" style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', 
                                gap: '1.5rem',
                                overflowX: 'auto',
                                paddingBottom: '0.5rem',
                                marginTop: '1.5rem'
                            }}>
                                {physicalEvents.map((event) => {
                                    const banner = getFirstImage(event.content);
                                    const status = getEventStatus(event);
                                    return (
                                        <Link 
                                            to={`/post/${event.id}`} 
                                            key={event.id} 
                                            className="event-card"
                                            style={{ 
                                                textDecoration: 'none', 
                                                color: 'inherit',
                                                background: '#fff',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                border: '1px solid #eee',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                transition: 'transform 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#f5f5f5' }}>
                                                {banner ? (
                                                    <img src={banner} alt={event.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', filter: status.label === '活動已結束' ? 'grayscale(0.5) brightness(0.7)' : 'none' }} />
                                                ) : (
                                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                                    </div>
                                                )}
                                                
                                                {/* 活動已結束遮罩 */}
                                                {status.label === '活動已結束' && (
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        top: 0, 
                                                        left: 0, 
                                                        width: '100%', 
                                                        height: '100%', 
                                                        background: 'rgba(0,0,0,0.5)', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center',
                                                        zIndex: 2
                                                    }}>
                                                        <span style={{ 
                                                            color: '#fff', 
                                                            fontSize: '1.5rem', 
                                                            fontWeight: '900', 
                                                            letterSpacing: '2px',
                                                            border: '2px solid #fff',
                                                            padding: '8px 16px',
                                                            borderRadius: '4px',
                                                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                                                        }}>
                                                            活動已結束
                                                        </span>
                                                    </div>
                                                )}

                                                {/* 狀態標籤 (活動已結束時不顯示，改由中央遮罩顯示) */}
                                                {status.label !== '活動已結束' && (
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        top: '12px', 
                                                        right: '12px',
                                                        background: status.color,
                                                        color: '#fff',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 'bold',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                        zIndex: 3
                                                    }}>
                                                        {status.label}
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ padding: '1.25rem' }}>
                                                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: '700', lineHeight: '1.4', height: '2.8em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                                    {autoSpace(event.title)}
                                                </h3>
                                                <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                    活動時間：{event.eventTime?.toDate ? event.eventTime.toDate().toLocaleDateString() : new Date(event.eventTime).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2rem' }}>
                                <Link 
                                    to="/events" 
                                    className="btn btn-outline"
                                    style={{ 
                                        padding: '0.8rem 2.5rem',
                                        borderRadius: '30px',
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        color: '#007130',
                                        borderColor: '#007130',
                                        textDecoration: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = '#007130';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#007130';
                                    }}
                                >
                                    查看更多活動
                                </Link>
                            </div>

                            <hr style={{ border: 'none', borderBottom: '1px solid #eee', margin: '3rem 0 1.5rem' }} />
                        </div>
                    )}

                    <div className="announcement-section">
                        <div className="page-header">
                            <h1 className="page-title">最新公告</h1>
                            {totalCount > 0 && (
                                <span className="page-count">共 {totalCount} 則</span>
                            )}
                        </div>

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
                    </div>
                </>
            )}
        </div>
    );
}

export default HomePage;
