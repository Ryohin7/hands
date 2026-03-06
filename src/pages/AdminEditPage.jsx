import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

// 動態載入 React Quill
let ReactQuill = null;

function AdminEditPage() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);
    const quillRef = useRef(null);

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('公告');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [quillLoaded, setQuillLoaded] = useState(false);
    const [scheduledAt, setScheduledAt] = useState('');
    const [useSchedule, setUseSchedule] = useState(false);
    const [pinned, setPinned] = useState(false);

    const categories = ['公告', '活動', '新聞稿'];

    // 動態載入 Quill
    useEffect(() => {
        async function loadQuill() {
            const mod = await import('react-quill-new');
            ReactQuill = mod.default;
            await import('react-quill-new/dist/quill.snow.css');
            setQuillLoaded(true);
        }
        loadQuill();
    }, []);

    // 圖片縮放功能
    useEffect(() => {
        if (!quillLoaded || !quillRef.current) return;

        // 延遲綁定，確保 Quill 編輯器已完全渲染
        const timer = setTimeout(() => {
            const editor = quillRef.current?.getEditor?.();
            if (!editor) return;

            const editorEl = editor.root;
            if (!editorEl) return;

            let resizing = null;
            let startX = 0;
            let startWidth = 0;

            function isNearRightEdge(img, clientX) {
                const rect = img.getBoundingClientRect();
                return clientX > rect.right - 15;
            }

            function onMouseDown(e) {
                if (e.target.tagName === 'IMG' && isNearRightEdge(e.target, e.clientX)) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = e.target;
                    startX = e.clientX;
                    startWidth = resizing.offsetWidth;
                    resizing.style.cursor = 'col-resize';
                    resizing.classList.add('resizing');
                    showSizeTooltip(resizing);
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                }
            }

            function onMouseMove(e) {
                if (!resizing) {
                    // 當滑鼠在圖片右邊緣時改變游標
                    const imgs = editorEl.querySelectorAll('img');
                    imgs.forEach(img => {
                        if (isNearRightEdge(img, e.clientX)) {
                            img.style.cursor = 'col-resize';
                        } else {
                            img.style.cursor = '';
                        }
                    });
                    return;
                }
                e.preventDefault();
                const diff = e.clientX - startX;
                const newWidth = Math.max(50, startWidth + diff);
                resizing.style.width = newWidth + 'px';
                resizing.style.height = 'auto';
                updateSizeTooltip(resizing, newWidth);
            }

            function onMouseUp() {
                if (resizing) {
                    resizing.style.cursor = '';
                    resizing.classList.remove('resizing');
                    removeSizeTooltip();
                    resizing = null;
                }
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }

            function onDblClick(e) {
                if (e.target.tagName === 'IMG') {
                    e.preventDefault();
                    e.stopPropagation();
                    showImageSizeDialog(e.target);
                }
            }

            editorEl.addEventListener('mousedown', onMouseDown);
            editorEl.addEventListener('mousemove', onMouseMove);
            editorEl.addEventListener('dblclick', onDblClick);

            // 存到 ref 以便清理
            quillRef.current._cleanupResize = () => {
                editorEl.removeEventListener('mousedown', onMouseDown);
                editorEl.removeEventListener('mousemove', onMouseMove);
                editorEl.removeEventListener('dblclick', onDblClick);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
        }, 500);

        return () => {
            clearTimeout(timer);
            if (quillRef.current?._cleanupResize) {
                quillRef.current._cleanupResize();
            }
        };
    }, [quillLoaded]);

    function showSizeTooltip(img) {
        removeSizeTooltip();
        const tooltip = document.createElement('div');
        tooltip.className = 'img-size-tooltip';
        tooltip.textContent = `${Math.round(img.offsetWidth)}px`;
        img.parentNode.style.position = 'relative';
        img.parentNode.appendChild(tooltip);
        const rect = img.getBoundingClientRect();
        const parentRect = img.parentNode.getBoundingClientRect();
        tooltip.style.left = (rect.left - parentRect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = (rect.top - parentRect.top - 30) + 'px';
    }

    function updateSizeTooltip(img, width) {
        const tooltip = img.parentNode.querySelector('.img-size-tooltip');
        if (tooltip) {
            tooltip.textContent = `${Math.round(width)}px`;
        }
    }

    function removeSizeTooltip() {
        document.querySelectorAll('.img-size-tooltip').forEach(el => el.remove());
    }

    function showImageSizeDialog(img) {
        const currentWidth = img.offsetWidth;
        const input = prompt('請輸入圖片寬度 (px)：', currentWidth);
        if (input !== null) {
            const newWidth = parseInt(input, 10);
            if (!isNaN(newWidth) && newWidth > 0) {
                img.style.width = newWidth + 'px';
                img.style.height = 'auto';
            }
        }
    }

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
                    // 轉成 datetime-local 格式
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

            // 排程
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

    // 插入表格
    function insertTable() {
        const quill = quillRef.current?.getEditor();
        if (!quill) return;

        const rows = prompt('請輸入表格列數：', '3');
        const cols = prompt('請輸入表格欄數：', '3');
        if (!rows || !cols) return;

        const r = parseInt(rows, 10);
        const c = parseInt(cols, 10);
        if (isNaN(r) || isNaN(c) || r < 1 || c < 1) return;

        let tableHtml = '<table style="border-collapse:collapse;width:100%;"><tbody>';
        for (let i = 0; i < r; i++) {
            tableHtml += '<tr>';
            for (let j = 0; j < c; j++) {
                const style = 'border:1px solid #ccc;padding:8px;min-width:60px;';
                if (i === 0) {
                    tableHtml += `<th style="${style}font-weight:bold;background:#f5f5f5;">標題</th>`;
                } else {
                    tableHtml += `<td style="${style}">內容</td>`;
                }
            }
            tableHtml += '</tr>';
        }
        tableHtml += '</tbody></table><p><br></p>';

        const range = quill.getSelection(true);
        quill.clipboard.dangerouslyPasteHTML(range.index, tableHtml);
    }

    const quillModules = {
        toolbar: {
            container: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: [] }, { background: [] }],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ align: [] }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean'],
            ],
        },
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p>載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="admin-header">
                <h1 className="page-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    {isEdit ? '編輯公告' : '新增公告'}
                </h1>
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

                {/* 置頂功能 */}
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

                {/* 排程功能 */}
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
                    <div className="editor-toolbar-extra">
                        <label>內容</label>
                        <button
                            type="button"
                            className="btn-table-insert"
                            onClick={insertTable}
                            title="插入表格"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                                <line x1="15" y1="3" x2="15" y2="21" />
                            </svg>
                            插入表格
                        </button>
                    </div>
                    <div className="editor-wrapper">
                        {quillLoaded && ReactQuill ? (
                            <ReactQuill
                                ref={quillRef}
                                theme="snow"
                                value={content}
                                onChange={setContent}
                                modules={quillModules}
                                placeholder="請輸入公告內容..."
                            />
                        ) : (
                            <div className="editor-loading">
                                <div className="loading-spinner" />
                                <p>載入編輯器中...</p>
                            </div>
                        )}
                    </div>
                    <p className="editor-hint">💡 拖曳圖片邊緣可調整大小，雙擊圖片可輸入精確寬度</p>
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
