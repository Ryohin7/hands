import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp, Timestamp, query, where, orderBy, limit, getDocs, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import TiptapEditor from '../components/TiptapEditor';
import { autoSpace } from '../utils/textUtils';
import DOMPurify from 'dompurify';

function AdminEditPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('公告');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [scheduledAt, setScheduledAt] = useState('');
    const [useSchedule, setUseSchedule] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [formDeadline, setFormDeadline] = useState('');

    const [eventTime, setEventTime] = useState(() => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    });
    const [registrationLimit, setRegistrationLimit] = useState('');
    const [allowWaitlist, setAllowWaitlist] = useState(true);
    const [isOnsiteRegistration, setIsOnsiteRegistration] = useState(false);

    const categories = ['公告', '檔期活動', '新聞發佈', '中獎名單公告', '實體活動'];

    // 處理分類切換
    const handleCategoryChange = (e) => {
        const selected = e.target.value;
        setCategory(selected);
        if ((selected === '中獎名單公告' || selected === '實體活動') && !formDeadline && !isEdit) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
            setFormDeadline(`${currentYear}-${currentMonth}-01T23:59:59`);
        }
    };

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
                setSubtitle(data.subtitle || '');
                setContent(data.content || '');
                setCategory(data.category || '公告');
                setPinned(!!data.pinned);
                setRegistrationLimit(data.registrationLimit || '');
                setAllowWaitlist(data.allowWaitlist !== false);
                setIsOnsiteRegistration(!!data.isOnsiteRegistration);

                if (data.scheduledAt) {
                    setUseSchedule(true);
                    const d = data.scheduledAt.toDate ? data.scheduledAt.toDate() : new Date(data.scheduledAt);
                    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setScheduledAt(local);
                }

                if (data.formDeadline) {
                    const d = data.formDeadline.toDate ? data.formDeadline.toDate() : new Date(data.formDeadline);
                    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    setFormDeadline(local);
                }

                if (data.eventTime) {
                    const d = data.eventTime.toDate ? data.eventTime.toDate() : new Date(data.eventTime);
                    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                    setEventTime(local);
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
        if ((category === '中獎名單公告' || category === '實體活動') && !formDeadline && !isOnsiteRegistration) {
            alert('請選擇表單填寫截止時間');
            return;
        }
        if (category === '實體活動' && !eventTime) {
            alert('請選擇活動時間');
            return;
        }
        setSaving(true);
        try {
            const postData = {
                title: title.trim(),
                subtitle: subtitle.trim(),
                content,
                category,
                status,
                pinned,
                updatedAt: serverTimestamp(),
                registrationLimit: category === '實體活動' ? (parseInt(registrationLimit) || 0) : null,
                allowWaitlist: category === '實體活動' ? allowWaitlist : null,
                isOnsiteRegistration: category === '實體活動' ? isOnsiteRegistration : false,
            };

            if (useSchedule && scheduledAt) {
                postData.scheduledAt = Timestamp.fromDate(new Date(scheduledAt));
            } else {
                postData.scheduledAt = null;
            }

            if ((category === '中獎名單公告' || category === '實體活動') && formDeadline) {
                postData.formDeadline = Timestamp.fromDate(new Date(formDeadline));
            } else {
                postData.formDeadline = null;
            }

            if (category === '實體活動' && eventTime) {
                postData.eventTime = Timestamp.fromDate(new Date(eventTime));
            } else {
                postData.eventTime = null;
            }

            if (isEdit) {
                await updateDoc(doc(db, 'posts', id), postData);
            } else {
                postData.createdAt = serverTimestamp();
                
                // 產生 yymm 序號 (如: 240301)
                const now = new Date();
                const yy = String(now.getFullYear()).slice(-2);
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const prefix = `${yy}${mm}`;

                const q = query(
                    collection(db, 'posts'),
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
                
                const newId = `${prefix}${String(nextSeq).padStart(2, '0')}`;
                await setDoc(doc(db, 'posts', newId), postData);
            }

            navigate('/admin');
        } catch (err) {
            console.error('儲存失敗:', err);
            alert('儲存失敗，請重試');
        } finally {
            setSaving(false);
        }
    }

    // 同步 PostDetailPage 的清理邏輯
    function sanitizeHtml(html) {
        if (!html) return '';
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'br', 'hr',
                'strong', 'b', 'em', 'i', 'u', 's', 'strike',
                'ul', 'ol', 'li',
                'a', 'img',
                'blockquote', 'pre', 'code', 'mark',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'span', 'div', 'sub', 'sup',
            ],
            ALLOWED_ATTR: [
                'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
                'style', 'class', 'colspan', 'rowspan',
            ],
            ALLOW_DATA_ATTR: false,
        });
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
                <button
                    onClick={() => setShowPreview(!showPreview)}
                    className={`btn ${showPreview ? 'btn-primary' : 'btn-outline'}`}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    {showPreview ? '返回編輯' : '預覽公告'}
                </button>
            </div>

            {showPreview ? (
                <div className="page-container preview-mode" style={{ background: '#fff', marginTop: '1rem', borderRadius: '8px', border: '1px solid #eee' }}>
                    <article className="post-detail">
                        <div className="post-detail-header">
                            {category && <span className="post-detail-category">{category}</span>}
                            <h1 className="post-detail-title">{autoSpace(title || '（未輸入標題）')}</h1>
                            {subtitle && <h2 className="post-detail-subtitle">{autoSpace(subtitle)}</h2>}
                            <div className="post-detail-date">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                預覽模式 - 尚未發布
                            </div>
                        </div>
                        <div
                            className="post-detail-content ql-editor"
                            dangerouslySetInnerHTML={{ __html: autoSpace(sanitizeHtml(content)) }}
                        />
                    </article>
                </div>
            ) : (
                <div className="edit-form">
                    <div className="edit-section-card">
                        <h3 className="edit-section-title">基本內容</h3>
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label htmlFor="edit-title">主標題</label>
                            <input
                                id="edit-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="請輸入主標題"
                                className="input-lg"
                                style={{ fontSize: '1.25rem', fontWeight: 'bold' }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label htmlFor="edit-subtitle">副標題</label>
                            <input
                                id="edit-subtitle"
                                type="text"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                placeholder="請輸入副標題"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="edit-category">分類</label>
                            <select id="edit-category" value={category} onChange={handleCategoryChange}>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="edit-grid">
                        <div className="edit-section-card">
                            <h3 className="edit-section-title">發布與狀態</h3>
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <div className="schedule-toggle">
                                    <label className="toggle-label">
                                        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                                        <span>📌 置頂公告</span>
                                    </label>
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
                                </div>
                                {useSchedule && (
                                    <input
                                        type="datetime-local"
                                        value={scheduledAt}
                                        onChange={(e) => setScheduledAt(e.target.value)}
                                        className="schedule-input"
                                        style={{ marginTop: '0.75rem' }}
                                    />
                                )}
                            </div>
                        </div>

                        {(category === '中獎名單公告' || category === '實體活動') && (
                            <div className="edit-section-card">
                                <h3 className="edit-section-title">特殊設定</h3>
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="edit-form-deadline" style={{ color: '#d32f2f' }}>表單填寫截止時間</label>
                                    <input
                                        id="edit-form-deadline"
                                        type="datetime-local"
                                        step="1"
                                        value={formDeadline}
                                        onChange={(e) => setFormDeadline(e.target.value)}
                                        className="schedule-input"
                                    />
                                </div>

                                {category === '實體活動' && (
                                    <>
                                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                            <label htmlFor="edit-event-time" style={{ color: '#007130' }}>活動開始日期</label>
                                            <input
                                                id="edit-event-time"
                                                type="date"
                                                value={eventTime}
                                                onChange={(e) => setEventTime(e.target.value)}
                                                className="schedule-input"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="edit-registration-limit" style={{ color: '#007130' }}>報名人數限制</label>
                                            <input
                                                id="edit-registration-limit"
                                                type="number"
                                                value={registrationLimit}
                                                onChange={(e) => setRegistrationLimit(e.target.value)}
                                                placeholder="0 表示不限制"
                                                className="input-md"
                                                disabled={isOnsiteRegistration}
                                            />
                                            <div className="schedule-toggle" style={{ marginTop: '1rem' }}>
                                                <label className="toggle-label" style={{ color: '#007130' }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isOnsiteRegistration} 
                                                        onChange={(e) => setIsOnsiteRegistration(e.target.checked)} 
                                                    />
                                                    <span>現場報名（無需填寫表單）</span>
                                                </label>
                                            </div>
                                            {!isOnsiteRegistration && (
                                                <div className="schedule-toggle" style={{ marginTop: '0.75rem' }}>
                                                    <label className="toggle-label" style={{ color: '#007130' }}>
                                                        <input type="checkbox" checked={allowWaitlist} onChange={(e) => setAllowWaitlist(e.target.checked)} />
                                                        <span>開放候補登記</span>
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="edit-section-card">
                        <h3 className="edit-section-title">內文詳情</h3>
                        <TiptapEditor
                            content={content}
                            onChange={setContent}
                            placeholder="請輸入公告詳情..."
                        />
                    </div>

                    <div className="edit-actions">
                        <button onClick={() => handleSave('draft')} className="btn btn-outline" disabled={saving}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                            存為草稿
                        </button>
                        <button onClick={() => handleSave('published')} className="btn btn-primary" disabled={saving}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            {useSchedule ? '排程發布' : '發布公告'}
                        </button>
                        <button onClick={() => navigate('/admin')} className="btn btn-ghost" disabled={saving}>取消</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminEditPage;
