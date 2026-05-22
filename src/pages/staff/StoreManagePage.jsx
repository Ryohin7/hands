import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    onSnapshot
} from 'firebase/firestore';

function StoreManagePage() {
    const [stores, setStores] = useState([]);
    const [newStore, setNewStore] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'stores'), orderBy('name', 'asc'));
        const unsub = onSnapshot(q, (snapshot) => {
            setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, []);

    const handleAddStore = async (e) => {
        e.preventDefault();
        if (!newStore.trim()) return;
        
        setLoading(true);
        try {
            await addDoc(collection(db, 'stores'), {
                name: newStore.trim(),
                createdAt: new Date()
            });
            setNewStore('');
        } catch (err) {
            console.error(err);
            alert('新增失敗');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteStore = async (id) => {
        if (!window.confirm('確定要刪除此門市嗎？ 這不會刪除已註冊的員工資料，但新進員工將無法選擇此門市。')) return;
        try {
            await deleteDoc(doc(db, 'stores', id));
        } catch (err) {
            console.error(err);
            alert('刪除失敗');
        }
    };

    return (
        <div className="admin-page-content store-manage-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">網站管理 - 門市維護</h2>
            </div>

            <div className="card add-store-card">
                <h3 className="card-subtitle">新增門市</h3>
                <form onSubmit={handleAddStore} className="add-store-form">
                    <div className="form-group inline-form-group">
                        <input 
                            type="text" 
                            className="form-control"
                            value={newStore}
                            onChange={(e) => setNewStore(e.target.value)}
                            placeholder="輸入門市名稱 (例如：南港店)"
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? '處理中...' : '新增'}
                    </button>
                </form>
            </div>

            <div className="card list-card">
                <div className="card-header">
                    <h3 className="card-title">現有門市清單 ({stores.length})</h3>
                </div>
                <div className="admin-table-wrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>門市名稱</th>
                                <th className="col-actions">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stores.length === 0 ? (
                                <tr>
                                    <td colSpan="2" className="table-empty">目前無門市資料</td>
                                </tr>
                            ) : (
                                stores.map(store => (
                                    <tr key={store.id}>
                                        <td className="cell-name">{store.name}</td>
                                        <td>
                                            <button 
                                                className="btn btn-sm btn-outline btn-delete" 
                                                onClick={() => handleDeleteStore(store.id)}
                                            >
                                                刪除
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .store-manage-page .add-store-card {
                    padding: 1.5rem;
                    margin-bottom: 2rem;
                }
                .store-manage-page .card-subtitle {
                    margin-bottom: 1rem;
                }
                .store-manage-page .add-store-form {
                    display: flex;
                    gap: 1rem;
                }
                .store-manage-page .inline-form-group {
                    flex: 1;
                    margin-bottom: 0;
                }
                .store-manage-page .card-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #eee;
                }
                .store-manage-page .card-title {
                    margin: 0;
                }
                .store-manage-page .col-actions {
                    width: 100px;
                }
                .store-manage-page .cell-name {
                    font-weight: 500;
                }
                .store-manage-page .table-empty {
                    text-align: center;
                    padding: 2rem;
                    color: #999;
                }
                .store-manage-page .btn-delete {
                    color: #800019;
                    border-color: #800019;
                }
            `}} />
        </div>
    );
}

export default StoreManagePage;
