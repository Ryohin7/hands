import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { autoSpace } from '../utils/textUtils';

const PAGE_SIZE = 12;

function PhysicalEventsPage() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [pageSnapshots, setPageSnapshots] = useState({});

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    useEffect(() => {
        fetchCount();
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [currentPage]);

    async function fetchCount() {
        try {
            const q = query(
                collection(db, 'posts'),
                where('category', '==', '實體活動'),
                where('status', '==', 'published')
            );
            const snapshot = await getCountFromServer(q);
            setTotalCount(snapshot.data().count);
        } catch (err) {
            console.error('取得活動數量失敗:', err);
        }
    }

    async function fetchEvents() {
        setLoading(true);
        try {
            let q;
            const commonFilters = [
                where('category', '==', '實體活動'),
                where('status', '==', 'published'),
                orderBy('createdAt', 'desc')
            ];

            if (currentPage === 1) {
                q = query(collection(db, 'posts'), ...commonFilters, limit(PAGE_SIZE));
            } else {
                const lastDoc = pageSnapshots[currentPage - 1];
                if (!lastDoc) return;
                q = query(collection(db, 'posts'), ...commonFilters, startAfter(lastDoc), limit(PAGE_SIZE));
            }

            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 取得人數
            const eventsWithCounts = await Promise.all(data.map(async (event) => {
                const regQ = query(collection(db, 'event_registrations'), where('postId', '==', event.id));
                const regSnap = await getDocs(regQ);
                return { ...event, currentCount: regSnap.size };
            }));

            if (snapshot.docs.length > 0) {
                setPageSnapshots(prev => ({ ...prev, [currentPage]: snapshot.docs[snapshot.docs.length - 1] }));
            }
            setEvents(eventsWithCounts);
        } catch (err) {
            console.error('取得活動失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    const getFirstImage = (content) => {
        if (!content) return null;
        const div = document.createElement('div');
        div.innerHTML = content;
        const img = div.querySelector('img');
        return img ? img.src : null;
    };

    const getEventStatus = (event) => {
        const now = new Date();
        const deadline = event.formDeadline?.toDate ? event.formDeadline.toDate() : new Date(event.formDeadline);
        const eventTime = event.eventTime?.toDate ? event.eventTime.toDate() : new Date(event.eventTime);
        
        // --- 取得數值 (確保型別與預設值) ---
        const L = Number(event.registrationLimit) || 0;
        const W = Number(event.waitlistLimit || event.waitListLimit || 0);
        const C = Number(event.currentCount) || 0;

        if (now > eventTime) return { label: '活動已結束', color: '#999' };
        if (event.isOnsiteRegistration) return { label: '實體報名', color: '#007130' };
        if (now > deadline) return { label: '報名已截止', color: '#d32f2f' };
        
        if (L <= 0) return { label: '熱烈報名中', color: '#007130' };

        // --- 強力判定邏輯 ---
        // 當前人數已達正取上限
        if (C >= L) {
            // 如果不給候補 (allowWaitlist 為 false)
            if (event.allowWaitlist === false || event.allowWaitlist === 'false') {
                return { label: '報名已額滿', color: '#d32f2f' };
            }

            // 既然開啟候補，檢查候補是否已滿
            if (W > 0) {
                const totalCap = L + W;
                // 如果目前的總報名人數已經達到 總容量
                if (C >= totalCap) {
                    return { label: '報名已額滿', color: '#d32f2f' };
                }
            }
            
            // 剩下的情況：還有候補名額，或是不限人數
            return { label: '報名候補中', color: '#ef6c00' };
        }
        
        return { label: '熱烈報名中', color: '#007130' };
    };

    return (
        <div className="page-container container-860">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    所有實體活動
                </h1>
                {totalCount > 0 && <span className="page-count">共 {totalCount} 個活動</span>}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}>載入中...</div>
            ) : events.length === 0 ? (
                <div className="empty-state">目前沒有實體活動</div>
            ) : (
                <>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
                        gap: '2rem',
                        marginBottom: '3rem'
                    }}>
                        {events.map((event) => {
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
                                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                            </div>
                                        )}
                                        
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
                                                    fontSize: '2rem', 
                                                    fontWeight: '900', 
                                                    letterSpacing: '4px',
                                                    border: '4px solid #fff',
                                                    padding: '12px 24px',
                                                    borderRadius: '8px',
                                                    textShadow: '0 2px 8px rgba(0,0,0,0.5)'
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
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                                zIndex: 3
                                            }}>
                                                {status.label}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: '1.5rem' }}>
                                        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.2rem', fontWeight: '700', lineHeight: '1.5', height: '3em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                            {autoSpace(event.title)}
                                        </h3>
                                        <div style={{ fontSize: '0.9rem', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            活動日期：{event.eventTime?.toDate ? event.eventTime.toDate().toLocaleDateString() : new Date(event.eventTime).toLocaleDateString()}
                                        </div>
                                        {/* 【臨時診斷】確認後刪除 */}
                                        <div style={{ marginTop: '8px', padding: '6px 8px', background: '#fff3cd', borderRadius: '4px', fontSize: '0.75rem', color: '#856404', fontFamily: 'monospace' }}>
                                            正取限:{String(event.registrationLimit)} | 候補限:{String(event.waitlistLimit)} | 已報:{event.currentCount} | 候補開:{String(event.allowWaitlist)}
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button className="pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>← 上一頁</button>
                            <span className="pagination-info">{currentPage} / {totalPages}</span>
                            <button className="pagination-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>下一頁 →</button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default PhysicalEventsPage;
