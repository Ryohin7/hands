import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { db, auth } from '../../firebase';
import {
    collection, addDoc, onSnapshot, query, orderBy,
    serverTimestamp, getDocs, updateDoc, doc, where
} from 'firebase/firestore';

const PRIORITY_CONFIG = {
    normal: { label: '一般', color: '#4B5563', bg: '#F3F4F6', border: '#E5E7EB' },
    priority: { label: '優先', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
    urgent: { label: '緊急', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
};

const COLUMNS = [
    { id: 'todo', label: '待處理', color: '#6B7280' },
    { id: 'in_progress', label: '進行中', color: '#2563EB' },
    { id: 'blocked', label: '確認中', color: '#DC2626' },
    { id: 'done', label: '已完成', color: '#059669' },
];

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

function ProjectsPage() {
    const navigate = useNavigate();
    const [view, setView] = useState('board'); // board, list
    const [projects, setProjects] = useState([]);
    const [categories, setCategories] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterUser, setFilterUser] = useState('');

    const emptyForm = {
        title: '',
        categoryId: '',
        categoryName: '',
        priority: 'normal',
        dueDate: todayStr(),
        assigneeId: '',
        assigneeName: '',
        reviewerId: '',
        reviewerName: '',
        description: '',
        status: 'todo',
    };
    const [form, setForm] = useState(emptyForm);

    const [notifications, setNotifications] = useState([]);
    const [notifOpen, setNotifOpen] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, snap => {
            setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return unsub;
    }, []);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(
            collection(db, 'project_notifications'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, snap => {
            setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    useEffect(() => {
        getDocs(query(collection(db, 'project_categories'), orderBy('order', 'asc')))
            .then(snap => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        getDocs(collection(db, 'users'))
            .then(snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    // 未讀通知計數映射表 { projectId: count }
    const unreadMap = useMemo(() => {
        const map = {};
        notifications.filter(n => !n.isRead).forEach(n => {
            map[n.projectId] = (map[n.projectId] || 0) + 1;
        });
        return map;
    }, [notifications]);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        if (name === 'categoryId') {
            const cat = categories.find(c => c.id === value);
            setForm(f => ({ ...f, categoryId: value, categoryName: cat?.name || '' }));
        } else if (name === 'assigneeId') {
            const u = users.find(u => u.id === value);
            setForm(f => ({ ...f, assigneeId: value, assigneeName: u?.displayName || '' }));
        } else if (name === 'reviewerId') {
            const u = users.find(u => u.id === value);
            setForm(f => ({ ...f, reviewerId: value, reviewerName: u?.displayName || '' }));
        } else {
            setForm(f => ({ ...f, [name]: value }));
        }
    };

    const createNotification = async (projectId, projectTitle, assigneeId, reviewerId, createdBy, content) => {
        const recipients = new Set();
        if (assigneeId && assigneeId !== auth.currentUser?.uid) recipients.add(assigneeId);
        if (reviewerId && reviewerId !== auth.currentUser?.uid) recipients.add(reviewerId);
        if (createdBy && createdBy !== auth.currentUser?.uid) recipients.add(createdBy);

        for (const uid of recipients) {
            await addDoc(collection(db, 'project_notifications'), {
                userId: uid, projectId, projectTitle, type: 'update', content,
                actorName: auth.currentUser?.displayName || '有人',
                createdAt: serverTimestamp(), isRead: false
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        setSubmitting(true);
        try {
            const docRef = await addDoc(collection(db, 'projects'), {
                ...form,
                createdBy: auth.currentUser?.uid || '',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            
            // 發送新任務通知
            await createNotification(
                docRef.id, form.title, form.assigneeId, form.reviewerId, 
                auth.currentUser?.uid, `指派了新任務：${form.title}`
            );

            setDrawerOpen(false);
            setForm(emptyForm);
        } catch (err) { alert('新增失敗'); } finally { setSubmitting(false); }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        const { draggableId, destination } = result;
        const project = projects.find(p => p.id === draggableId);
        if (!project || project.status === destination.droppableId) return;
        
        const oldStatus = project.status;
        const newStatus = destination.droppableId;
        const oldLabel = COLUMNS.find(c => c.id === oldStatus)?.label || oldStatus;
        const newLabel = COLUMNS.find(c => c.id === newStatus)?.label || newStatus;
        const msg = `${auth.currentUser?.displayName || '有人'} 將看板進度更新為 [${newLabel}]`;

        setProjects(prev => prev.map(p => p.id === draggableId ? { ...p, status: newStatus } : p));
        
        await updateDoc(doc(db, 'projects', draggableId), {
            status: newStatus, updatedAt: serverTimestamp()
        });

        // 加入留言日誌
        await addDoc(collection(db, 'project_comments'), {
            projectId: draggableId, content: msg, authorId: 'system', authorName: '系統通知',
            createdAt: serverTimestamp(), isSystem: true
        });

        // 發送通知
        await createNotification(draggableId, project.title, project.assigneeId, project.reviewerId, project.createdBy, msg);
    };

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            if (p.status === 'deleted') return false;
            const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.description || '').toLowerCase().includes(search.toLowerCase());
            const matchCategory = !filterCategory || p.categoryId === filterCategory;
            const matchUser = !filterUser || p.assigneeId === filterUser;
            return matchSearch && matchCategory && matchUser;
        });
    }, [projects, search, filterCategory, filterUser]);

    return (
        <div className="admin-page-content pm-page">
            <div className="pm-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div>
                        <h2 className="admin-content-title">任務管理</h2>
                        <div className="pm-view-tabs">
                            <button className={`pm-view-btn ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>看板檢視</button>
                            <button className={`pm-view-btn ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>列表檢視</button>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className={`pm-notif-btn ${notifications.some(n => !n.isRead) ? 'has-unread' : ''}`} onClick={() => setNotifOpen(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                        {notifications.some(n => !n.isRead) && <span className="unread-dot">{notifications.filter(n => !n.isRead).length}</span>}
                    </button>
                    <button className="btn btn-primary pm-new-btn" onClick={() => setDrawerOpen(true)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        新增任務
                    </button>
                </div>
            </div>

            <div className="pm-filter-bar">
                <div className="pm-search-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input className="pm-search" placeholder="搜尋標題、內容..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="pm-filter-group">
                    <select className="pm-filter-select" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="">所有分類</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className="pm-filter-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
                        <option value="">負責人 (所有)</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="pm-loading">載入中...</div>
            ) : (
                <div className="pm-content-view">
                    {view === 'board' && (
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <div className="pm-kanban">
                                {COLUMNS.map(col => {
                                    const colProjects = filteredProjects.filter(p => p.status === col.id || (!p.status && col.id === 'todo'));
                                    return (
                                        <div key={col.id} className="pm-kanban-col">
                                            <div className="pm-col-header">
                                                <span className="pm-col-title" style={{ color: col.color }}>{col.label}</span>
                                                <span className="pm-col-count">{colProjects.length}</span>
                                            </div>
                                            <Droppable droppableId={col.id}>
                                                {(provided, snapshot) => (
                                                    <div ref={provided.innerRef} {...provided.droppableProps} className={`pm-col-body ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}>
                                                        {colProjects.map((p, index) => {
                                                            const pri = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.normal;
                                                            const unreadCount = unreadMap[p.id] || 0;
                                                            return (
                                                                <Draggable key={p.id} draggableId={p.id} index={index}>
                                                                    {(prov, snap) => (
                                                                        <div ref={prov.innerRef} {...prov.draggableProps} {...prov.dragHandleProps} className={`pm-task-card ${snap.isDragging ? 'dragging' : ''}`} onClick={() => navigate(`/staff/projects/${p.id}`)}>
                                                                            {unreadCount > 0 && <span className="task-unread-badge">{unreadCount}</span>}
                                                                            <div className="pm-task-title">{p.title}</div>
                                                                            <div className="pm-card-tags">
                                                                                <span className="pm-card-tag">{p.categoryName || '未分類'}</span>
                                                                                <span className="pm-priority-label" style={{ color: pri.color, background: pri.bg, borderColor: pri.border }}>{pri.label}</span>
                                                                            </div>
                                                                            <div className="pm-card-footer">
                                                                                <div className="pm-task-due">
                                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                                                                    {p.dueDate || '-'}
                                                                                </div>
                                                                                <span className="pm-assignee-small">{p.assigneeName || '未指派'}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </Draggable>
                                                            );
                                                        })}
                                                        {provided.placeholder}
                                                    </div>
                                                )}
                                            </Droppable>
                                        </div>
                                    );
                                })}
                            </div>
                        </DragDropContext>
                    )}

                    {view === 'list' && (
                        <div className="pm-list-view">
                            <table className="pm-table">
                                <thead>
                                    <tr>
                                        <th>任務名稱</th>
                                        <th>狀態</th>
                                        <th>分類</th>
                                        <th>優先程度</th>
                                        <th>負責人</th>
                                        <th>截止日期</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProjects.map(p => {
                                        const pri = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.normal;
                                        const sta = COLUMNS.find(c => c.id === p.status) || COLUMNS[0];
                                        return (
                                            <tr key={p.id} onClick={() => navigate(`/staff/projects/${p.id}`)}>
                                                <td className="pm-td-title">{p.title}</td>
                                                <td><span className="pm-list-badge" style={{ color: sta.color, background: sta.color + '15', borderColor: sta.color + '30' }}>{sta.label}</span></td>
                                                <td style={{ color: '#6B7280' }}>{p.categoryName || '-'}</td>
                                                <td><span className="pm-list-badge" style={{ color: pri.color, background: pri.bg, borderColor: pri.border }}>{pri.label}</span></td>
                                                <td style={{ fontWeight: 500 }}>{p.assigneeName || '-'}</td>
                                                <td style={{ color: '#6B7280' }}>{p.dueDate}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* 通知中心 Drawer */}
            {notifOpen && <div className="pm-drawer-overlay" onClick={() => setNotifOpen(false)} />}
            <div className={`pm-notif-drawer ${notifOpen ? 'open' : ''}`}>
                <div className="pm-drawer-header">
                    <h3>通知中心</h3>
                    <button className="pm-drawer-close" onClick={() => setNotifOpen(false)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>
                <div className="pm-notif-list">
                    {notifications.length === 0 ? (
                        <div className="pm-notif-empty">目前尚無通知</div>
                    ) : (
                        notifications.map(n => (
                            <div key={n.id} className={`pm-notif-item ${!n.isRead ? 'unread' : ''}`} onClick={() => navigate(`/staff/projects/${n.projectId}`)}>
                                <div className="notif-header">
                                    <span className={`notif-type ${n.type}`}>{n.type === 'message' ? '新留言' : '任務異動'}</span>
                                    <span className="notif-time">{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                </div>
                                <div className="notif-content">
                                    <strong>{n.actorName}</strong> {n.type === 'message' ? '在任務中留言：' : ''} {n.content}
                                </div>
                                <div className="notif-project">📌 {n.projectTitle}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 新增任務 Drawer */}
            {drawerOpen && <div className="pm-drawer-overlay" onClick={() => setDrawerOpen(false)} />}
            <div className={`pm-drawer ${drawerOpen ? 'open' : ''}`}>
                <div className="pm-drawer-header">
                    <h3>新增任務</h3>
                    <button className="pm-drawer-close" onClick={() => setDrawerOpen(false)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>
                <form className="pm-drawer-body" onSubmit={handleSubmit}>
                    <div className="pm-form-group">
                        <label className="pm-label">任務名稱 <span className="pm-required">*</span></label>
                        <input className="pm-input" name="title" placeholder="輸入任務標題" value={form.title} onChange={handleFormChange} required />
                    </div>
                    <div className="pm-form-row">
                        <div className="pm-form-group">
                            <label className="pm-label">分類</label>
                            <select className="pm-input" name="categoryId" value={form.categoryId} onChange={handleFormChange}>
                                <option value="">請選擇</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="pm-form-group">
                            <label className="pm-label">優先程度</label>
                            <div className="pm-priority-group">
                                {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                                    <label key={k} className={`pm-priority-btn ${form.priority === k ? 'selected' : ''}`}>
                                        <input type="radio" name="priority" value={k} checked={form.priority === k} onChange={handleFormChange} hidden />
                                        {v.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="pm-form-row">
                        <div className="pm-form-group">
                            <label className="pm-label">負責人</label>
                            <select className="pm-input" name="assigneeId" value={form.assigneeId} onChange={handleFormChange}>
                                <option value="">請選擇</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                            </select>
                        </div>
                        <div className="pm-form-group">
                            <label className="pm-label">確認者</label>
                            <select className="pm-input" name="reviewerId" value={form.reviewerId} onChange={handleFormChange}>
                                <option value="">請選擇</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="pm-form-row">
                        <div className="pm-form-group">
                            <label className="pm-label">截止日期</label>
                            <input className="pm-input" name="dueDate" value={form.dueDate} onChange={handleFormChange} placeholder="YYYY/MM/DD" />
                        </div>
                        <div className="pm-form-group" />
                    </div>
                    <div className="pm-form-group">
                        <label className="pm-label">需求描述</label>
                        <textarea className="pm-input" name="description" value={form.description} onChange={handleFormChange} rows={5} style={{ resize: 'none' }} />
                    </div>
                    <div className="pm-drawer-actions">
                        <button type="button" className="pm-btn pm-btn-secondary" onClick={() => setDrawerOpen(false)}>取消</button>
                        <button type="submit" className="pm-btn pm-btn-primary" disabled={submitting}>建立任務</button>
                    </div>
                </form>
            </div>

            <style>{`
                :root {
                    --apple-blue: #0071E3;
                    --apple-gray: #F5F5F7;
                    --apple-text: #1D1D1F;
                    --apple-secondary: #86868B;
                    --apple-bg: #FFFFFF;
                }
                .pm-page { background: var(--apple-gray); min-height: calc(100vh - 40px); padding: 2rem; color: var(--apple-text); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif; }
                
                .pm-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
                .admin-content-title { font-size: 2.2rem; font-weight: 900; letter-spacing: -0.03em; margin-bottom: 1rem; }
                
                .pm-view-tabs { display: flex; background: rgba(0,0,0,0.05); padding: 4px; border-radius: 12px; width: fit-content; }
                .pm-view-btn { padding: 0.5rem 1.25rem; border: none; background: transparent; border-radius: 9px; font-size: 0.9rem; font-weight: 700; color: var(--apple-secondary); cursor: pointer; transition: all 0.2s; }
                .pm-view-btn.active { background: #fff; color: var(--apple-blue); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

                .pm-notif-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: #fff; color: var(--apple-text); cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                .pm-notif-btn:hover { transform: scale(1.05); background: var(--apple-gray); }
                .unread-dot { position: absolute; top: -2px; right: -2px; background: #FF3B30; color: #fff; font-size: 0.7rem; font-weight: 800; min-width: 18px; height: 18px; border-radius: 99px; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; }

                .pm-new-btn { padding: 0 1.5rem; height: 44px; border-radius: 22px; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; background: var(--apple-blue) !important; border: none; }
                .pm-new-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,113,227,0.3); }

                .pm-filter-bar { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
                .pm-search-wrap { flex: 1; min-width: 300px; position: relative; display: flex; align-items: center; }
                .pm-search-wrap svg { position: absolute; left: 1rem; color: var(--apple-secondary); }
                .pm-search { width: 100%; padding: 0.85rem 1rem 0.85rem 2.8rem; border-radius: 14px; border: 1.5px solid transparent; background: #fff; outline: none; font-size: 0.95rem; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
                .pm-search:focus { border-color: var(--apple-blue); box-shadow: 0 0 0 4px rgba(0,113,227,0.1); }
                
                .pm-filter-group { display: flex; gap: 0.75rem; }
                .pm-filter-select { padding: 0.85rem 1.25rem; border-radius: 14px; border: none; background: #fff; font-weight: 600; font-size: 0.9rem; color: var(--apple-text); cursor: pointer; outline: none; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }

                .pm-content-view { flex: 1; min-height: 0; }
                .pm-kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
                .pm-kanban-col { background: rgba(0,0,0,0.03); border-radius: 18px; display: flex; flex-direction: column; min-height: 0; border: none; }
                .pm-col-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; border-bottom: 1px solid rgba(0,0,0,0.05); border-radius: 18px 18px 0 0; background: #fff; }
                .pm-col-title { font-size: 0.95rem; font-weight: 800; letter-spacing: 0.02em; }
                .pm-col-count { font-size: 0.8rem; background: rgba(0,0,0,0.05); color: var(--apple-secondary); padding: 0.2rem 0.65rem; border-radius: 999px; font-weight: 800; }
                
                .pm-col-body { flex: 1; padding: 0.75rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; min-height: 200px; transition: background 0.2s; }
                .pm-col-body.dragging-over { background: rgba(0,113,227,0.03); }

                .pm-task-card { background: #fff; padding: 1.25rem; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); cursor: pointer; border: 1.5px solid transparent; transition: all 0.2s; position: relative; }
                .pm-task-card:hover { transform: translateY(-4px); box-shadow: 0 12px 20px -5px rgba(0,0,0,0.08); border-color: rgba(0,113,227,0.1); }
                .pm-task-card.dragging { transform: rotate(2deg) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.1); border-color: var(--apple-blue); z-index: 100; }
                
                .task-unread-badge { position: absolute; top: -6px; right: -6px; background: #FF3B30; color: #fff; font-size: 0.65rem; font-weight: 900; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }

                .pm-task-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem; line-height: 1.4; color: #000; }
                .pm-card-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
                .pm-card-tag { font-size: 0.75rem; font-weight: 800; color: var(--apple-blue); background: rgba(0, 113, 227, 0.1); padding: 0.25rem 0.6rem; border-radius: 6px; }
                .pm-priority-label { font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid transparent; }
                
                .pm-card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(0,0,0,0.03); }
                .pm-task-due { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--apple-secondary); font-weight: 600; }
                .pm-assignee-small { font-size: 0.8rem; font-weight: 700; color: var(--apple-blue); }

                .pm-list-view { background: #fff; border-radius: 18px; border: 1px solid rgba(0,0,0,0.05); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03); overflow: hidden; }
                .pm-table { width: 100%; border-collapse: collapse; text-align: left; }
                .pm-table th { padding: 1.25rem; background: rgba(0,0,0,0.02); font-size: 0.85rem; color: var(--apple-secondary); font-weight: 700; border-bottom: 2px solid rgba(0,0,0,0.05); }
                .pm-table td { padding: 1.25rem; font-size: 0.95rem; border-bottom: 1.5px solid rgba(0,0,0,0.03); cursor: pointer; vertical-align: middle; }
                .pm-table tr:last-child td { border-bottom: none; }
                .pm-table tr:hover td { background: rgba(0, 113, 227, 0.05); }
                .pm-list-badge { padding: 0.35rem 0.85rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700; border: 1px solid transparent; display: inline-block; }
                .pm-td-title { font-weight: 700; color: var(--apple-text); }

                .pm-notif-drawer { position: fixed; right: 0; top: 0; bottom: 0; width: 400px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(20px); box-shadow: -10px 0 30px rgba(0,0,0,0.05); z-index: 1001; transform: translateX(100%); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; }
                .pm-notif-drawer.open { transform: translateX(0); }
                .pm-notif-list { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .pm-notif-item { background: #fff; padding: 1rem; border-radius: 14px; cursor: pointer; transition: all 0.2s; border: 1.5px solid transparent; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
                .pm-notif-item:hover { transform: translateX(-4px); border-color: var(--apple-blue); }
                .pm-notif-item.unread { background: #fff; border-left: 4px solid var(--apple-blue); }
                .notif-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .notif-type { font-size: 0.7rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: uppercase; }
                .notif-type.message { background: #E1F5FE; color: #0288D1; }
                .notif-type.update { background: #FFF3E0; color: #E65100; }
                .notif-time { font-size: 0.7rem; color: var(--apple-secondary); font-weight: 600; }
                .notif-content { font-size: 0.9rem; line-height: 1.5; color: var(--apple-text); margin-bottom: 0.5rem; }
                .notif-project { font-size: 0.75rem; color: var(--apple-blue); font-weight: 700; opacity: 0.8; }
                .pm-notif-empty { text-align: center; padding: 3rem; color: var(--apple-secondary); font-weight: 600; }

                .pm-drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); z-index: 1000; }
                .pm-drawer { position: fixed; right: 0; top: 0; bottom: 0; width: 500px; background: #fff; box-shadow: -20px 0 50px rgba(0,0,0,0.1); z-index: 1001; transform: translateX(100%); transition: transform 0.4s; display: flex; flex-direction: column; }
                .pm-drawer.open { transform: translateX(0); }
                .pm-drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; border-bottom: 1px solid rgba(0,0,0,0.05); }
                .pm-drawer-header h3 { font-size: 1.25rem; font-weight: 800; color: var(--apple-text); margin: 0; }
                .pm-drawer-close { background: rgba(0,0,0,0.05); border: none; padding: 10px; border-radius: 12px; cursor: pointer; transition: all 0.2s; color: var(--apple-secondary); }
                .pm-drawer-close:hover { background: rgba(0,0,0,0.1); color: #000; }
                
                .pm-drawer-body { flex: 1; overflow-y: auto; padding: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
                .pm-form-group { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
                .pm-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                
                .pm-label { font-size: 0.9rem; font-weight: 700; color: var(--apple-text); display: block; margin-bottom: 2px; }
                .pm-required { color: #FF3B30; margin-left: 2px; }
                
                .pm-input { width: 100%; padding: 0.8rem 1rem; border-radius: 12px; border: 1.5px solid #E5E7EB; font-size: 1rem; outline: none; transition: all 0.2s; background: #fff; color: var(--apple-text); }
                .pm-input:focus { border-color: var(--apple-blue); box-shadow: 0 0 0 4px rgba(0,113,227,0.1); }
                
                .pm-priority-group { display: flex; gap: 0.5rem; width: 100%; }
                .pm-priority-btn { flex: 1; text-align: center; padding: 0.75rem 0; border-radius: 10px; font-size: 0.85rem; font-weight: 700; cursor: pointer; border: 1.5px solid #E5E7EB; transition: all 0.2s; background: #fff; color: var(--apple-secondary); }
                .pm-priority-btn:hover { border-color: var(--apple-blue); }
                .pm-priority-btn.selected { color: var(--apple-blue); border-color: var(--apple-blue); background: rgba(0, 113, 227, 0.05); }

                .pm-drawer-actions { margin-top: auto; padding: 1.5rem 2rem; border-top: 1px solid rgba(0,0,0,0.05); display: flex; gap: 1rem; justify-content: flex-end; }
                .pm-btn { padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; border: none; font-size: 0.95rem; }
                .pm-btn-secondary { background: rgba(0,0,0,0.05); color: var(--apple-text); }
                .pm-btn-primary { background: var(--apple-blue); color: #fff; }
                .pm-btn:hover { opacity: 0.9; transform: translateY(-1px); }

                @media (max-width: 1024px) { .pm-kanban { grid-template-columns: repeat(2, 1fr); } }
                @media (max-width: 640px) { 
                    .pm-kanban { grid-template-columns: 1fr; } 
                    .pm-drawer { width: 100%; } 
                    .pm-form-row { grid-template-columns: 1fr; }
                    .pm-notif-drawer { width: 100%; }
                }
            `}</style>
        </div>
    );
}

export default ProjectsPage;
