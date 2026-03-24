import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDocs, collection, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../../firebase';

function StaffLoginPage() {
    const navigate = useNavigate();
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState(''); // 改用帳號
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [storeName, setStoreName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [stores, setStores] = useState([]); // 門市清單

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const q = query(collection(db, 'stores'), orderBy('name', 'asc'));
                const querySnapshot = await getDocs(q);
                let storeList = querySnapshot.docs.map(doc => doc.data().name);
                
                // 確保「總公司」在選單最後一個選項
                if (!storeList.includes('總公司')) {
                    storeList.push('總公司');
                }
                
                setStores(storeList);
                if (storeList.length > 0) setStoreName(storeList[0]);
            } catch (err) {
                console.error("Error fetching stores:", err);
            }
        };
        fetchStores();
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (isRegister && password.length < 6) {
            setError('密碼強度不足（至少 6 位元）');
            setLoading(false);
            return;
        }

        // 自動判斷：如果輸入已包含 @ 則視為完整 Email，否則補上預設網域
        const email = username.includes('@') ? username : `${username}@hands.com.tw`; 

        try {
            if (isRegister) {
                let user;
                try {
                    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                    user = userCredential.user;
                } catch (err) {
                    if (err.code === 'auth/email-already-in-use') {
                        // 如果信箱已註冊，嘗試以此密碼登入以完成資料建立 (針對之前權限不足導致寫入失敗的情況)
                        const userCredential = await signInWithEmailAndPassword(auth, email, password);
                        user = userCredential.user;
                    } else {
                        throw err;
                    }
                }

                // 建立/更新用戶檔案
                await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                    email,
                    username, // 儲存帳號
                    displayName: name,
                    storeName,
                    role: 'staff',
                    isApproved: false,
                    permissions: [],
                    createdAt: serverTimestamp()
                }, { merge: true });

                // 註冊後會由 ProtectedRoute 攔截顯示審核中
                navigate('/staff');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                navigate('/staff');
            }
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use' || err.code === 'auth/account-exists-with-different-credential') {
                setError('該帳號已被註冊');
            } else if (err.code === 'auth/invalid-credential') {
                setError('帳號或密碼錯誤');
            } else if (err.code === 'auth/weak-password') {
                setError('密碼強度不足（至少 6 位元）');
            } else if (err.code === 'auth/user-not-found') {
              setError('帳號不存在');
            } else {
                setError('操作失敗，請重試');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#007130" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <h1>員工入口</h1>
                    <p>{isRegister ? '請填寫註冊資訊，需經管理員審核' : '請輸入您的帳號密碼'}</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="login-error">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                            {error}
                        </div>
                    )}

                    {isRegister && (
                        <>
                            <div className="form-group">
                                <label htmlFor="name">姓名</label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="請輸入姓名"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="storeName">所屬門市</label>
                                {stores.length > 0 ? (
                                    <select
                                        id="storeName"
                                        value={storeName}
                                        onChange={(e) => setStoreName(e.target.value)}
                                        className="form-control"
                                        required
                                        style={{ width: '100%', height: '42px', borderRadius: '6px', border: '1px solid #ddd', padding: '0 10px' }}
                                    >
                                        {stores.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        id="storeName"
                                        type="text"
                                        value={storeName}
                                        onChange={(e) => setStoreName(e.target.value)}
                                        placeholder="例如：南港店或024"
                                        required
                                    />
                                )}
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label htmlFor="username">帳號</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="請輸入常用員工帳號"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密碼</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="請輸入密碼"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                        {loading ? '處理中...' : (isRegister ? '註冊' : '登入')}
                    </button>

                    <button
                        type="button"
                        className="btn btn-ghost btn-full"
                        onClick={() => setIsRegister(!isRegister)}
                        style={{ marginTop: '0.5rem' }}
                    >
                        {isRegister ? '已有帳號？前往登入' : '還沒有帳號？前往註冊'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default StaffLoginPage;
