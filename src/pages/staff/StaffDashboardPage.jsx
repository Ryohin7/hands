import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

function StaffDashboardPage() {
    const [pendingCoupons, setPendingCoupons] = useState(0);
    const [myApplyingCoupons, setMyApplyingCoupons] = useState(0);
    const [pendingUsers, setPendingUsers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hasAuditPermission, setHasAuditPermission] = useState(false);
    const [hasUserAuditPermission, setHasUserAuditPermission] = useState(false);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!auth.currentUser) return;
            setLoading(true);

            try {
                // 檢查權限
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                let canAuditCoupons = false;
                let canAuditUsers = false;

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (userData.role === 'admin') {
                        canAuditCoupons = true;
                        canAuditUsers = true;
                    } else {
                        canAuditCoupons = userData.permissions?.includes('coupon_audit') || false;
                        canAuditUsers = userData.permissions?.includes('user_audit') || false;
                    }
                    setHasAuditPermission(canAuditCoupons);
                    setHasUserAuditPermission(canAuditUsers);
                }

                // 1. 待審核項目 (有權限才撈取)
                if (canAuditCoupons) {
                    const qPendingCoupons = query(
                        collection(db, 'coupon_requests'),
                        where('status', '==', 'pending')
                    );
                    const pendingCouponsSnap = await getDocs(qPendingCoupons);
                    setPendingCoupons(pendingCouponsSnap.size);
                }

                // 2. 申請中項目 (自己的申請)
                const qMyCoupons = query(
                    collection(db, 'coupon_requests'),
                    where('userId', '==', auth.currentUser.uid),
                    where('status', '==', 'pending')
                );
                const myCouponsSnap = await getDocs(qMyCoupons);
                setMyApplyingCoupons(myCouponsSnap.size);

                // 3. 員工帳號審核項目 (有權限才撈取)
                if (canAuditUsers) {
                    const qPendingUsers = query(
                        collection(db, 'users'),
                        where('isApproved', '==', false),
                        where('role', '==', 'staff')
                    );
                    const pendingUsersSnap = await getDocs(qPendingUsers);
                    setPendingUsers(pendingUsersSnap.size);
                }

            } catch (error) {
                console.error("載入儀表板資料失敗:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">儀表板</h2>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>載入中...</div>
            ) : (
                <div className="dashboard-grid">
                    {/* 自己的申請中項目 */}
                    <div className="card dashboard-card">
                        <div className="dashboard-card-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                            </svg>
                        </div>
                        <div className="dashboard-card-content">
                            <h3>申請中項目</h3>
                            <div className="dashboard-value">{myApplyingCoupons} <span className="dashboard-unit">件</span></div>
                            <Link to="/staff/coupon-apply" className="dashboard-link">前往查看 →</Link>
                        </div>
                    </div>

                    {/* 待審核項目 (需要審核權限) */}
                    {hasAuditPermission && (
                        <div className="card dashboard-card">
                            <div className="dashboard-card-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <div className="dashboard-card-content">
                                <h3>待審核項目</h3>
                                <div className="dashboard-value">{pendingCoupons} <span className="dashboard-unit">件</span></div>
                                <Link to="/staff/coupon-audit" className="dashboard-link">前往審核 →</Link>
                            </div>
                        </div>
                    )}

                    {/* 員工帳號審核項目 (需要審核權限) */}
                    {hasUserAuditPermission && (
                        <div className="card dashboard-card">
                            <div className="dashboard-card-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <polyline points="16 11 18 13 22 9" />
                                </svg>
                            </div>
                            <div className="dashboard-card-content">
                                <h3>員工帳號審核</h3>
                                <div className="dashboard-value">{pendingUsers} <span className="dashboard-unit">件</span></div>
                                <Link to="/staff/user-audit" className="dashboard-link">前往審核 →</Link>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                }
                .dashboard-card {
                    display: flex;
                    align-items: center;
                    padding: 1.5rem;
                    transition: transform 0.2s;
                }
                .dashboard-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                }
                .dashboard-card-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 1.5rem;
                }
                .dashboard-card-content h3 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1rem;
                    color: #666;
                }
                .dashboard-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #111;
                    line-height: 1;
                    margin-bottom: 0.5rem;
                }
                .dashboard-unit {
                    font-size: 1rem;
                    color: #888;
                    font-weight: normal;
                }
                .dashboard-link {
                    font-size: 0.875rem;
                    color: #007130;
                    text-decoration: none;
                    font-weight: 500;
                    display: inline-block;
                }
                .dashboard-link:hover {
                    text-decoration: underline;
                }
                
                @media (max-width: 768px) {
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                }
            ` }} />
        </div>
    );
}

export default StaffDashboardPage;
