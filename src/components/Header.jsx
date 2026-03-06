import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';

function Header() {
    const location = useLocation();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        return unsub;
    }, []);

    const isAdmin = location.pathname.startsWith('/admin');

    return (
        <header className="header">
            <div className="header-inner">
                <Link to="/" className="header-logo">
                    <span>HANDS 台隆手創館</span>
                </Link>
                <nav className="header-nav">
                    {user && !isAdmin && (
                        <Link to="/admin" className="header-link">管理後台</Link>
                    )}
                    {user && isAdmin && (
                        <Link to="/" className="header-link">回到首頁</Link>
                    )}
                    {!user && (
                        <Link to="/login" className="header-link header-link-login">
                            管理登入
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}

export default Header;
