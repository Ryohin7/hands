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
import RegistrationInquiryPage from './pages/RegistrationInquiryPage';
import PhysicalEventsPage from './pages/PhysicalEventsPage';
import NotFoundPage from './pages/NotFoundPage';
import ExcelComparePage from './pages/ExcelComparePage';
import WinnerAdminPage from './pages/WinnerAdminPage';
import EventAdminPage from './pages/EventAdminPage';
import FormTestPage from './pages/FormTestPage';
import TravelCampaignPage from './pages/TravelCampaignPage';
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
    useEffect(() => {
        const handleUpdate = (e) => {
            const registration = e.detail;
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                // 給一點時間讓 SW 接管並重刷
                setTimeout(() => {
                    window.location.reload();
                }, 200);
            }
        };
        window.addEventListener('swUpdated', handleUpdate);
        return () => window.removeEventListener('swUpdated', handleUpdate);
    }, []);

    return null;
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
                    <Route path="/registration-inquiry" element={<><Header /><main className="main-content"><RegistrationInquiryPage /></main><Footer /></>} />
                    <Route path="/events" element={<><Header /><main className="main-content"><PhysicalEventsPage /></main><Footer /></>} />
                    <Route path="/staff/login" element={<><Header /><main className="main-content"><StaffLoginPage /></main><Footer /></>} />
                    <Route path="/form-test" element={<><Header /><main className="main-content"><FormTestPage /></main><Footer /></>} />
                    <Route path="/travel-campaign" element={<main className="campaign-only-content"><TravelCampaignPage /></main>} />


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
                        <Route path="events" element={<EventAdminPage />} />
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
