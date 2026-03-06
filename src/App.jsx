import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
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
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';
import Footer from './components/Footer';

function App() {
    return (
        <ErrorBoundary>
            <div className="app">
                <Routes>
                    {/* 前台頁面 - 帶 Header & Footer */}
                    <Route path="/" element={<><Header /><main className="main-content"><HomePage /></main><Footer /></>} />
                    <Route path="/post/:id" element={<><Header /><main className="main-content"><PostDetailPage /></main><Footer /></>} />
                    <Route path="/login" element={<><Header /><main className="main-content"><LoginPage /></main><Footer /></>} />
                    <Route path="/stores" element={<><Header /><main className="main-content"><StoreListPage /></main><Footer /></>} />
                    <Route path="/dm" element={<><Header /><main className="main-content"><DmListPage /></main><Footer /></>} />
                    <Route path="/dm/:id" element={<><Header /><main className="main-content"><DmDetailPage /></main><Footer /></>} />
                    <Route path="/p/:id" element={<><Header /><main className="main-content"><CustomPageView /></main><Footer /></>} />
                    <Route path="/test-font" element={<><Header /><main className="main-content"><FontTestPage /></main><Footer /></>} />

                    {/* 後台頁面 - 側邊欄佈局 */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
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
                    </Route>

                    {/* 404 捕獲 */}
                    <Route path="*" element={<><Header /><main className="main-content"><NotFoundPage /></main><Footer /></>} />
                </Routes>
            </div>
        </ErrorBoundary>
    );
}

export default App;
