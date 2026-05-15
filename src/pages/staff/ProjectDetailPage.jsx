import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import {
    doc, updateDoc, addDoc, onSnapshot,
    collection, query, where, orderBy, serverTimestamp, getDocs
} from 'firebase/firestore';

const PRIORITY_CONFIG = {
    normal: { label: '一般', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
    priority: { label: '優先', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
    urgent: { label: '緊急', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
};
const STATUS_CONFIG = {
    todo: { label: '待處理', color: '#6B7280', bg: '#F3F4F6' },
    in_progress: { label: '進行中', color: '#2563EB', bg: '#EFF6FF' },
    done: { label: '已完成', color: '#059669', bg: '#ECFDF5' },
    blocked: { label: '確認中', color: '#DC2626', bg: '#FEF2F2' },
};

function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState(null);
    const [comments, setComments] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const [commentText, setCommentText] = useState('');
    const [mentionMenu, setMentionMenu] = useState({ open: false, query: '', pos: 0 });
    const commentInputRef = useRef(null);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'projects', id), snap => {
            if (snap.exists()) setProject({ id: snap.id, ...snap.data() });
            setLoading(false);
        });
        return unsub;
    }, [id]);

    useEffect(() => {
        const q = query(collection(db, 'project_comments'), where('projectId', '==', id), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return unsub;
    }, [id]);

    useEffect(() => {
        if (auth.currentUser && id) {
            const q = query(
                collection(db, 'project_notifications'),
                where('projectId', '==', id),
                where('userId', '==', auth.currentUser.uid),
                where('isRead', '==', false)
            );
            getDocs(q).then(snap => {
                snap.docs.forEach(d => updateDoc(d.ref, { isRead: true }));
            });
        }
    }, [id, auth.currentUser]);

    useEffect(() => {
        getDocs(collection(db, 'users')).then(snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const createNotification = async (type, content) => {
        if (!project) return;
        const recipients = new Set();
        if (project.assigneeId && project.assigneeId !== auth.currentUser?.uid) recipients.add(project.assigneeId);
        if (project.reviewerId && project.reviewerId !== auth.currentUser?.uid) recipients.add(project.reviewerId);
        if (project.createdBy && project.createdBy !== auth.currentUser?.uid) recipients.add(project.createdBy);

        for (const uid of recipients) {
            await addDoc(collection(db, 'project_notifications'), {
                userId: uid,
                projectId: id,
                projectTitle: project.title,
                type,
                content,
                actorName: auth.currentUser?.displayName || '有人',
                createdAt: serverTimestamp(),
                isRead: false
            });
        }
    };

    const handleCommentChange = (e) => {
        const val = e.target.value;
        setCommentText(val);
        const cursor = e.target.selectionStart;
        const before = val.slice(0, cursor);
        const atIdx = before.lastIndexOf('@');
        if (atIdx !== -1 && !before.slice(atIdx + 1).includes(' ')) {
            setMentionMenu({ open: true, query: before.slice(atIdx + 1), pos: atIdx });
        } else {
            setMentionMenu({ open: false, query: '', pos: 0 });
        }
    };

    const insertMention = (user) => {
        const before = commentText.slice(0, mentionMenu.pos);
        const after = commentText.slice(commentInputRef.current.selectionStart);
        setCommentText(`${before}@${user.displayName} ${after}`);
        setMentionMenu({ open: false, query: '', pos: 0 });
        commentInputRef.current.focus();
    };

    const filteredMentionUsers = users.filter(u =>
        !mentionMenu.query || (u.displayName || '').toLowerCase().includes(mentionMenu.query.toLowerCase())
    ).slice(0, 6);

    const handleSendComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        const mentions = [];
        const regex = /@(\S+)/g; let m;
        while ((m = regex.exec(commentText)) !== null) {
            const found = users.find(u => u.displayName === m[1]);
            if (found) mentions.push(found.id);
        }
        await addDoc(collection(db, 'project_comments'), {
            projectId: id, content: commentText,
            authorId: auth.currentUser?.uid || '', authorName: auth.currentUser?.displayName || '我',
            mentions, createdAt: serverTimestamp(),
        });
        
        await createNotification('message', commentText);
        setCommentText('');
    };

    const renderComment = (text) => {
        if (!text) return '';
        // 匹配 @開頭直到空白或標點符號前的內容
        const parts = text.split(/(@[\u4e00-\u9fa5\w.-]+)/g);
        return parts.map((part, i) =>
            part.startsWith('@')
                ? <span key={i} className="pm-mention-tag">{part}</span>
                : part
        );
    };

    const currentUserProfile = users.find(u => u.id === auth.currentUser?.uid);
    const isAdmin = currentUserProfile?.role === 'admin';
    const isAssignee = project?.assigneeId === auth.currentUser?.uid;
    const isReviewer = project?.reviewerId === auth.currentUser?.uid;
    const isCreator = project?.createdBy === auth.currentUser?.uid;
    const canUpdate = isAdmin || isAssignee || isReviewer || isCreator;

    const handleUpdateProject = async (field, val) => {
        if (!canUpdate) return alert('您沒有權限進行此操作');
        const oldVal = project[field];
        await updateDoc(doc(db, 'projects', id), { [field]: val, updatedAt: serverTimestamp() });

        if (field === 'status') {
            const oldLabel = STATUS_CONFIG[oldVal]?.label || oldVal;
            const newLabel = STATUS_CONFIG[val]?.label || val;
            const msg = `${auth.currentUser?.displayName || '有人'} 將進度更新為 [${newLabel}]`;
            await addDoc(collection(db, 'project_comments'), {
                projectId: id,
                content: msg,
                authorId: 'system',
                authorName: '系統通知',
                createdAt: serverTimestamp(),
                isSystem: true
            });
            await createNotification('update', msg);
        }
    };

    const handleUpdateAssignee = async (newId) => {
        if (!canUpdate) return alert('您沒有權限進行此操作');
        const newUser = users.find(u => u.id === newId);
        const oldName = project.assigneeName || '未指派';
        const newName = newUser?.displayName || '未指派';

        await updateDoc(doc(db, 'projects', id), {
            assigneeId: newId,
            assigneeName: newName,
            updatedAt: serverTimestamp()
        });

        const msg = `${auth.currentUser?.displayName || '有人'} 將負責人從 [${oldName}] 變更為 [${newName}]`;
        await addDoc(collection(db, 'project_comments'), {
            projectId: id,
            content: msg,
            authorId: 'system',
            authorName: '系統通知',
            createdAt: serverTimestamp(),
            isSystem: true
        });
        await createNotification('update', msg);
    };

    const handleDeleteProject = async () => {
        if (!isCreator) return alert('只有建立者可以刪除任務');
        if (!window.confirm('確定要刪除此任務嗎？此動作無法復原。')) return;
        try {
            await updateDoc(doc(db, 'projects', id), { deleted: true }); // 或是直接 deleteDoc
            // 這裡採用軟刪除或直接刪除，視需求而定，先用 deleteDoc
            // await deleteDoc(doc(db, 'projects', id)); 
            // 但考量資料安全，我們先 navigate 回去就好，實際專案通常用 status='deleted'
            await updateDoc(doc(db, 'projects', id), { status: 'deleted' });
            navigate('/staff/projects');
        } catch (err) { alert('刪除失敗'); }
    };

    if (loading) return <div className="admin-page-content"><p>載入中...</p></div>;
    if (!project) return <div className="admin-page-content"><p>任務不存在</p></div>;

    const pri = PRIORITY_CONFIG[project.priority] || PRIORITY_CONFIG.normal;
    const sta = STATUS_CONFIG[project.status] || STATUS_CONFIG.todo;


    const handleUpdateReviewer = async (newId) => {
        if (!canUpdate) return alert('您沒有權限進行此操作');
        const newUser = users.find(u => u.id === newId);
        const oldName = project.reviewerName || '未指定';
        const newName = newUser?.displayName || '未指定';

        await updateDoc(doc(db, 'projects', id), {
            reviewerId: newId,
            reviewerName: newName,
            updatedAt: serverTimestamp()
        });

        const msg = `${auth.currentUser?.displayName || '有人'} 將確認者從 [${oldName}] 變更為 [${newName}]`;
        await addDoc(collection(db, 'project_comments'), {
            projectId: id, content: msg, authorId: 'system', authorName: '系統通知',
            createdAt: serverTimestamp(), isSystem: true
        });
        await createNotification('update', msg);
    };

    const handleWorkflowAction = async (action) => {
        let newStatus = '';
        let msg = '';
        if (action === 'submit') {
            newStatus = 'blocked';
            msg = `${auth.currentUser?.displayName || '有人'} 已完成工作，並提交給確認者 [${project.reviewerName || '未指定'}] 進行審核`;
        } else if (action === 'approve') {
            newStatus = 'done';
            msg = `${auth.currentUser?.displayName || '有人'} 已核准此任務，狀態變更為 [已完成]`;
        } else if (action === 'start') {
            newStatus = 'in_progress';
            msg = `${auth.currentUser?.displayName || '有人'} 已開始執行任務，狀態變更為 [進行中]`;
        }

        if (!newStatus) return;

        await updateDoc(doc(db, 'projects', id), {
            status: newStatus,
            updatedAt: serverTimestamp()
        });

        await addDoc(collection(db, 'project_comments'), {
            projectId: id, content: msg, authorId: 'system', authorName: '系統通知',
            createdAt: serverTimestamp(), isSystem: true
        });
        await createNotification('update', msg);
    };

    return (
        <div className="admin-page-content pm-detail">
            {/* 麵包屑與導航 */}
            <div className="pm-breadcrumb">
                <button className="pm-back-btn" onClick={() => navigate('/staff/projects')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                    返回看板
                </button>
                <span>/</span>
                <span className="pm-breadcrumb-current">{project.title}</span>
            </div>

            {/* 標頭優化：防止重疊 */}
            <div className="pm-detail-header">
                <div className="pm-header-content">
                    <h2 className="pm-detail-title">{project.title}</h2>
                    <div className="pm-header-badges">
                        <span className="pm-list-badge" style={{ color: pri.color, background: pri.bg, borderColor: pri.border }}>{pri.label} 優先級</span>
                        <span className="pm-list-badge" style={{ color: sta.color, background: sta.bg, borderColor: sta.color + '30' }}>{sta.label}</span>
                        {project.categoryName && <span className="pm-list-badge" style={{ color: '#6B7280', background: '#F3F4F6', borderColor: '#E5E7EB' }}>{project.categoryName}</span>}
                    </div>
                </div>
                <div className="pm-header-meta">
                    <div className="meta-item">負責人：<strong>{project.assigneeName || '未指派'}</strong></div>
                    <div className="meta-item">截止日期：<strong>{project.dueDate || '-'}</strong></div>
                    {isCreator && (
                        <button className="pm-delete-btn" onClick={handleDeleteProject}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            刪除任務
                        </button>
                    )}
                </div>
            </div>

            {/* 任務詳情區塊 */}
            <div className="pm-detail-body">
                <div className="card pm-detail-card">
                    <div className="pm-section-title">📝 任務說明</div>
                    <div className="pm-info-grid">
                        <InfoRow label="負責人">
                            <select className="form-control pm-status-select" value={project.assigneeId || ''} onChange={e => handleUpdateAssignee(e.target.value)} disabled={!canUpdate}>
                                <option value="">未指派</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                            </select>
                        </InfoRow>
                        <InfoRow label="確認者">
                            <select className="form-control pm-status-select" value={project.reviewerId || ''} onChange={e => handleUpdateReviewer(e.target.value)} disabled={!canUpdate}>
                                <option value="">未指定</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                            </select>
                        </InfoRow>
                        <InfoRow label="當前進度">
                            <select className="form-control pm-status-select" value={project.status || 'todo'} onChange={e => handleUpdateProject('status', e.target.value)} disabled={!canUpdate}>
                                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                        </InfoRow>
                        <div className="pm-description-container">
                            <div className="pm-info-label">需求詳情</div>
                            <div className="pm-description-text">{project.description || '此任務暫無詳細描述。'}</div>
                        </div>
                    </div>

                    {/* 串簽流程按鈕 */}
                    <div className="pm-workflow-actions">
                        {isAssignee && project.status === 'todo' && (
                            <button className="pm-action-btn start" onClick={() => handleWorkflowAction('start')}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9V3z" /></svg>
                                開始執行任務
                            </button>
                        )}
                        {isAssignee && project.status === 'in_progress' && (
                            <button className="pm-action-btn submit" onClick={() => handleWorkflowAction('submit')}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                完成工作，提交確認者審核
                            </button>
                        )}
                        {isReviewer && project.status === 'blocked' && (
                            <button className="pm-action-btn approve" onClick={() => handleWorkflowAction('approve')}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                審核通過，完成任務
                            </button>
                        )}
                        {project.status === 'blocked' && !isReviewer && (
                            <div className="pm-workflow-tip">⏳ 等待確認者 [<strong>{project.reviewerName}</strong>] 審核中...</div>
                        )}
                    </div>
                </div>

                {/* 討論留言區：直接放在詳情下方 */}
                <div className="pm-discussion-section">
                    <div className="pm-section-title" style={{ marginBottom: '1.5rem' }}>💬 團隊討論</div>
                    <div className="pm-comments-wrap">
                        <div className="pm-comments-list">
                            {comments.length === 0 && (
                                <div className="pm-no-comments-container">
                                    <div className="pm-no-comments-bubble">目前尚無留言</div>
                                </div>
                            )}
                            {comments.map((c, i) => {
                                const isMine = c.authorId === auth.currentUser?.uid;
                                const dateObj = c.createdAt?.toDate ? c.createdAt.toDate() : null;
                                const dateStr = dateObj ? dateObj.toLocaleDateString('zh-TW') : '';
                                const timeStr = dateObj ? dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

                                // 日期分隔邏輯
                                const prevDateObj = i > 0 && comments[i - 1].createdAt?.toDate ? comments[i - 1].createdAt.toDate() : null;
                                const prevDateStr = prevDateObj ? prevDateObj.toLocaleDateString('zh-TW') : '';
                                const showDateSeparator = dateStr && dateStr !== prevDateStr;

                                return (
                                    <div key={c.id} style={{ display: 'contents' }}>
                                        {showDateSeparator && (
                                            <div className="pm-date-separator">
                                                <span>{dateStr}</span>
                                            </div>
                                        )}
                                        <div className={`pm-comment ${isMine ? 'mine' : ''} ${c.isSystem ? 'system' : ''}`}>
                                            {!c.isSystem && !isMine && <div className="pm-comment-avatar">{(c.authorName || '?')[0]}</div>}
                                            <div className="pm-comment-main">
                                                {c.isSystem ? (
                                                    <div className="pm-system-msg">
                                                        {renderComment(c.content)}
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="pm-comment-header">
                                                            <span className="author">{c.authorName}</span>
                                                        </div>
                                                        <div className="pm-comment-row">
                                                            <div className="pm-comment-bubble">{renderComment(c.content)}</div>
                                                            <span className="pm-comment-time">{timeStr}</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {!c.isSystem && isMine && <div className="pm-comment-avatar">{(c.authorName || '?')[0]}</div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <form className="pm-comment-composer" onSubmit={handleSendComment}>
                            <textarea ref={commentInputRef} className="pm-comment-textarea" placeholder="輸入留言..." value={commentText} onChange={handleCommentChange} rows={2} />
                            <div className="composer-footer">
                                <span className="hint">輸入 @ 可以標註員工</span>
                                <button type="submit" className="btn btn-primary pm-send-btn">送出</button>
                            </div>
                            {mentionMenu.open && filteredMentionUsers.length > 0 && (
                                <div className="pm-mention-dropdown">
                                    {filteredMentionUsers.map(u => (
                                        <div key={u.id} className="pm-mention-user-item" onClick={() => insertMention(u)}>
                                            <div className="mini-avatar">{(u.displayName || '?')[0]}</div>
                                            <span>{u.displayName || u.email}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            </div>

            <style>{`
                :root {
                    --apple-blue: #0071E3;
                    --apple-bg: #F5F5F7;
                    --apple-text: #1D1D1F;
                    --apple-secondary: #86868B;
                    --apple-gray: #F2F2F7;
                }

                .pm-detail { animation: fadeIn 0.4s ease-out; max-width: 1000px; margin: 0 auto; background: var(--apple-bg); padding: 1.5rem; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .pm-breadcrumb { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; font-size: 0.9rem; color: var(--apple-secondary); }
                .pm-back-btn { display: flex; align-items: center; gap: 0.5rem; background: #fff; border: 1.5px solid rgba(0,0,0,0.05); cursor: pointer; color: var(--apple-blue); padding: 0.5rem 1rem; border-radius: 10px; font-weight: 700; transition: all 0.2s; }
                .pm-back-btn:hover { border-color: var(--apple-blue); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                .pm-breadcrumb-current { color: var(--apple-text); font-weight: 700; }
                
                .pm-detail-header { margin-bottom: 2rem; background: #fff; padding: 2rem; border-radius: 20px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
                .pm-header-content { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 1.5rem; }
                .pm-detail-title { font-size: 2rem; font-weight: 900; color: #000; margin: 0; line-height: 1.2; letter-spacing: -0.02em; }
                .pm-header-badges { display: flex; flex-wrap: wrap; gap: 0.75rem; }
                .pm-list-badge { padding: 0.4rem 1rem; border-radius: 10px; font-size: 0.85rem; font-weight: 700; border: 1px solid transparent; }
                
                .pm-header-meta { display: flex; gap: 2.5rem; padding-top: 1.5rem; border-top: 1.5px solid rgba(0,0,0,0.03); color: var(--apple-secondary); font-size: 0.95rem; }
                .pm-header-meta strong { color: var(--apple-text); }

                .pm-detail-body { display: flex; flex-direction: column; gap: 2rem; }
                .pm-detail-card { padding: 2rem; border-radius: 20px; border: 1px solid rgba(0,0,0,0.05); background: #fff; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.02); }
                .pm-section-title { font-size: 1.25rem; font-weight: 800; color: #000; display: flex; align-items: center; gap: 0.65rem; }
                
                .pm-info-grid { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
                .pm-status-select { max-width: 200px; border-radius: 12px; border: 1.5px solid #E2E8F0; padding: 0.6rem 1rem; font-weight: 600; outline: none; }
                .pm-status-select:focus { border-color: var(--apple-blue); }
                .pm-info-label { font-size: 0.95rem; font-weight: 700; color: var(--apple-secondary); margin-bottom: 0.75rem; }
                .pm-description-text { background: var(--apple-gray); padding: 1.5rem; border-radius: 16px; font-size: 1.05rem; line-height: 1.8; color: var(--apple-text); border: none; min-height: 150px; white-space: pre-wrap; }

                /* 討論區優化 */
                .pm-description-text { line-height: 1.8; color: #4B5563; font-size: 1rem; word-break: break-all; white-space: pre-wrap; }

                /* 串簽流程樣式 */
                .pm-workflow-actions { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 1rem; }
                .pm-action-btn { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 1rem; border-radius: 12px; font-weight: 800; font-size: 1.05rem; cursor: pointer; border: none; transition: all 0.2s; width: 100%; }
                .pm-action-btn.start { background: #5856D6; color: #fff; box-shadow: 0 4px 15px rgba(88,86,214,0.2); }
                .pm-action-btn.submit { background: var(--apple-blue); color: #fff; box-shadow: 0 4px 15px rgba(0,113,227,0.2); }
                .pm-action-btn.approve { background: #34C759; color: #fff; box-shadow: 0 4px 15px rgba(52,199,89,0.2); }
                .pm-action-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }
                .pm-workflow-tip { padding: 1rem; background: #FFF9C4; color: #F57F17; border-radius: 12px; font-weight: 700; font-size: 0.95rem; text-align: center; border: 1px solid #FFF176; }

                .pm-discussion-section { background: #fff; border-radius: 24px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
                .pm-comments-wrap { border-radius: 20px; border: 1px solid rgba(0,0,0,0.05); overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); position: relative; }
                .pm-comments-list { padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; background: #fff; height: 500px; overflow-y: auto; }
                
                .pm-no-comments-container { display: flex; justify-content: center; align-items: center; height: 100%; padding: 3rem 0; }
                .pm-no-comments-bubble { background: var(--apple-gray); color: var(--apple-secondary); padding: 0.75rem 1.5rem; border-radius: 12px; font-size: 0.9rem; font-weight: 500; }

                .pm-date-separator { display: flex; align-items: center; justify-content: center; margin: 1rem 0; color: var(--apple-secondary); font-size: 0.75rem; font-weight: 600; gap: 1rem; }
                .pm-date-separator::before, .pm-date-separator::after { content: ""; flex: 1; height: 1px; background: rgba(0,0,0,0.05); }

                .pm-comment { display: flex; gap: 0.75rem; align-items: flex-start; max-width: 80%; }
                .pm-comment-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--apple-blue), #5AC8FA); color: #fff; font-size: 0.9rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 20px; }
                .pm-comment-main { flex: 1; display: flex; flex-direction: column; gap: 4px; }
                
                .pm-comment-header { margin-left: 4px; }
                .pm-comment-header .author { font-weight: 700; color: var(--apple-text); font-size: 0.85rem; }
                
                .pm-comment-row { display: flex; align-items: flex-end; gap: 8px; }
                .pm-comment-bubble { background: var(--apple-gray); padding: 0.75rem 1rem; border-radius: 4px 16px 16px 16px; line-height: 1.5; color: var(--apple-text); font-size: 0.95rem; border: none; max-width: 100%; }
                .pm-comment-time { font-size: 0.7rem; color: var(--apple-secondary); white-space: nowrap; margin-bottom: 4px; }

                .pm-comment.mine { align-self: flex-end; flex-direction: row; }
                .pm-comment.mine .pm-comment-main { align-items: flex-end; }
                .pm-comment.mine .pm-comment-header { margin-left: 0; margin-right: 4px; }
                .pm-comment.mine .pm-comment-row { flex-direction: row-reverse; }
                .pm-comment.mine .pm-comment-bubble { background: var(--apple-blue); color: #fff; border-radius: 16px 4px 16px 16px; }
                
                .pm-comment.system { align-self: center; max-width: 100%; width: 100%; justify-content: center; margin: 0.5rem 0; }
                .pm-system-msg { color: var(--apple-secondary); font-size: 0.85rem; font-weight: 500; text-align: center; width: 100%; }

                .pm-comment-composer { padding: 1.5rem 2rem; border-top: 1px solid rgba(0,0,0,0.05); background: #fff; position: relative; }
                .pm-comment-textarea { width: 100%; padding: 1rem; border: 1.5px solid var(--apple-gray); border-radius: 16px; outline: none; font-size: 1rem; resize: none; transition: all 0.2s; background: var(--apple-bg); }
                .pm-comment-textarea:focus { border-color: var(--apple-blue); background: #fff; }
                
                .composer-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; }
                .composer-footer .hint { font-size: 0.8rem; color: var(--apple-secondary); font-weight: 500; }
                .pm-send-btn { padding: 0.6rem 1.5rem; border-radius: 10px; font-weight: 700; background: var(--apple-blue) !important; color: #fff !important; border: none; }

                .pm-mention-dropdown { position: absolute; bottom: 100%; left: 2rem; background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 12px; box-shadow: 0 -10px 25px rgba(0,0,0,0.1); width: 200px; z-index: 100; overflow: hidden; margin-bottom: 5px; }
                .pm-mention-user-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 1rem; cursor: pointer; transition: background 0.2s; }
                .pm-mention-user-item:hover { background: rgba(0, 113, 227, 0.05); }
                .mini-avatar { width: 24px; height: 24px; border-radius: 50%; background: var(--apple-blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 800; }
                
                .pm-delete-btn { background: transparent; color: #FF3B30; border: none; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; }
                .pm-delete-btn:hover { opacity: 0.7; }
            `}</style>
        </div>
    );
}

function InfoRow({ label, value, children }) {
    return (
        <div className="pm-info-row" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span className="pm-info-label" style={{ width: '100px', flexShrink: 0, marginBottom: 0 }}>{label}</span>
            <div style={{ flex: 1 }}>{children || value}</div>
        </div>
    );
}

export default ProjectDetailPage;
