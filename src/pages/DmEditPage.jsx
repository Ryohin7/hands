import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

function DmEditPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState({
        title: '',
        period: '',
        bannerUrl: '',
        dmUrl: ''
    });
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(isEdit);

    useEffect(() => {
        if (isEdit) {
            fetchDm();
        }
    }, [id]);

    async function fetchDm() {
        try {
            const docSnap = await getDoc(doc(db, 'dms', id));
            if (docSnap.exists()) {
                setFormData(docSnap.data());
            }
        } catch (err) {
            console.error('讀取 DM 失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setSaving(true);
        try {
            const data = { ...formData, updatedAt: serverTimestamp() };
            if (isEdit) {
                await updateDoc(doc(db, 'dms', id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'dms'), data);
            }
            navigate('/admin/dm');
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
                <h2 className="admin-content-title">{isEdit ? '編輯 DM' : '新增 DM 檔期'}</h2>
            </div>

            <form onSubmit={handleSubmit} className="edit-form">
                <div className="form-group">
                    <label>標題</label>
                    <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        placeholder="例如：2024 春季賞"
                    />
                </div>

                <div className="form-group">
                    <label>檔期時間</label>
                    <input
                        type="text"
                        required
                        value={formData.period}
                        onChange={e => setFormData({ ...formData, period: e.target.value })}
                        placeholder="例如：3/1 - 3/31"
                    />
                </div>

                <div className="form-group">
                    <label>橫幅小 BANNER 圖片網址</label>
                    <input
                        type="url"
                        required
                        value={formData.bannerUrl}
                        onChange={e => setFormData({ ...formData, bannerUrl: e.target.value })}
                        placeholder="https://..."
                    />
                </div>

                <div className="form-group">
                    <label>DM 圖片網址</label>
                    <input
                        type="url"
                        required
                        value={formData.dmUrl}
                        onChange={e => setFormData({ ...formData, dmUrl: e.target.value })}
                        placeholder="https://..."
                    />
                </div>

                <div className="edit-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? '儲存中...' : '儲存 DM'}
                    </button>
                    <button type="button" onClick={() => navigate('/admin/dm')} className="btn btn-ghost">取消</button>
                </div>
            </form>
        </div>
    );
}

export default DmEditPage;
