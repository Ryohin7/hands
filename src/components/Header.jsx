import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase';

function Header() {
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [navItems, setNavItems] = useState([]);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        fetchNav();
        return unsub;
    }, []);

    async function fetchNav() {
        try {
            const q = query(collection(db, 'nav_settings'), orderBy('order', 'asc'));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setNavItems(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.visible));
            } else {
                // 預設
                setNavItems([
                    { id: '1', label: '首頁', path: '/' },
                    { id: '2', label: '門市資訊', path: '/stores' },
                    { id: '3', label: '最新 DM', path: '/dm' }
                ]);
            }
        } catch (err) {
            console.error('Fetch nav failed:', err);
        }
    }

    const isAdmin = location.pathname.startsWith('/admin');

    return (
        <header className="header">
            <div className="header-inner">
                <Link to="/" className="header-logo">
                    <span>HANDS 台隆手創館</span>
                </Link>
                <nav className="header-nav">
                    {!isAdmin && navItems.map(item => (
                        <div key={item.id} className={`nav-item-wrapper ${item.children && item.children.length > 0 ? 'has-dropdown' : ''}`}>
                            {item.path ? (
                                <Link
                                    to={item.path}
                                    className={`header-link ${location.pathname === item.path ? 'active' : ''}`}
                                >
                                    {item.label}
                                    {item.children && item.children.length > 0 && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    )}
                                </Link>
                            ) : (
                                <span className="header-link" style={{ cursor: 'default' }}>
                                    {item.label}
                                    {item.children && item.children.length > 0 && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    )}
                                </span>
                            )}
                            {item.children && item.children.length > 0 && (
                                <div className="header-dropdown">
                                    {item.children.filter(c => c.visible).map(child => (
                                        <Link key={child.id} to={child.path} className="dropdown-link">
                                            {child.label}
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>
            </div>
        </header>
    );
}

export default Header;
