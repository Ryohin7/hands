import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
    collection, addDoc, deleteDoc, doc,
    onSnapshot, query, orderBy, serverTimestamp, updateDoc
} from 'firebase/firestore';

function ProjectSettingsPage() {
    const [categories, setCategories] = useState([]);
    const [newName, setNewName]       = useState('');
    const [loading, setLoading]       = useState(false);

    useEffect(() => {
        const q = query(collection(db,'project_categories'), orderBy('order','asc'));
        const unsub = onSnapshot(q, snap => setCategories(snap.docs.map(d=>({ id:d.id,...d.data() }))));
        return unsub;
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setLoading(true);
        try {
            await addDoc(collection(db,'project_categories'), {
                name: newName.trim(), order: categories.length, createdAt: serverTimestamp()
            });
            setNewName('');
        } catch(err){ alert('新增失敗'); } finally { setLoading(false); }
    };

    const handleDelete = async (id) => {
        if (!confirm('確定刪除此分類？')) return;
        await deleteDoc(doc(db,'project_categories',id));
    };

    return (
        <div className="admin-page-content">
            <div className="admin-content-header" style={{marginBottom:'1.5rem'}}>
                <h2 className="admin-content-title">專案分類設定</h2>
                <p style={{color:'#6B7280',fontSize:'0.875rem',marginTop:'0.25rem'}}>管理專案新增時可選用的分類標籤</p>
            </div>

            <div className="card" style={{maxWidth:'600px', padding:'2rem', borderRadius:'16px', boxShadow:'0 4px 12px rgba(0,0,0,0.05)', border:'1px solid #F3F4F6'}}>
                <form onSubmit={handleAdd} style={{display:'flex', gap:'1rem', marginBottom:'2rem'}}>
                    <input
                        className="form-control"
                        placeholder="新分類名稱（如：系統開發、行政流程）"
                        value={newName}
                        onChange={e=>setNewName(e.target.value)}
                        style={{flex:1, padding:'0.75rem 1rem', borderRadius:'12px', border:'1.5px solid #E5E7EB', outline:'none', fontSize:'0.95rem'}}
                        id="ps-category-input"
                    />
                    <button className="btn btn-primary" disabled={loading} style={{whiteSpace:'nowrap', padding:'0 1.5rem', borderRadius:'12px', fontWeight:'600'}} id="ps-category-add-btn">
                        新增分類
                    </button>
                </form>

                {categories.length === 0 ? (
                    <div style={{textAlign:'center', padding:'3rem 0', background:'#F9FAFB', borderRadius:'12px', border:'2px dashed #E5E7EB'}}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" style={{marginBottom:'1rem'}}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                        <p style={{color:'#9CA3AF', fontSize:'0.9rem'}}>尚無分類，請輸入名稱並點擊新增</p>
                    </div>
                ) : (
                    <div style={{display:'flex', flexDirection:'column', gap:'0.75rem'}}>
                        {categories.map((cat, idx) => (
                            <div key={cat.id} className="ps-category-item" style={{display:'flex', alignItems:'center', gap:'1rem', padding:'1rem 1.25rem', background:'#fff', borderRadius:'12px', border:'1.5px solid #F3F4F6', transition:'all 0.2s', boxShadow:'0 2px 4px rgba(0,0,0,0.02)'}}>
                                <span style={{width:'28px', height:'28px', background:'#E8F5E9', color:'#007130', borderRadius:'8px', fontSize:'0.85rem', fontWeight:'800', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>{idx+1}</span>
                                <span style={{flex:1, fontWeight:'600', color:'#111827', fontSize:'1rem'}}>{cat.name}</span>
                                <button
                                    onClick={()=>handleDelete(cat.id)}
                                    className="ps-delete-btn"
                                    style={{background:'#FFF1F2', border:'none', cursor:'pointer', color:'#E11D48', padding:'8px', borderRadius:'10px', display:'flex', transition:'all 0.2s'}}
                                    id={`ps-delete-${cat.id}`}
                                    title="刪除分類"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                .ps-category-item:hover { border-color: #A7F3D0; transform: translateX(5px); box-shadow: 0 4px 12px rgba(0,113,48,0.05); }
                .ps-delete-btn:hover { background: #FFE4E6; color: #BE123C; transform: scale(1.1); }
                #ps-category-input:focus { border-color: #007130; box-shadow: 0 0 0 4px rgba(0,113,48,0.05); }
            `}</style>
        </div>
    );
}

export default ProjectSettingsPage;
