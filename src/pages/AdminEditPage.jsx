import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import TiptapEditor from '../components/TiptapEditor';

function AdminEditPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('公告');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scheduledAt, setScheduledAt] = useState('');
    const [useSchedule, setUseSchedule] = useState(false);
    const [pinned, setPinned] = useState(false);

    const categories = ['公告', '活動', '新聞稿'];

    useEffect(() => {
        if (isEdit) {
            fetchPost();
        } else {
            setLoading(false);
        }
    }, [id]);

    async function fetchPost() {
        try {
            const docSnap = await getDoc(doc(db, 'posts', id));
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTitle(data.title || '');
                setContent(data.content || '');
                // 舊分類映射到新分類
                const oldToNew = { '一般': '公告', '重要': '公告', '緊急': '公告' };
                setCategory(oldToNew[data.category] || data.category || '公告');
                setPinned(!!data.pinned);

                if (data.scheduledAt) {
                    setUseSchedule(true);
                    const d = data.scheduledAt.toDate ? data.scheduledAt.toDate() : new Date(data.scheduledAt);
                    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setScheduledAt(local);
                }
            }
        } catch (err) {
            console.error('取得公告失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave(status) {
        if (!title.trim()) {
            alert('請輸入標題');
            return;
        }
        if (useSchedule && !scheduledAt) {
            alert('請選擇排程時間');
            return;
        }
        setSaving(true);
        try {
            const postData = {
                title: title.trim(),
                content,
                category,
                status,
                pinned,
                updatedAt: serverTimestamp(),
            };

            if (useSchedule && scheduledAt) {
                postData.scheduledAt = Timestamp.fromDate(new Date(scheduledAt));
            } else {
                postData.scheduledAt = null;
            }

            if (isEdit) {
                await updateDoc(doc(db, 'posts', id), postData);
            } else {
                postData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'posts'), postData);
            }

            navigate('/admin');
        } catch (err) {
            console.error('儲存失敗:', err);
            alert('儲存失敗，請重試');
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="admin-page-content">
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p>載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">{isEdit ? '編輯公告' : '新增公告'}</h2>
            </div>

            <div className="edit-form">
                <div className="form-group">
                    <label htmlFor="edit-title">標題</label>
                    <input
                        id="edit-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="請輸入公告標題"
                        className="input-lg"
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="edit-category">分類</label>
                    <select
                        id="edit-category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        {categories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <div className="schedule-toggle">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={pinned}
                                onChange={(e) => setPinned(e.target.checked)}
                            />
                            <span>📌 置頂公告</span>
                        </label>
                        {pinned && (
                            <span className="schedule-hint">此公告將顯示在列表最上方</span>
                        )}
                    </div>
                </div>

                <div className="form-group">
                    <div className="schedule-toggle">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={useSchedule}
                                onChange={(e) => {
                                    setUseSchedule(e.target.checked);
                                    if (!e.target.checked) setScheduledAt('');
                                }}
                            />
                            <span>排程發布</span>
                        </label>
                        {useSchedule && (
                            <span className="schedule-hint">設定時間到時自動上刊</span>
                        )}
                    </div>
                    {useSchedule && (
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="schedule-input"
                        />
                    )}
                </div>

                <div className="form-group">
                    <label>內容詳情</label>
                    <TiptapEditor 
                        content={content} 
                        onChange={setContent} 
                        placeholder="請輸入公告詳情..."
                    />
                </div>

                <div className="edit-actions">
                    <button
                        onClick={() => handleSave('draft')}
                        className="btn btn-outline"
                        disabled={saving}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        {saving ? '儲存中...' : '存為草稿'}
                    </button>
                    <button
                        onClick={() => handleSave('published')}
                        className="btn btn-primary"
                        disabled={saving}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {saving ? '發布中...' : (useSchedule ? '排程發布' : '發布公告')}
                    </button>
                    <button
                        onClick={() => navigate('/admin')}
                        className="btn btn-ghost"
                        disabled={saving}
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AdminEditPage;
