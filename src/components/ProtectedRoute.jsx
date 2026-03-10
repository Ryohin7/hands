import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

function ProtectedRoute({ children, requiredRole }) {
    const [user, setUser] = useState(undefined);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (u) {
                const docRef = doc(db, 'users', u.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setProfile(docSnap.data());
                } else {
                    setProfile(null);
                }
            } else {
                setProfile(null);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    if (loading || user === undefined) {
        return (
            <div className="loading-container">
                <div className="loading-spinner" />
                <p>載入中...</p>
            </div>
        );
    }

    if (!user) {
        const loginPath = location.pathname.startsWith('/staff') ? '/staff/login' : '/login';
        return <Navigate to={loginPath} state={{ from: location }} replace />;
    }

    // 管理員跳過後續審核檢查，但需符合角色要求
    if (profile?.role === 'admin') {
        return children;
    }

    // Admin 路由檢查 (必須是 admin)
    if (requiredRole === 'admin') {
        if (!profile || profile.role !== 'admin') {
            return (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2>權限不足</h2>
                    <p>該頁面僅限系統管理員訪問。</p>
                    <button onClick={() => window.history.back()} className="btn btn-outline" style={{ marginTop: '1rem' }}>返回上一頁</button>
                    <button onClick={() => auth.signOut()} className="btn btn-ghost" style={{ marginTop: '0.5rem' }}>登出帳號</button>
                </div>
            );
        }
    }

    // Staff 路由檢查
    if (requiredRole === 'staff') {
        // 如果沒有 profile，或者角色不是 staff 且不是 admin (admin 已在上面處理過)
        if (!profile || (profile.role !== 'staff' && profile.role !== 'admin')) {
             return <Navigate to="/" replace />;
        }

        // 如果是 staff 但尚未核准
        if (profile.role === 'staff' && !profile.isApproved) {
            return (
                <div className="login-page">
                    <div className="login-card" style={{ textAlign: 'center' }}>
                        <div className="login-icon" style={{ marginBottom: '1rem' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>帳號審核中</h1>
                        <p style={{ color: '#666', marginBottom: '1.5rem' }}>您的帳號尚未通過管理員審核，通過後即可使用員工功能。</p>
                        <button onClick={() => auth.signOut()} className="btn btn-primary btn-full">登出並返回</button>
                    </div>
                </div>
            );
        }
    }


    return children;
}

export default ProtectedRoute;

