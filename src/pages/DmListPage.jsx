import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { autoSpace } from '../utils/textUtils';

function DmListPage() {
    const [dms, setDms] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDms = async () => {
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
        };
        fetchDms();
    }, []);

    if (loading) return <div className="page-container post-detail-container">載入中...</div>;

    return (
        <div className="page-container post-detail-container">
            <h1 className="page-title">最新 DM / 檔期</h1>

            <div className="dm-grid">
                {dms.map(dm => (
                    <div key={dm.id} className="dm-card">
                        <div className="dm-banner-wrap">
                            <img src={dm.bannerUrl} alt={dm.title} className="dm-banner-img" />
                        </div>
                        <div className="dm-info">
                             <h3 className="dm-title">{autoSpace(dm.title)}</h3>
                             <p className="dm-period">檔期：{autoSpace(dm.period)}</p>
                            <Link to={`/dm/${dm.id}`} className="btn btn-outline btn-sm">
                                查看線上 DM
                            </Link>
                        </div>
                    </div>
                ))}
                {dms.length === 0 && <p>目前沒有上架的 DM。</p>}
            </div>
        </div>
    );
}

export default DmListPage;
