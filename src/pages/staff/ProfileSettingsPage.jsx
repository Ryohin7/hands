import { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

function ProfileSettingsPage() {
    const [name, setName] = useState('');
    const [username, setUsername] = useState(''); // 新增帳號狀態
    const [storeName, setStoreName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', content: '' });
    const [stores, setStores] = useState([]); // 門市清單

    useEffect(() => {
        const fetchProfile = async () => {
            if (auth.currentUser) {
                const docRef = doc(db, 'users', auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setName(data.displayName || '');
                    setUsername(data.username || data.email?.split('@')[0] || ''); // 獲取帳號
                    setStoreName(data.storeName || '');
                }
            }
        };
        const fetchStores = async () => {
            const querySnapshot = await getDocs(query(collection(db, 'stores'), orderBy('name', 'asc')));
            let fetchedStores = querySnapshot.docs.map(doc => doc.data().name);
            // 確保「總公司」在選單最後一個選項
            if (!fetchedStores.includes('總公司')) {
                fetchedStores.push('總公司');
            }
            setStores(fetchedStores);
        };
        fetchProfile();
        fetchStores();
    }, []);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', content: '' });
        try {
            // Update Firebase Auth
            await updateProfile(auth.currentUser, { displayName: name });
            
            // Update Firestore
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, {
                displayName: name,
                storeName: storeName
            });

            setMessage({ type: 'success', content: '資料更新成功！ 部分變更可能於下次登入生效。' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', content: '更新失敗，請稍後再試。' });
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (!newPassword || newPassword.length < 6) {
            setMessage({ type: 'error', content: '密碼長度至少需 6 位數' });
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', content: '兩次輸入的密碼不一致' });
            return;
        }
        setLoading(true);
        try {
            await updatePassword(auth.currentUser, newPassword);
            setNewPassword('');
            setConfirmPassword('');
            setMessage({ type: 'success', content: '密碼修改成功！' });
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/requires-recent-login') {
                setMessage({ type: 'error', content: '為了安全，修改密碼前請重新登入。' });
            } else {
                setMessage({ type: 'error', content: '密碼修改失敗：' + err.message });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page-content profile-settings-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">個人資料變更</h2>
            </div>

            {message.content && (
                <div className={`alert alert-${message.type}`}>
                    {message.content}
                </div>
            )}

            <div className="grid-2">
                <div className="card">
                    <h3>基本資料</h3>
                    <form onSubmit={handleUpdateProfile}>
                        <div className="form-group">
                            <label>帳號 (不可修改)</label>
                            <input 
                                type="text" 
                                value={username} 
                                readOnly 
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label>真實姓名</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>所屬門市</label>
                            {stores.length > 0 ? (
                                <select 
                                    className="form-control"
                                    value={storeName} 
                                    onChange={(e) => setStoreName(e.target.value)} 
                                    required 
                                >
                                    {stores.map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    type="text" 
                                    value={storeName} 
                                    onChange={(e) => setStoreName(e.target.value)} 
                                    required 
                                />
                            )}
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? '儲存中...' : '儲存變更'}
                        </button>
                    </form>
                </div>

                <div className="card">
                    <h3>修改密碼</h3>
                    <form onSubmit={handleChangePassword}>
                        <div className="form-group">
                            <label>新密碼 (至少 6 位)</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                placeholder="請輸入新密碼"
                            />
                        </div>
                        <div className="form-group">
                            <label>確認新密碼</label>
                            <input 
                                type="password" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                placeholder="請再次輸入新密碼"
                            />
                        </div>
                        <button type="submit" className="btn btn-outline btn-full" disabled={loading}>
                            {loading ? '修改中...' : '確認修改密碼'}
                        </button>
                    </form>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .profile-settings-page .grid-2 {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                }
                .profile-settings-page .card {
                    padding: 1.5rem;
                }
                .profile-settings-page form {
                    margin-top: 1rem;
                }
                .profile-settings-page .form-group {
                    margin-bottom: 1.25rem;
                }
                .profile-settings-page input[disabled] {
                    background: #f5f5f5;
                    cursor: not-allowed;
                }
                .profile-settings-page select.form-control {
                    width: 100%;
                    height: 42px;
                }
                .profile-settings-page .btn {
                    margin-top: 1rem;
                }
                .profile-settings-page .btn-full {
                    width: 100%;
                }
                .profile-settings-page .alert {
                    padding: 1rem;
                    margin-bottom: 1.5rem;
                    border-radius: 8px;
                    border: 1px solid transparent;
                }
                .profile-settings-page .alert-success {
                    background: #ECFDF5;
                    color: #065F46;
                    border-color: #A7F3D0;
                }
                .profile-settings-page .alert-error {
                    background: #FEF2F2;
                    color: #991B1B;
                    border-color: #FECACA;
                }
            `}} />
        </div>
    );
}

export default ProfileSettingsPage;
