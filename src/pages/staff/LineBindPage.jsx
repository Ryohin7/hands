import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

function LineBindPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const lineUserId = searchParams.get('lineUserId');
    
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [binding, setBinding] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setBinding(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // 登入後 useEffect 會捕捉到 user 變化
        } catch (err) {
            setError('登入失敗，請檢查帳號密碼');
            setBinding(false);
        }
    };

    const handleBind = async () => {
        if (!user || !lineUserId) return;
        setBinding(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                lineUserId: lineUserId,
                lineBoundAt: new Date()
            });
            alert('綁定成功！現在您可以關閉此視窗並回到 LINE 使用功能。');
            navigate('/staff');
        } catch (err) {
            console.error(err);
            setError('綁定失敗，請聯繫管理員');
        } finally {
            setBinding(false);
        }
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>載入中...</div>;

    if (!lineUserId) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ color: '#d32f2f', marginBottom: '1rem' }}>⚠️ 連結無效</div>
                <p>請從 LINE 官方帳號點擊綁定連結進入此頁面。</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '400px', margin: '0 auto', padding: '3rem 1.5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#007130' }}>LINE 帳號綁定</h2>
                <p style={{ color: '#666', fontSize: '0.875rem', marginTop: '0.5rem' }}>請登入您的員工帳號以完成綁定</p>
            </div>

            {user ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>當前登入帳號</div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>{user.email}</div>
                    </div>
                    <button 
                        className="btn btn-primary btn-full" 
                        onClick={handleBind}
                        disabled={binding}
                    >
                        {binding ? '處理中...' : '確認綁定此 LINE 帳號'}
                    </button>
                    <button 
                        className="btn btn-ghost" 
                        style={{ marginTop: '1rem', fontSize: '0.8125rem' }}
                        onClick={() => auth.signOut()}
                    >
                        切換帳號登入
                    </button>
                </div>
            ) : (
                <form className="card" style={{ padding: '1.5rem' }} onSubmit={handleLogin}>
                    {error && (
                        <div style={{ color: '#d32f2f', background: '#fef2f2', padding: '0.75rem', borderRadius: '4px', fontSize: '0.875rem', marginBottom: '1rem', border: '1px solid #fecaca' }}>
                            {error}
                        </div>
                    )}
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label>電子郵件</label>
                        <input 
                            type="email" 
                            className="form-control" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label>密碼</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button className="btn btn-primary btn-full" type="submit" disabled={binding}>
                        {binding ? '登入中...' : '登入並綁定'}
                    </button>
                </form>
            )}
        </div>
    );
}

export default LineBindPage;
