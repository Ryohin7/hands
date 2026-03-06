import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, deleteDoc, doc, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULT_STORES = [
    { name: '京站店', area: '台北', address: '台北市大同區承德路一段1號3F', phone: '(02) 25503688', hours: '平日 11:00~21:30 / 假日 11:00~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台北市大同區承德路一段1號' },
    { name: 'SOGO復興店', area: '台北', address: '台北市大安區忠孝東路三段300號 (SOGO復興館8樓)', phone: '(02) 87720660', hours: '平日 11:00~21:30 / 假日 11:00~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台北市大安區忠孝東路三段300號' },
    { name: '美麗華店', area: '台北', address: '台北市中山區敬業三路20號3F', phone: '(02) 85023708', hours: '11:00~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台北市中山區敬業三路20號' },
    { name: '板橋大遠百店', area: '新北', address: '新北市板橋區新站路28號7F', phone: '(02) 89510988', hours: '平日 11:00~22:00 / 假日 11:00~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=新北市板橋區新站路28號' },
    { name: 'LaLaport南港店', area: '台北', address: '台北市南港區經貿二路131號3樓', phone: '(02) 26512066', hours: '平日 11:00~21:30 / 假日 11:00~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台北市南港區經貿二路131號' },
    { name: '台中LALAPORT店', area: '台中', address: '台中市東區進德路700號2F', phone: '(04) 22111610', hours: '週一~週五 11:00~22:00 / 週六~週日 10:30~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台中市東區進德路700號' },
    { name: '廣三SOGO店', area: '台中', address: '台中市西區台灣大道二段459號B1F', phone: '(04) 23292386', hours: '週一~週四 11:00~22:00 / 週五 11:00~22:30 / 週六 10:30~22:30 / 週日 10:30~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台中市西區台灣大道二段459號' },
    { name: '台中大遠百店', area: '台中', address: '台中市西屯區台灣大道三段251號9F', phone: '(04) 22592205', hours: '平日 11:00~22:00 / 假日 10:30~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台中市西屯區台灣大道三段251號' },
    { name: '新光三越 台中中港店', area: '台中', address: '台中市西屯區台灣大道三段301號8樓', phone: '(04) 22586606', hours: '平日 11:00~22:00 / 假日 10:30~22:00', mapUrl: 'https://www.google.com/maps/search/?api=1&query=台中市西屯區台灣大道三段301號' },
];

function StoreAdminPage() {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchStores();
    }, []);

    async function fetchStores() {
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
    }

    async function handleImportDefaults() {
        if (!window.confirm('將匯入 9 間預設門市資料，是否繼續？')) return;
        setImporting(true);
        try {
            for (const store of DEFAULT_STORES) {
                await addDoc(collection(db, 'stores'), store);
            }
            alert('匯入完成！');
            fetchStores();
        } catch (err) {
            alert('匯入失敗');
        } finally {
            setImporting(false);
        }
    }

    async function handleDelete(id, name) {
        if (!window.confirm(`確定要刪除「${name}」嗎？`)) return;
        try {
            await deleteDoc(doc(db, 'stores', id));
            setStores(stores.filter(s => s.id !== id));
        } catch (err) {
            alert('刪除失敗');
        }
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">門市資訊管理</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {stores.length === 0 && !loading && (
                        <button onClick={handleImportDefaults} className="btn btn-ghost" disabled={importing}>
                            {importing ? '匯入中...' : '匯入預設門市'}
                        </button>
                    )}
                    <Link to="/admin/stores/edit" className="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        新增門市
                    </Link>
                </div>
            </div>

            {loading ? (
                <div className="loading-container"><div className="loading-spinner"></div></div>
            ) : (
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>門市名稱</th>
                                <th>地區</th>
                                <th>電話</th>
                                <th>地址</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stores.map(store => (
                                <tr key={store.id}>
                                    <td className="font-medium">{store.name}</td>
                                    <td><span className="category-tag">{store.area}</span></td>
                                    <td>{store.phone}</td>
                                    <td className="text-dim">{store.address}</td>
                                    <td>
                                        <div className="table-actions">
                                            <Link to={`/admin/stores/edit/${store.id}`} className="btn-icon" title="編輯">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </Link>
                                            <button onClick={() => handleDelete(store.id, store.name)} className="btn-icon btn-delete" title="刪除">
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

export default StoreAdminPage;
