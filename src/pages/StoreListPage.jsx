import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

function StoreListPage() {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedArea, setSelectedArea] = useState('全部');

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const q = query(collection(db, 'stores'), orderBy('name', 'asc'));
                const querySnapshot = await getDocs(q);
                const storeData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setStores(storeData);
            } catch (err) {
                console.error('讀取門市失敗:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStores();
    }, []);

    const areas = ['全部', ...new Set(stores.map(s => s.area).filter(Boolean))];

    const filteredStores = selectedArea === '全部'
        ? stores
        : stores.filter(s => s.area === selectedArea);

    if (loading) {
        return (
            <div className="admin-page-content">
                <div className="loading-container"><div className="loading-spinner"></div><p>門市載入中...</p></div>
            </div>
        );
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">門市資訊</h2>
                <span className="store-count">共 {filteredStores.length} 間門市</span>
            </div>

            {/* 地區篩選 */}
            <div className="store-filters">
                {areas.map(area => (
                    <button
                        key={area}
                        className={`store-filter-btn ${selectedArea === area ? 'active' : ''}`}
                        onClick={() => setSelectedArea(area)}
                    >
                        {area}
                    </button>
                ))}
            </div>

            {/* 門市列表 */}
            <div className="store-grid">
                {filteredStores.map((store, index) => (
                    <div
                        className="store-card"
                        key={store.id}
                        style={{ animationDelay: `${index * 0.05}s` }}
                    >
                        <div className="store-card-header">
                            <h3 className="store-card-name">{store.name}</h3>
                            <span className="store-card-area">{store.area}</span>
                        </div>
                        <div className="store-card-body">
                            <div className="store-info-row">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>{store.address}</span>
                            </div>
                            <div className="store-info-row">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                <a href={`tel:${(store.phone || '').replace(/[() ]/g, '')}`} className="store-phone">{store.phone || '尚未提供電話'}</a>
                            </div>
                            <div className="store-info-row">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>{store.hours}</span>
                            </div>
                        </div>
                        {store.mapUrl && (
                            <div className="store-card-footer">
                                <a
                                    href={store.mapUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="store-map-btn"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                                    </svg>
                                    Google Maps
                                </a>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default StoreListPage;
