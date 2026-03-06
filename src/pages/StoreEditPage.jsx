import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

function StoreEditPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState({
        name: '',
        area: '台北',
        address: '',
        phone: '',
        hours: '',
        mapUrl: ''
    });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEdit);

    useEffect(() => {
        if (isEdit) {
            fetchStore();
        }
    }, [id]);

    async function fetchStore() {
        try {
            const docSnap = await getDoc(doc(db, 'stores', id));
            if (docSnap.exists()) {
                setFormData(docSnap.data());
            }
        } catch (err) {
            console.error('讀取門市失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            if (isEdit) {
                await updateDoc(doc(db, 'stores', id), formData);
            } else {
                await addDoc(collection(db, 'stores'), formData);
            }
            navigate('/admin/stores');
        } catch (err) {
            alert('儲存失敗');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="admin-page-content">載入中...</div>;

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">{isEdit ? '編輯門市' : '新增門市'}</h2>
            </div>

            <form onSubmit={handleSubmit} className="edit-form">
                <div className="form-group">
                    <label>門市名稱</label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="例如：京站店"
                    />
                </div>

                <div className="form-group">
                    <label>地區</label>
                    <select value={formData.area} onChange={e => setFormData({ ...formData, area: e.target.value })}>
                        <option value="台北">台北</option>
                        <option value="新北">新北</option>
                        <option value="台中">台中</option>
                        <option value="高雄">高雄</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>地址</label>
                    <input
                        type="text"
                        required
                        value={formData.address}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>電話</label>
                    <input
                        type="text"
                        required
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label>營業時間</label>
                    <input
                        type="text"
                        value={formData.hours}
                        onChange={e => setFormData({ ...formData, hours: e.target.value })}
                        placeholder="例如：11:00~22:00"
                    />
                </div>

                <div className="form-group">
                    <label>Google Maps 網址</label>
                    <input
                        type="url"
                        value={formData.mapUrl}
                        onChange={e => setFormData({ ...formData, mapUrl: e.target.value })}
                    />
                </div>

                <div className="edit-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? '儲存中...' : '儲存門市'}
                    </button>
                    <button type="button" onClick={() => navigate('/admin/stores')} className="btn btn-ghost">取消</button>
                </div>
            </form>
        </div>
    );
}

export default StoreEditPage;
