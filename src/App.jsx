import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import WinnersPage from './pages/WinnersPage';
import PostDetailPage from './pages/PostDetailPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import AdminEditPage from './pages/AdminEditPage';
import DataConverterPage from './pages/DataConverterPage';
import StoreListPage from './pages/StoreListPage';
import StoreAdminPage from './pages/StoreAdminPage';
import StoreEditPage from './pages/StoreEditPage';
import DmListPage from './pages/DmListPage';
import DmDetailPage from './pages/DmDetailPage';
import DmAdminPage from './pages/DmAdminPage';
import DmEditPage from './pages/DmEditPage';
import NavAdminPage from './pages/NavAdminPage';
import CustomPageAdminPage from './pages/CustomPageAdminPage';
import CustomPageEditPage from './pages/CustomPageEditPage';
import CustomPageView from './pages/CustomPageView';
import GlobalSettingsPage from './pages/GlobalSettingsPage';
import FontTestPage from './pages/FontTestPage';
import NotFoundPage from './pages/NotFoundPage';
import ExcelComparePage from './pages/ExcelComparePage';
import WinnerAdminPage from './pages/WinnerAdminPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import StaffLayout from './components/StaffLayout';
import Footer from './components/Footer';

// Staff Pages
import StaffLoginPage from './pages/staff/StaffLoginPage';
import CouponApplyPage from './pages/staff/CouponApplyPage';
import CouponAuditPage from './pages/staff/CouponAuditPage';
import StaffAuditPage from './pages/staff/StaffAuditPage';
import RoleSettingsPage from './pages/staff/RoleSettingsPage';
import ProfileSettingsPage from './pages/staff/ProfileSettingsPage';
import MemberActionPage from './pages/staff/MemberActionPage';
import MemberAuditPage from './pages/staff/MemberAuditPage';
import StoreManagePage from './pages/staff/StoreManagePage';
import ReportPage from './pages/staff/ReportPage';
import StaffDashboardPage from './pages/staff/StaffDashboardPage';
import LineBindPage from './pages/staff/LineBindPage';

function PWAUpdateHandler() {
    const [showUpdate, setShowUpdate] = useState(false);
    const [registration, setRegistration] = useState(null);

    useEffect(() => {
        const handleUpdate = (e) => {
            setRegistration(e.detail);
            setShowUpdate(true);
        };
        window.addEventListener('swUpdated', handleUpdate);
        return () => window.removeEventListener('swUpdated', handleUpdate);
    }, []);

    const onUpdate = () => {
        if (registration && registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        setShowUpdate(false);
        // 給一點時間讓 SW 接管
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    if (!showUpdate) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            right: '20px',
            background: '#007130',
            color: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            animation: 'pwa-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }} className="pwa-update-toast">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: '50%' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                </div>
                <div style={{ fontWeight: '600', fontSize: '1rem' }}>發現新版本！</div>
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                我們已準備好最新的系統更新，請立即套用以獲得最佳體驗。
            </div>
            <button
                onClick={onUpdate}
                style={{
                    background: 'white',
                    color: '#007130',
                    border: 'none',
                    padding: '10px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
            >
                立即更新
            </button>
            <style>{`
                @keyframes pwa-slide-up {
                    from { transform: translateY(100px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @media (min-width: 768px) {
                    .pwa-update-toast {
                        left: auto !important;
                        right: 20px !important;
                        width: 320px !important;
                    }
                }
            `}</style>
        </div>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <div className="app">
                <Routes>
                    {/* 前台頁面 - 帶 Header & Footer */}
                    <Route path="/" element={<><Header /><main className="main-content"><HomePage /></main><Footer /></>} />
                    <Route path="/winners" element={<><Header /><main className="main-content"><WinnersPage /></main><Footer /></>} />
                    <Route path="/post/:id" element={<><Header /><main className="main-content"><PostDetailPage /></main><Footer /></>} />
                    <Route path="/login" element={<><Header /><main className="main-content"><LoginPage /></main><Footer /></>} />
                    <Route path="/stores" element={<><Header /><main className="main-content"><StoreListPage /></main><Footer /></>} />
                    <Route path="/dm" element={<><Header /><main className="main-content"><DmListPage /></main><Footer /></>} />
                    <Route path="/dm/:id" element={<><Header /><main className="main-content"><DmDetailPage /></main><Footer /></>} />
                    <Route path="/p/:id" element={<><Header /><main className="main-content"><CustomPageView /></main><Footer /></>} />
                    <Route path="/test-font" element={<><Header /><main className="main-content"><FontTestPage /></main><Footer /></>} />
                    <Route path="/staff/login" element={<><Header /><main className="main-content"><StaffLoginPage /></main><Footer /></>} />


                    {/* 後台頁面 - 側邊欄佈局 */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requiredRole="admin">
                                <AdminLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<AdminPage />} />
                        <Route path="edit" element={<AdminEditPage />} />
                        <Route path="edit/:id" element={<AdminEditPage />} />
                        <Route path="converter" element={<DataConverterPage />} />

                        {/* 門市管理 */}
                        <Route path="stores" element={<StoreAdminPage />} />
                        <Route path="stores/edit" element={<StoreEditPage />} />
                        <Route path="stores/edit/:id" element={<StoreEditPage />} />

                        {/* DM 管理 */}
                        <Route path="dm" element={<DmAdminPage />} />
                        <Route path="dm/edit" element={<DmEditPage />} />
                        <Route path="dm/edit/:id" element={<DmEditPage />} />

                        {/* 頁面管理 */}
                        <Route path="pages" element={<CustomPageAdminPage />} />
                        <Route path="pages/edit" element={<CustomPageEditPage />} />
                        <Route path="pages/edit/:id" element={<CustomPageEditPage />} />

                        {/* 導航管理 */}
                        <Route path="nav" element={<NavAdminPage />} />

                        {/* 全域設定 */}
                        <Route path="settings" element={<GlobalSettingsPage />} />
                        <Route path="excel-compare" element={<ExcelComparePage />} />
                        <Route path="winners" element={<WinnerAdminPage />} />
                    </Route>

                    {/* 員工入口頁面 */}
                    <Route
                        path="/staff"
                        element={
                            <ProtectedRoute requiredRole="staff">
                                <StaffLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<StaffDashboardPage />} />
                        <Route path="coupon-apply" element={<CouponApplyPage />} />
                        <Route path="coupon-audit" element={<CouponAuditPage />} />
                        <Route path="user-audit" element={<StaffAuditPage />} />
                        <Route path="role-settings" element={<RoleSettingsPage />} />
                        <Route path="profile" element={<ProfileSettingsPage />} />
                        <Route path="member-actions" element={<MemberActionPage />} />
                        <Route path="member-audit" element={<MemberAuditPage />} />
                        <Route path="stores" element={<StoreManagePage />} />
                        <Route path="reports" element={<ReportPage />} />
                        <Route path="line-bind" element={<LineBindPage />} />
                    </Route>



                    {/* 404 捕獲 */}
                    <Route path="*" element={<><Header /><main className="main-content"><NotFoundPage /></main><Footer /></>} />
                </Routes>
                <PWAUpdateHandler />
            </div>
        </ErrorBoundary>
    );
}

export default App;
