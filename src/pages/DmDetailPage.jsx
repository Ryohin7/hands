import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { autoSpace } from '../utils/textUtils';

function DmDetailPage() {
    const { id } = useParams();
    const [dm, setDm] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDm() {
            try {
                const docRef = doc(db, 'dms', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setDm({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (err) {
                console.error('取得 DM 詳情失敗:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchDm();
    }, [id]);

    if (loading) return <div className="page-container post-detail-container">載入中...</div>;

    if (!dm) {
        return (
            <div className="page-container post-detail-container">
                <div className="empty-state">
                    <p>找不到此 DM</p>
                    <Link to="/dm" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        返回 DM 列表
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container post-detail-container">
            <Link to="/dm" className="back-link">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                返回 DM 列表
            </Link>

            <article className="post-detail">
                <div className="post-detail-header">
                    <h1 className="post-detail-title">{autoSpace(dm.title)}</h1>
                    <p className="post-detail-date">檔期：{autoSpace(dm.period)}</p>
                </div>
                <div className="dm-detail-image-wrap" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    <img
                        src={dm.dmUrl}
                        alt={dm.title}
                        style={{ maxWidth: '100%', height: 'auto', borderRadius: 'var(--radius)' }}
                    />
                </div>
            </article>
        </div>
    );
}

export default DmDetailPage;
