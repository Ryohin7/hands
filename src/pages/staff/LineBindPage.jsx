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
    const [username, setUsername] = useState(''); // 改用帳號
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
            // 自動判斷：如果輸入已包含 @ 則視為完整 Email，否則補上預設網域
            const email = username.includes('@') ? username : `${username}@hands.com.tw`;
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

    if (loading) return <div className="line-bind-loading">載入中...</div>;

    if (!lineUserId) {
        return (
            <div className="line-bind-invalid">
                <div className="error-title">⚠️ 連結無效</div>
                <p>請從 LINE 官方帳號點擊綁定連結進入此頁面。</p>
            </div>
        );
    }

    return (
        <div className="line-bind-page">
            <div className="line-bind-header">
                <h2 className="line-bind-title">LINE 帳號綁定</h2>
                <p className="line-bind-subtitle">請登入您的員工帳號以完成綁定</p>
            </div>

            {user ? (
                <div className="card logged-in-card">
                    <div className="user-info">
                        <div className="info-label">當前登入帳號</div>
                        <div className="info-value">{user.email}</div>
                    </div>
                    <button
                        className="btn btn-primary btn-full"
                        onClick={handleBind}
                        disabled={binding}
                    >
                        {binding ? '處理中...' : '確認綁定此 LINE 帳號'}
                    </button>
                    <button
                        className="btn btn-ghost btn-switch-user"
                        onClick={() => auth.signOut()}
                    >
                        切換帳號登入
                    </button>
                </div>
            ) : (
                <form className="card login-form" onSubmit={handleLogin}>
                    {error && (
                        <div className="alert alert-error">
                            {error}
                        </div>
                    )}
                    <div className="form-group form-group-user">
                        <label>帳號</label>
                        <input
                            type="text"
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="請輸入帳號"
                            required
                        />
                    </div>
                    <div className="form-group form-group-pass">
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

            <style dangerouslySetInnerHTML={{ __html: `
                .line-bind-loading {
                    padding: 2rem;
                    text-align: center;
                }
                .line-bind-invalid {
                    padding: 2rem;
                    text-align: center;
                }
                .line-bind-invalid .error-title {
                    color: #d32f2f;
                    margin-bottom: 1rem;
                    font-size: 1.2rem;
                    font-weight: bold;
                }
                .line-bind-page {
                    max-width: 400px;
                    margin: 0 auto;
                    padding: 3rem 1.5rem;
                }
                .line-bind-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }
                .line-bind-title {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #007130;
                }
                .line-bind-subtitle {
                    color: #666;
                    font-size: 0.875rem;
                    margin-top: 0.5rem;
                }
                .line-bind-page .card {
                    padding: 1.5rem;
                }
                .line-bind-page .logged-in-card {
                    text-align: center;
                }
                .line-bind-page .user-info {
                    margin-bottom: 1rem;
                }
                .line-bind-page .info-label {
                    font-size: 0.875rem;
                    color: #666;
                }
                .line-bind-page .info-value {
                    font-size: 1.125rem;
                    font-weight: 600;
                }
                .line-bind-page .btn-switch-user {
                    margin-top: 1rem;
                    font-size: 0.8125rem;
                }
                .line-bind-page .alert-error {
                    color: #d32f2f;
                    background: #fef2f2;
                    padding: 0.75rem;
                    border-radius: 4px;
                    font-size: 0.875rem;
                    margin-bottom: 1rem;
                    border: 1px solid #fecaca;
                }
                .line-bind-page .form-group-user {
                    margin-bottom: 1rem;
                }
                .line-bind-page .form-group-pass {
                    margin-bottom: 1.5rem;
                }
                .line-bind-page .btn-full {
                    width: 100%;
                }
            `}} />
        </div>
    );
}

export default LineBindPage;
