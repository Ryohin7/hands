import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import PostDetailPage from './pages/PostDetailPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/AdminPage';
import AdminEditPage from './pages/AdminEditPage';
import DataConverterPage from './pages/DataConverterPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <ErrorBoundary>
            <div className="app">
                <Header />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/post/:id" element={<PostDetailPage />} />
                        <Route path="/login" element={<LoginPage />} />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute>
                                    <AdminPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/edit"
                            element={
                                <ProtectedRoute>
                                    <AdminEditPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/converter"
                            element={
                                <ProtectedRoute>
                                    <DataConverterPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/admin/edit/:id"
                            element={
                                <ProtectedRoute>
                                    <AdminEditPage />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </main>
            </div>
        </ErrorBoundary>
    );
}

export default App;
