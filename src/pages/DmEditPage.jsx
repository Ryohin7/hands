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
        startDate: '', // 用於排序
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
                <div className="edit-section-card">
                    <h3 className="edit-section-title">DM 檔期資訊</h3>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>標題</label>
                        <input
                            type="text"
                            required
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            placeholder="例如：2024 春季賞"
                            className="input-lg"
                            style={{ fontSize: '1.25rem', fontWeight: 'bold' }}
                        />
                    </div>

                    <div className="edit-grid">
                        <div className="form-group">
                            <label>檔期時間文字 (顯示用)</label>
                            <input
                                type="text"
                                required
                                value={formData.period}
                                onChange={e => setFormData({ ...formData, period: e.target.value })}
                                placeholder="例如：3/1 - 3/31"
                            />
                        </div>

                        <div className="form-group">
                            <label>排序用日期 (最新的會排在最上方)</label>
                            <input
                                type="date"
                                required
                                value={formData.startDate}
                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="edit-section-card">
                    <h3 className="edit-section-title">素材網址</h3>
                    <div className="edit-grid">
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
                            <label>DM 點擊圖片連結 (或原圖網址)</label>
                            <input
                                type="url"
                                required
                                value={formData.dmUrl}
                                onChange={e => setFormData({ ...formData, dmUrl: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                    
                    {formData.bannerUrl && (
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8f8f8', borderRadius: '8px', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>橫幅預覽</p>
                            <img src={formData.bannerUrl} alt="banner" style={{ maxWidth: '100%', height: 'auto', maxHeight: '100px' }} />
                        </div>
                    )}
                </div>

                <div className="edit-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'4px'}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                        {saving ? '儲存中...' : '儲存 DM 檔期'}
                    </button>
                    <button type="button" onClick={() => navigate('/admin/dm')} className="btn btn-ghost">取消</button>
                </div>
            </form>
        </div>
    );
}

export default DmEditPage;
