import { useState, useEffect } from 'react';
import { auth, db } from '../../firebase';
import { updateProfile, updatePassword } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';

function ProfileSettingsPage() {
    const [name, setName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // 確認新密碼
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', content: '' });
    const [stores, setStores] = useState([]); // 門市清單

    const formGroupStyle = { marginBottom: '1.25rem' };

    useEffect(() => {
        const fetchProfile = async () => {
            if (auth.currentUser) {
                const docRef = doc(db, 'users', auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setName(data.displayName || '');
                    setStoreName(data.storeName || '');
                }
            }
        };
        const fetchStores = async () => {
            const querySnapshot = await getDocs(query(collection(db, 'stores'), orderBy('name', 'asc')));
            setStores(querySnapshot.docs.map(doc => doc.data().name));
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
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">個人資料變更</h2>
            </div>

            {message.content && (
                <div className={`alert alert-${message.type}`} style={{ 
                    padding: '1rem', 
                    marginBottom: '1.5rem', 
                    borderRadius: '8px',
                    background: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                    color: message.type === 'success' ? '#065F46' : '#991B1B',
                    border: `1px solid ${message.type === 'success' ? '#A7F3D0' : '#FECACA'}`
                }}>
                    {message.content}
                </div>
            )}

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3>基本資料</h3>
                    <form onSubmit={handleUpdateProfile} style={{ marginTop: '1rem' }}>
                        <div className="form-group" style={formGroupStyle}>
                            <label>真實姓名</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group" style={formGroupStyle}>
                            <label>所屬門市</label>
                            {stores.length > 0 ? (
                                <select 
                                    className="form-control"
                                    value={storeName} 
                                    onChange={(e) => setStoreName(e.target.value)} 
                                    required 
                                    style={{ width: '100%', height: '42px' }}
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
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '1rem' }}>
                            {loading ? '儲存中...' : '儲存變更'}
                        </button>
                    </form>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3>修改密碼</h3>
                    <form onSubmit={handleChangePassword} style={{ marginTop: '1rem' }}>
                        <div className="form-group" style={formGroupStyle}>
                            <label>新密碼 (至少 6 位)</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                placeholder="請輸入新密碼"
                            />
                        </div>
                        <div className="form-group" style={formGroupStyle}>
                            <label>確認新密碼</label>
                            <input 
                                type="password" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                placeholder="請再次輸入新密碼"
                            />
                        </div>
                        <button type="submit" className="btn btn-outline" disabled={loading} style={{ marginTop: '1rem', width: '100%' }}>
                            {loading ? '修改中...' : '確認修改密碼'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ProfileSettingsPage;
