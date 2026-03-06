import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import TiptapEditor from '../components/TiptapEditor';

function CustomPageEditPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [title, setTitle] = useState('');
    const [pathId, setPathId] = useState(''); // 即 Document ID
    const [content, setContent] = useState('');
    const [status, setStatus] = useState('published');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isEdit) {
            setPathId(id);
            fetchPage();
        } else {
            setLoading(false);
        }
    }, [id]);

    async function fetchPage() {
        try {
            const docSnap = await getDoc(doc(db, 'custom_pages', id));
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTitle(data.title || '');
                setContent(data.content || '');
                setStatus(data.status || 'published');
            }
        } catch (err) {
            console.error('取得頁面失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!title.trim()) return alert('請輸入標題');
        if (!pathId.trim()) return alert('請輸入頁面路徑ID');
        
        if (!/^[a-zA-Z0-9_-]+$/.test(pathId)) {
            return alert('頁面路徑ID 僅允許英文、數字、底線或破折號');
        }

        setSaving(true);
        try {
            const pageData = {
                title: title.trim(),
                content,
                status,
                updatedAt: serverTimestamp(),
            };

            if (isEdit && pathId !== id) {
                const checkNew = await getDoc(doc(db, 'custom_pages', pathId));
                if (checkNew.exists()) {
                    setSaving(false);
                    return alert('此頁面路徑ID已被使用，請更換一個');
                }
                const oldDoc = await getDoc(doc(db, 'custom_pages', id));
                const oldData = oldDoc.data();
                await deleteDoc(doc(db, 'custom_pages', id));
                await setDoc(doc(db, 'custom_pages', pathId), { ...oldData, ...pageData });
            } else if (!isEdit) {
                const checkNew = await getDoc(doc(db, 'custom_pages', pathId));
                if (checkNew.exists()) {
                    setSaving(false);
                    return alert('此頁面路徑ID標籤已存在');
                }
                pageData.createdAt = serverTimestamp();
                await setDoc(doc(db, 'custom_pages', pathId), pageData);
            } else {
                await setDoc(doc(db, 'custom_pages', id), pageData, { merge: true });
            }
            
            navigate('/admin/pages');
        } catch (err) {
            console.error('儲存失敗:', err);
            alert('儲存失敗');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div className="admin-page-content">載入中...</div>;

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">{isEdit ? '編輯頁面' : '新增頁面'}</h2>
            </div>

            <div className="edit-form">
                <div className="form-group">
                    <label>頁面標題</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="請輸入頁面標題"
                        className="input-lg"
                    />
                </div>

                <div className="form-group">
                    <label>頁面路徑 ID (網址標籤)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#666' }}>/p/</span>
                        <input
                            type="text"
                            value={pathId}
                            onChange={(e) => setPathId(e.target.value)}
                            placeholder="例如: about-us"
                            className="input-lg"
                            style={{ flex: 1 }}
                        />
                    </div>
                    <p className="editor-hint">⚠️ 修改此 ID 會導致原本連向此頁面的鏈結失效</p>
                </div>

                <div className="form-group">
                    <label>上架狀態</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="published">正式發布 (已上檔)</option>
                        <option value="draft">儲存草稿 (下檔中)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>內容詳情</label>
                    <TiptapEditor 
                        content={content} 
                        onChange={setContent} 
                        placeholder="請輸入頁面詳情內容..."
                    />
                </div>

                <div className="edit-actions">
                    <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                        {saving ? '儲存中...' : '儲存頁面'}
                    </button>
                    <button onClick={() => navigate('/admin/pages')} className="btn btn-ghost" disabled={saving}>
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CustomPageEditPage;
