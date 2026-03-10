import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { 
    collection, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    doc, 
    updateDoc,
    query,
    orderBy,
    where,
    writeBatch,
    onSnapshot
} from 'firebase/firestore';

const AVAILABLE_PERMISSIONS = [
    { id: 'coupon_apply', label: '電子券申請' },
    { id: 'coupon_audit', label: '電子券審核' },
    { id: 'user_audit', label: '員工帳號審核' },
    { id: 'role_settings', label: '角色權限設定' },
    { id: 'member_action', label: '會員資料異動' },
    { id: 'member_audit', label: '會員異動審核' },
    { id: 'store_manage', label: '門市資訊維護' },
    { id: 'data_report', label: '資料報表查詢' },
];

function RoleSettingsPage() {
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingRole, setEditingRole] = useState(null);

    useEffect(() => {
        // 即時監聽角色
        const unsubRoles = onSnapshot(collection(db, 'roles'), (snapshot) => {
            setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // 即時監聽用戶
        const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubRoles();
            unsubUsers();
        };
    }, []);

    const handleAddRole = async (e) => {
        e.preventDefault();
        if (!newRoleName) return;
        setLoading(true);
        try {
            await addDoc(collection(db, 'roles'), {
                name: newRoleName,
                permissions: []
            });
            setNewRoleName('');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRole = async (id) => {
        if (!confirm('確定要刪除此角色？')) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'roles', id));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = async (role, permId) => {
        const newPerms = role.permissions.includes(permId)
            ? role.permissions.filter(p => p !== permId)
            : [...role.permissions, permId];
        
        try {
            const batch = writeBatch(db);
            
            // 1. 更新角色權限
            batch.update(doc(db, 'roles', role.id), {
                permissions: newPerms
            });

            // 2. 找到所有屬於該角色的用戶並同步更新權限
            // 注意：由於 Firestore 查詢限制，如果用戶非常多建議改用 Firebase Cloud Functions
            // 這裡針對一般量級使用 batch 更新
            const usersWithRoleQuery = query(collection(db, 'users'), where('roleId', '==', role.id));
            const usersSnapshot = await getDocs(usersWithRoleQuery);
            
            usersSnapshot.docs.forEach(uDoc => {
                batch.update(uDoc.ref, { permissions: newPerms });
            });

            await batch.commit();
        } catch (err) {
            console.error("同步權限失敗:", err);
            alert('同步權限失敗');
        }
    };

    const handleAssignRole = async (userId, roleId) => {
        const role = roles.find(r => r.id === roleId);
        if (!role) return;
        try {
            await updateDoc(doc(db, 'users', userId), {
                roleId: roleId,
                roleName: role.name,
                permissions: role.permissions
            });
            alert('角色指派成功');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">角色權限設定</h2>
            </div>

            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* 角色管理 */}
                <div className="card">
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee' }}>
                        <h3>角色定義</h3>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <form onSubmit={handleAddRole} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            <input 
                                type="text" 
                                placeholder="角色名稱 (如: 門市主管)" 
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                className="form-control"
                                style={{ flex: 1, padding: '8px', border: '1px solid #ddd' }}
                            />
                            <button className="btn btn-primary" disabled={loading}>新增角色</button>
                        </form>

                        {roles.map(role => (
                            <div key={role.id} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #eee', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <strong style={{ fontSize: '1.1rem' }}>{role.name}</strong>
                                    <button onClick={() => handleDeleteRole(role.id)} style={{ color: '#DC2626', border: 'none', background: 'none', cursor: 'pointer' }}>刪除</button>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    {AVAILABLE_PERMISSIONS.map(perm => (
                                        <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={role.permissions.includes(perm.id)}
                                                onChange={() => togglePermission(role, perm.id)}
                                            />
                                            {perm.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 用戶指派 */}
                <div className="card">
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee' }}>
                        <h3>用戶角色指派</h3>
                    </div>
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>用戶</th>
                                    <th>目前角色</th>
                                    <th>指派新角色</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.filter(u => u.role !== 'admin').map(user => (
                                    <tr key={user.id}>
                                        <td>
                                            <div>{user.displayName}</div>
                                            <small style={{ color: '#999' }}>{user.storeName}</small>
                                        </td>
                                        <td>{user.roleName || '未指派'}</td>
                                        <td>
                                            <select 
                                                value={user.roleId || ''} 
                                                onChange={(e) => handleAssignRole(user.id, e.target.value)}
                                                style={{ padding: '4px', border: '1px solid #ddd', borderRadius: '4px' }}
                                            >
                                                <option value="" disabled>請選擇角色</option>
                                                {roles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RoleSettingsPage;
