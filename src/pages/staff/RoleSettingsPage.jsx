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
    { id: 'dashboard_view', label: '儀表板檢視' },
    { id: 'coupon_apply', label: '電子券申請' },
    { id: 'coupon_audit', label: '電子券審核' },
    { id: 'user_audit', label: '員工帳號審核' },
    { id: 'role_settings', label: '角色權限設定' },
    { id: 'member_action', label: '會員資料異動' },
    { id: 'member_audit', label: '會員異動審核' },
    { id: 'store_manage', label: '門市資訊維護' },
    { id: 'data_report', label: '資料報表查詢' },
    { id: 'project_manage', label: '專案管理（新增/編輯）' },
    { id: 'project_settings', label: '專案分類設定' },
];

function RoleSettingsPage() {
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [newRoleName, setNewRoleName] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('roles'); // roles, assignment

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
        <div className="admin-page-content role-settings-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">職能與權限管理</h2>
            </div>

            {/* Tab Navigation */}
            <div className="admin-tabs">
                <button
                    className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('roles')}
                >
                    角色定義
                </button>
                <button
                    className={`tab-btn ${activeTab === 'assignment' ? 'active' : ''}`}
                    onClick={() => setActiveTab('assignment')}
                >
                    用戶角色指派
                </button>
            </div>

            {activeTab === 'roles' ? (
                /* 角色管理 */
                <div className="card roles-manage-card">
                    <div className="card-header">
                        <h3 className="card-title">新增與編輯角色</h3>
                    </div>
                    <div className="card-body">
                        <form onSubmit={handleAddRole} className="add-role-form">
                            <input
                                type="text"
                                placeholder="角色名稱 (如: 門市主管)"
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                className="form-control role-input"
                            />
                            <button className="btn btn-primary btn-add-role" disabled={loading}>新增角色</button>
                        </form>

                        <div className="roles-list-grid">
                            {roles.map(role => (
                                <div key={role.id} className="role-card">
                                    <div className="role-card-header">
                                        <strong className="role-name-text">{role.name}</strong>
                                        <button
                                            onClick={() => handleDeleteRole(role.id)}
                                            className="btn-icon btn-delete-role"
                                        >
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" /></svg>
                                        </button>
                                    </div>
                                    <div className="role-settings-perms-grid">
                                        {AVAILABLE_PERMISSIONS.map(perm => (
                                            <label key={perm.id} className="perm-label">
                                                <input
                                                    type="checkbox"
                                                    checked={role.permissions.includes(perm.id)}
                                                    onChange={() => togglePermission(role, perm.id)}
                                                    className="perm-checkbox"
                                                />
                                                {perm.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                /* 用戶指派 */
                <div className="card">
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>姓名</th>
                                    <th>門市</th>
                                    <th>職務</th>
                                    <th>LINE 綁定狀態</th>
                                    <th className="col-role-select">變更職能角色</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.filter(u => u.role !== 'admin').map(user => (
                                    <tr key={user.id}>
                                        <td className="cell-name">{user.displayName || '未設定'}</td>
                                        <td>{user.storeName || '-'}</td>
                                        <td>
                                            <span className={`tag ${user.roleId ? 'tag-blue' : 'tag-gray'}`}>
                                                {user.roleName || '未指派'}
                                            </span>
                                        </td>
                                        <td>
                                            {user.lineUserId ? (
                                                <span className="tag tag-green">● 已綁定</span>
                                            ) : (
                                                <span className="tag tag-orange">○ 未綁定</span>
                                            )}
                                        </td>
                                        <td>
                                            <select
                                                className="form-control select-role"
                                                value={user.roleId || ''}
                                                onChange={(e) => handleAssignRole(user.id, e.target.value)}
                                            >
                                                <option value="" disabled>指派新角色</option>
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
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .role-settings-page .admin-tabs {
                    margin-bottom: 1.5rem;
                    display: flex;
                    gap: 0.5rem;
                    border-bottom: 1px solid #ddd;
                }
                .role-settings-page .admin-tabs .tab-btn {
                    padding: 0.75rem 1.5rem;
                    border: none;
                    background: none;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    color: #666;
                    font-weight: normal;
                    transition: all 0.2s;
                }
                .role-settings-page .admin-tabs .tab-btn.active {
                    border-bottom: 3px solid #007130;
                    color: #007130;
                    font-weight: bold;
                }
                .role-settings-page .roles-manage-card {
                    max-width: 800px;
                }
                .role-settings-page .card-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #eee;
                }
                .role-settings-page .card-title {
                    margin: 0;
                    font-size: 1.25rem;
                }
                .role-settings-page .card-body {
                    padding: 1.5rem;
                }
                .role-settings-page .add-role-form {
                    display: flex;
                    gap: 0.5rem;
                    margin-bottom: 2rem;
                }
                .role-settings-page .role-input {
                    flex: 1;
                    height: 42px;
                }
                .role-settings-page .btn-add-role {
                    height: 42px;
                }
                .role-settings-page .roles-list-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                }
                .role-settings-page .role-card {
                    padding: 1.25rem;
                    border: 1px solid #eee;
                    border-radius: 8px;
                    background: #fcfcfc;
                }
                .role-settings-page .role-card-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 1.25rem;
                    align-items: center;
                }
                .role-settings-page .role-name-text {
                    font-size: 1.15rem;
                    color: #333;
                }
                .role-settings-page .btn-delete-role {
                    color: #800019;
                }
                .role-settings-page .perm-label {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    font-size: 0.875rem;
                    padding: 0.4rem 0;
                    cursor: pointer;
                }
                .role-settings-page .perm-checkbox {
                    width: 16px;
                    height: 16px;
                    accent-color: #007130;
                }
                .role-settings-page .col-role-select {
                    min-width: 150px;
                }
                .role-settings-page .cell-name {
                    font-weight: 500;
                }
                .role-settings-page .select-role {
                    padding: 6px 10px;
                    font-size: 0.875rem;
                }
                .role-settings-page .tag-blue {
                    background: #E1F5FE;
                    color: #0288D1;
                    border: none;
                }
                .role-settings-page .tag-gray {
                    background: #F5F5F5;
                    color: #757575;
                    border: none;
                }
                .role-settings-page .tag-green {
                    background: #E8F5E9;
                    color: #2E7D32;
                    border: none;
                }
                .role-settings-page .tag-orange {
                    background: #FFF3E0;
                    color: #E65100;
                    border: none;
                }

                .role-settings-perms-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.25rem;
                }
                .btn-icon {
                    background: none;
                    border: none;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: all 0.2s;
                }
                .btn-icon:hover {
                    background: #fee2e2;
                }
                @media (max-width: 480px) {
                    .role-settings-perms-grid {
                        grid-template-columns: 1fr;
                    }
                }
            ` }} />
        </div>
    );
}

export default RoleSettingsPage;
