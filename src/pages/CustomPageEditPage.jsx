import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import TiptapEditor from '../components/TiptapEditor';

function CustomPageEditPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState(''); // 新增
    const [category, setCategory] = useState(''); // 新增
    const [pathId, setPathId] = useState(''); // 即 Document ID
    const [content, setContent] = useState('');
    const [status, setStatus] = useState('published');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const categories = ['公告', '活動', '新聞發佈', '頁面']; // 可選

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
                setSubtitle(data.subtitle || '');
                setCategory(data.category || '');
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
                subtitle: subtitle.trim(),
                category: category,
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
                let newPathId = pathId.trim();
                
                // 若未手動填寫路徑 ID，自動產生 yymm 序號 (如 240301)
                if (!newPathId) {
                    const now = new Date();
                    const yy = String(now.getFullYear()).slice(-2);
                    const mm = String(now.getMonth() + 1).padStart(2, '0');
                    const prefix = `${yy}${mm}`;

                    const q = query(
                        collection(db, 'custom_pages'),
                        where(documentId(), '>=', prefix),
                        where(documentId(), '<=', prefix + '\uf8ff'),
                        orderBy(documentId(), 'desc'),
                        limit(1)
                    );
                    
                    const snap = await getDocs(q);
                    let nextSeq = 1;
                    
                    if (!snap.empty) {
                        const lastId = snap.docs[0].id;
                        const seqStr = lastId.replace(prefix, '');
                        const lastSeq = parseInt(seqStr, 10);
                        if (!isNaN(lastSeq)) {
                            nextSeq = lastSeq + 1;
                        }
                    }
                    newPathId = `${prefix}${String(nextSeq).padStart(2, '0')}`;
                } else {
                    const checkNew = await getDoc(doc(db, 'custom_pages', newPathId));
                    if (checkNew.exists()) {
                        setSaving(false);
                        return alert('此頁面路徑ID標籤已存在');
                    }
                }
                
                pageData.createdAt = serverTimestamp();
                await setDoc(doc(db, 'custom_pages', newPathId), pageData);
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
                <div className="edit-section-card">
                    <h3 className="edit-section-title">頁面基本資訊</h3>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>頁面標題</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="請輸入頁面標題"
                            className="input-lg"
                            style={{ fontSize: '1.25rem', fontWeight: 'bold' }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>副標題 (可選)</label>
                        <input
                            type="text"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            placeholder="請輸入副標題"
                        />
                    </div>

                    <div className="edit-grid">
                        <div className="form-group">
                            <label>頁面路徑 ID (網址標記)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#666', fontWeight: 'bold' }}>/p/</span>
                                <input
                                    type="text"
                                    value={pathId}
                                    onChange={(e) => setPathId(e.target.value)}
                                    placeholder={isEdit ? "例如: about-us" : "未填寫將自動產生 (yymm01)"}
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>分類 (可選)</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                <option value="">（不設定分類）</option>
                                {categories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>上架狀態</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="published">正式發布 (已上檔)</option>
                                <option value="draft">儲存草稿 (下檔中)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="edit-section-card">
                    <h3 className="edit-section-title">自定義內容</h3>
                    <TiptapEditor 
                        content={content} 
                        onChange={setContent} 
                        placeholder="請輸入頁面詳情內容..."
                    />
                </div>

                <div className="edit-actions">
                    <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'4px'}}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                        {saving ? '儲存中...' : '儲存頁面設定'}
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
