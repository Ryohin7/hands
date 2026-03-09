import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

function Header() {
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [navItems, setNavItems] = useState([]);
    const [menuOpen, setMenuOpen] = useState(false);
    const [siteSettings, setSiteSettings] = useState({
        siteName: 'HANDS 台隆手創館',
        seoTitle: '台隆手創館公告',
        seoDescription: '最新消息與通知'
    });

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u));
        fetchNav();
        fetchSettings();
        return unsub;
    }, []);

    // 當路徑改變時，自動關閉手機版選單
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // 更新 SEO 標記 (若非後台頁面)
    useEffect(() => {
        if (!location.pathname.startsWith('/admin')) {
            document.title = siteSettings.seoTitle;
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.setAttribute('content', siteSettings.seoDescription);
            }
        }
    }, [location.pathname, siteSettings]);

    async function fetchSettings() {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'site'));
            if (docSnap.exists()) {
                setSiteSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        } catch (err) {
            console.error('Fetch header settings failed:', err);
        }
    }

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
                    <span>{siteSettings.siteName}</span>
                </Link>

                {!isAdmin && (
                    <button 
                        className="mobile-menu-toggle" 
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="選單"
                    >
                        {menuOpen ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        )}
                    </button>
                )}

                <nav className={`header-nav ${menuOpen ? 'mobile-open' : ''}`}>
                    {!isAdmin && navItems.map(item => (
                        <div key={item.id} className={`nav-item-wrapper ${item.children && item.children.length > 0 ? 'has-dropdown' : ''}`}>
                            {item.path ? (
                                <Link
                                    to={item.path}
                                    className={`header-link ${location.pathname === item.path ? 'active' : ''}`}
                                >
                                    {item.label}
                                    {item.children && item.children.length > 0 && (
                                        <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    )}
                                </Link>
                            ) : (
                                <span className="header-link" style={{ cursor: 'default' }}>
                                    {item.label}
                                    {item.children && item.children.length > 0 && (
                                        <svg className="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
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
            {menuOpen && <div className="header-overlay" onClick={() => setMenuOpen(false)}></div>}
        </header>
    );
}

export default Header;
