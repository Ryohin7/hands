import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, orderBy, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

function NavAdminPage() {
    const [navItems, setNavItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [newItem, setNewItem] = useState({ label: '', path: '', parentId: null });
    const [customPages, setCustomPages] = useState([]);

    const DEFAULT_IDS = ['home', 'stores', 'dm'];

    useEffect(() => {
        fetchNav();
        fetchCustomPages();
    }, []);

    async function fetchCustomPages() {
        try {
            const querySnapshot = await getDocs(query(collection(db, 'custom_pages'), orderBy('title', 'asc')));
            setCustomPages(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            console.error('讀取頁面列表失敗:', err);
        }
    }

    async function fetchNav() {
        try {
            const q = query(collection(db, 'nav_settings'), orderBy('order', 'asc'));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                setNavItems([
                    { id: 'home', label: '首頁', path: '/', visible: true, order: 1, children: [] },
                    { id: 'stores', label: '門市資訊', path: '/stores', visible: true, order: 2, children: [] },
                    { id: 'dm', label: '最新 DM', path: '/dm', visible: true, order: 3, children: [] }
                ]);
            } else {
                setNavItems(querySnapshot.docs.map(d => ({ id: d.id, children: [], ...d.data() })));
            }
        } catch (err) {
            console.error('讀取選單失敗:', err);
        } finally {
            setLoading(false);
        }
    }

    const toggleVisible = (id) => {
        setNavItems(prev => prev.map(item => {
            if (item.id === id) return { ...item, visible: !item.visible };
            if (item.children) {
                return {
                    ...item, children: item.children.map(child =>
                        child.id === id ? { ...child, visible: !child.visible } : child
                    )
                };
            }
            return item;
        }));
    };

    const handleAddLink = () => {
        if (!newItem.label) return alert('請輸入名稱');
        // 頂層項目可以沒有路徑，但子項目必須有路徑
        if (newItem.parentId && !newItem.path) return alert('請輸入子項目連結');

        const nextOrder = navItems.length > 0 ? Math.max(...navItems.map(i => i.order)) + 1 : 1;
        const id = 'link_' + Date.now();
        const item = { id, label: newItem.label, path: newItem.path, visible: true, order: nextOrder, children: [] };

        if (newItem.parentId) {
            setNavItems(prev => prev.map(p => {
                if (p.id === newItem.parentId) {
                    return { ...p, children: [...(p.children || []), { ...item, order: (p.children || []).length + 1 }] };
                }
                return p;
            }));
        } else {
            setNavItems([...navItems, item]);
        }
        setNewItem({ label: '', path: '', parentId: null });
    };

    const handleDelete = (id, parentId = null) => {
        if (DEFAULT_IDS.includes(id)) return alert('預設項目不可刪除');
        if (!window.confirm('確定要刪除嗎？')) return;

        if (parentId) {
            setNavItems(prev => prev.map(p => p.id === parentId ? { ...p, children: p.children.filter(c => c.id !== id) } : p));
        } else {
            setNavItems(prev => prev.filter(i => i.id !== id));
        }
    };

    // 拖拉邏輯
    const [draggedItem, setDraggedItem] = useState(null);

    const onDragStart = (e, index, parentId = null) => {
        setDraggedItem({ index, parentId });
        e.dataTransfer.effectAllowed = "move";
    };

    const onDragOver = (e, index, parentId = null) => {
        e.preventDefault();
        if (draggedItem === null) return;
        if (draggedItem.parentId !== parentId) return; // 只能同層級拖動
        if (draggedItem.index === index) return;

        const items = parentId ? [...navItems.find(p => p.id === parentId).children] : [...navItems];
        const itemMoved = items[draggedItem.index];
        items.splice(draggedItem.index, 1);
        items.splice(index, 0, itemMoved);

        // 重算 Order
        const newItemsWithOrder = items.map((item, idx) => ({ ...item, order: idx + 1 }));

        if (parentId) {
            setNavItems(prev => prev.map(p => p.id === parentId ? { ...p, children: newItemsWithOrder } : p));
        } else {
            setNavItems(newItemsWithOrder);
        }
        setDraggedItem({ index, parentId });
    };

    async function handleSave() {
        setSaving(true);
        try {
            // 先備份目前的 ID 名單，避免 deleteAll 失敗
            const currentQ = await getDocs(collection(db, 'nav_settings'));
            for (const d of currentQ.docs) await deleteDoc(doc(db, 'nav_settings', d.id));

            // 儲存新資料
            for (const item of navItems) {
                await setDoc(doc(db, 'nav_settings', item.id), item);
            }
            alert('導航欄設定已儲存');
        } catch (err) {
            alert('儲存失敗');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">導航欄管理 (拖拉排序)</h2>
                <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                    {saving ? '儲存中...' : '儲存全域設定'}
                </button>
            </div>

            <div className="info-card" style={{ marginBottom: '1.5rem' }}>
                <p>💡 提示：點擊項目右側「＋」可新增子選單。上下拖動項目可調整排序。</p>
            </div>

            {/* 新增連結表單 */}
            <div className="edit-form" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9375rem', marginBottom: '1rem', fontWeight: '600' }}>
                    {newItem.parentId ? `新增子項目至 [${navItems.find(i => i.id === newItem.parentId)?.label}]` : '新增頂層導航'}
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
                        <label>從現有頁面選取</label>
                        <select onChange={e => {
                            const page = customPages.find(p => p.id === e.target.value);
                            if (page) setNewItem({ ...newItem, label: page.title, path: `/p/${page.id}` });
                        }} value="">
                            <option value="">-- 請選取 --</option>
                            {customPages.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
                        <label>自訂名稱</label>
                        <input type="text" placeholder="名稱" value={newItem.label} onChange={e => setNewItem({ ...newItem, label: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: '2 1 240px' }}>
                        <label>連結網址</label>
                        <input type="text" placeholder="/" value={newItem.path} onChange={e => setNewItem({ ...newItem, path: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: '0 0 140px' }}>
                        <label>所屬層級</label>
                        <select value={newItem.parentId || ''} onChange={e => setNewItem({ ...newItem, parentId: e.target.value || null })}>
                            <option value="">頂層導航</option>
                            {navItems.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                        </select>
                    </div>
                    <button onClick={handleAddLink} className="btn btn-primary" style={{ height: '42px', flex: '0 0 auto', whiteSpace: 'nowrap' }}>加入</button>
                </div>
            </div>

            {loading ? <div className="loading-container"><div className="loading-spinner"></div></div> : (
                <div className="nav-manage-list">
                    {navItems.map((item, idx) => (
                        <div key={item.id} className="nav-group-item" onDragOver={(e) => onDragOver(e, idx)}>
                            {/* 主選單項目 */}
                            <div
                                className="nav-row main-row"
                                draggable
                                onDragStart={(e) => onDragStart(e, idx)}
                            >
                                <div className="drag-handle"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg></div>
                                <div className="nav-info">
                                    <span className="label">{item.label}</span>
                                    <span className="path">{item.path}</span>
                                </div>
                                <div className="nav-actions">
                                    <label className="toggle-label"><input type="checkbox" checked={item.visible} onChange={() => toggleVisible(item.id)} /> <span>{item.visible ? '顯示' : '隱藏'}</span></label>
                                    <button className="btn-icon" onClick={() => setNewItem({ ...newItem, parentId: item.id })} title="新增子項目"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
                                    {!DEFAULT_IDS.includes(item.id) && <button className="btn-icon btn-delete" onClick={() => handleDelete(item.id)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>}
                                </div>
                            </div>

                            {/* 子選單列表 */}
                            {item.children && item.children.length > 0 && (
                                <div className="nav-children">
                                    {item.children.map((child, cIdx) => (
                                        <div
                                            key={child.id}
                                            className="nav-row child-row"
                                            draggable
                                            onDragStart={(e) => onDragStart(e, cIdx, item.id)}
                                            onDragOver={(e) => onDragOver(e, cIdx, item.id)}
                                        >
                                            <div className="drag-handle"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg></div>
                                            <div className="nav-info">
                                                <span className="label">{child.label}</span>
                                                <span className="path">{child.path}</span>
                                            </div>
                                            <div className="nav-actions">
                                                <label className="toggle-label"><input type="checkbox" checked={child.visible} onChange={() => toggleVisible(child.id)} /> <span>{child.visible ? '顯示' : '隱藏'}</span></label>
                                                <button className="btn-icon btn-delete" onClick={() => handleDelete(child.id, item.id)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default NavAdminPage;
