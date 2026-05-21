import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

function StaffLayout() {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [profile, setProfile] = useState(null);
    // Removed deferredPrompt and showInstallHint states as per instruction

    useEffect(() => {
        const fetchProfile = async () => {
            if (auth.currentUser) {
                const docRef = doc(db, 'users', auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setProfile(docSnap.data());
                }
            }
        };
        fetchProfile();

        // Removed beforeinstallprompt event listener and related logic as per instruction

        return () => {
            // Removed event listener cleanup as per instruction
        };
    }, []);

    // Removed handleInstallClick function as per instruction

    async function handleLogout() {
        await signOut(auth);
        navigate('/staff/login');
    }


    const menuGroups = [
        {
            title: null,
            items: [
                {
                    to: '/staff',
                    end: true,
                    label: '儀表板',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                    ),
                    permission: 'dashboard_view'
                }
            ]
        },
        {
            title: '門市功能',
            items: [
                {
                    to: '/staff/coupon-apply',
                    label: '電子券申請',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                        </svg>
                    ),
                    permission: 'coupon_apply'
                },
                {
                    to: '/staff/member-actions',
                    label: '會員資料異動',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    ),
                    permission: 'member_action'
                }
            ]
        },
        {
            title: '資料審核',
            items: [
                {
                    to: '/staff/user-audit',
                    label: '員工帳號審核',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <polyline points="16 11 18 13 22 9" />
                        </svg>
                    ),
                    permission: 'user_audit'
                },
                {
                    to: '/staff/member-audit',
                    label: '會員異動審核',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="9" y1="9" x2="15" y2="9" />
                            <line x1="9" y1="13" x2="15" y2="13" />
                            <line x1="9" y1="17" x2="13" y2="17" />
                        </svg>
                    ),
                    permission: 'member_audit'
                },
                {
                    to: '/staff/coupon-audit',
                    label: '電子券審核',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                    ),
                    permission: 'coupon_audit'
                }
            ]
        },
        {
            title: '管理員專區',
            items: [
                {
                    to: '/staff/role-settings',
                    label: '角色權限設定',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    ),
                    permission: 'role_settings'
                },
                {
                    to: '/staff/stores',
                    label: '門市資訊維護',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                    ),
                    permission: 'store_manage'
                }
            ]
        },
        {
            title: '系統',
            items: [
                {
                    to: '/staff/reports',
                    label: '資料報表查詢',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                    ),
                    permission: 'data_report'
                },
                {
                    to: '/staff/profile',
                    label: '個人資料變更',
                    icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                    ),
                    permission: null
                }
            ]
        }
    ];

    // 過濾權限並保留分組
    const filteredGroups = menuGroups.map(group => ({
        ...group,
        items: group.items.filter(item => {
            if (profile?.role === 'admin') return true;
            if (!item.permission) return true;
            return profile?.permissions?.includes(item.permission);
        })
    })).filter(group => group.items.length > 0);

    return (
        <div className="admin-layout">
            <style>{`
                .sidebar-group-title {
                    font-size: 0.7rem;
                    font-weight: 800;
                    color: rgba(255,255,255,0.4);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    padding: 1.5rem 1rem 0.5rem;
                }
                .sidebar-nav {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    padding: 0.5rem;
                }
                .sidebar-link {
                    margin-bottom: 2px;
                }
            `}</style>
            {/* 手機版漢堡按鈕 */}
            <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="切換選單"
                id="sidebar-toggle-btn"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {sidebarOpen ? (
                        <>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </>
                    ) : (
                        <>
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </>
                    )}
                </svg>
            </button>

            {/* 側邊欄遮罩 */}
            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* 側邊欄 */}
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header" style={{ padding: '2rem 1rem 1.5rem', textAlign: 'center' }}>
                    <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: '900', margin: 0, letterSpacing: '0.1em' }}>台隆手創館</h1>
                </div>


                <nav className="sidebar-nav">
                    {filteredGroups.map((group, gIndex) => (
                        <div key={gIndex} className="sidebar-group">
                            {group.title && <div className="sidebar-group-title">{group.title}</div>}
                            {group.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    end={item.end}
                                    className={({ isActive }) =>
                                        `sidebar-link ${isActive ? 'active' : ''}`
                                    }
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="sidebar-logout" id="sidebar-logout-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span>登出</span>
                    </button>
                </div>
            </aside>

            {/* 主內容區 */}
            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    );
}

export default StaffLayout;
