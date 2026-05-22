import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

function StaffDashboardPage() {
    const [pendingCoupons, setPendingCoupons] = useState(0);
    const [myApplyingCoupons, setMyApplyingCoupons] = useState(0);
    const [pendingUsers, setPendingUsers] = useState(0);
    const [pendingMemberActions, setPendingMemberActions] = useState(0);
    const [loading, setLoading] = useState(true);
    const [hasAuditPermission, setHasAuditPermission] = useState(false);
    const [hasUserAuditPermission, setHasUserAuditPermission] = useState(false);
    const [hasMemberAuditPermission, setHasMemberAuditPermission] = useState(false);
    const [isLineLinked, setIsLineLinked] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!auth.currentUser) return;
            setLoading(true);

            try {
                // 檢查權限與 LINE 綁定狀態
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                let canAuditCoupons = false;
                let canAuditUsers = false;
                let canAuditMemberActions = false;

                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setIsLineLinked(!!userData.lineUserId);
                    if (userData.role === 'admin') {
                        canAuditCoupons = true;
                        canAuditUsers = true;
                        canAuditMemberActions = true;
                    } else {
                        canAuditCoupons = userData.permissions?.includes('coupon_audit') || false;
                        canAuditUsers = userData.permissions?.includes('user_audit') || false;
                        canAuditMemberActions = userData.permissions?.includes('member_audit') || false;
                    }
                    setHasAuditPermission(canAuditCoupons);
                    setHasUserAuditPermission(canAuditUsers);
                    setHasMemberAuditPermission(canAuditMemberActions);
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

                // 4. 會員資料異動待審核 (有權限才撈取)
                if (canAuditMemberActions) {
                    const qPendingMember = query(
                        collection(db, 'member_actions'),
                        where('status', '==', 'pending')
                    );
                    const pendingMemberSnap = await getDocs(qPendingMember);
                    setPendingMemberActions(pendingMemberSnap.size);
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
        <div className="admin-page-content staff-dashboard-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">儀表板</h2>
            </div>

            {loading ? (
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p>載入中...</p>
                </div>
            ) : (
                <>
                    {!isLineLinked && (
                        <div className="alert-link-line">
                            <div className="alert-content-wrap">
                                <div>
                                    <h4 className="alert-title">尚未綁定 LINE 帳號</h4>
                                    <p className="alert-desc">請前往 LINE 官方帳號輸入「員工綁定」以接收即時各項通知。</p>
                                </div>
                            </div>
                            <a
                                href="https://line.me/R/ti/p/@143arkhr"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn alert-btn-line"
                            >
                                LINE 綁定
                            </a>
                        </div>
                    )}
                    <div className="dashboard-grid">
                        {/* 自己的申請中項目 */}
                        <div className={`card dashboard-card ${myApplyingCoupons > 0 ? 'has-items status-pending' : ''}`}>
                            <div className="dashboard-card-icon icon-blue">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                </svg>
                            </div>
                            <div className="dashboard-card-content">
                                <h3>申請中項目</h3>
                                <div className="dashboard-value">
                                    {myApplyingCoupons} <span className="dashboard-unit">件</span>
                                    {myApplyingCoupons > 0 && <span className="status-badge">處理中</span>}
                                </div>
                                <Link to="/staff/coupon-apply" className="dashboard-link">前往查看 →</Link>
                            </div>
                        </div>

                        {/* 待審核項目 (需要審核權限) */}
                        {hasAuditPermission && (
                            <div className={`card dashboard-card ${pendingCoupons > 0 ? 'has-items status-audit' : ''}`}>
                                <div className="dashboard-card-icon icon-warning">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                </div>
                                <div className="dashboard-card-content">
                                    <h3>待審核項目</h3>
                                    <div className="dashboard-value">
                                        {pendingCoupons} <span className="dashboard-unit">件</span>
                                        {pendingCoupons > 0 && <span className="status-badge badge-warning">需審核</span>}
                                    </div>
                                    <Link to="/staff/coupon-audit" className="dashboard-link">前往審核 →</Link>
                                </div>
                            </div>
                        )}

                        {/* 員工帳號審核項目 (需要審核權限) */}
                        {hasUserAuditPermission && (
                            <div className={`card dashboard-card ${pendingUsers > 0 ? 'has-items status-user-audit' : ''}`}>
                                <div className="dashboard-card-icon icon-success">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <polyline points="16 11 18 13 22 9" />
                                    </svg>
                                </div>
                                <div className="dashboard-card-content">
                                    <h3>員工帳號審核</h3>
                                    <div className="dashboard-value">
                                        {pendingUsers} <span className="dashboard-unit">件</span>
                                        {pendingUsers > 0 && <span className="status-badge badge-success">待處理</span>}
                                    </div>
                                    <Link to="/staff/user-audit" className="dashboard-link">前往審核 →</Link>
                                </div>
                            </div>
                        )}

                        {/* 會員異動審核 (需要審核權限) */}
                        {hasMemberAuditPermission && (
                            <div className={`card dashboard-card ${pendingMemberActions > 0 ? 'has-items status-member-audit' : ''}`}>
                                <div className="dashboard-card-icon icon-purple">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="9" y1="9" x2="15" y2="9" />
                                        <line x1="9" y1="13" x2="15" y2="13" />
                                        <line x1="9" y1="17" x2="13" y2="17" />
                                    </svg>
                                </div>
                                <div className="dashboard-card-content">
                                    <h3>待變更項目</h3>
                                    <div className="dashboard-value">
                                        {pendingMemberActions} <span className="dashboard-unit">件</span>
                                        {pendingMemberActions > 0 && <span className="status-badge badge-purple">待處理</span>}
                                    </div>
                                    <Link to="/staff/member-audit" className="dashboard-link">前往審核 →</Link>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .staff-dashboard-page {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
                    letter-spacing: -0.01em;
                }
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1.5rem;
                }
                .dashboard-card {
                    display: flex;
                    align-items: center;
                    padding: 2rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    border-radius: 16px;
                    position: relative;
                    overflow: hidden;
                    background: #ffffff;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.03);
                }
                .alert-link-line {
                    background: rgba(250, 250, 250, 0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    border-radius: 14px;
                    padding: 1.15rem 1.5rem;
                    margin-bottom: 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
                }
                .alert-content-wrap {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .alert-title {
                    margin: 0;
                    color: #1d1d1f;
                    font-size: 0.95rem;
                    font-weight: 600;
                    text-align: left;
                }
                .alert-desc {
                    margin: 4px 0 0 0;
                    color: #86868b;
                    font-size: 0.85rem;
                    text-align: left;
                }
                .alert-btn-line {
                    padding: 6px 16px;
                    font-size: 0.825rem;
                    font-weight: 600;
                    background: #06c755;
                    border: 1px solid #05b04b;
                    border-radius: 980px;
                    color: white !important;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 4px rgba(6, 199, 85, 0.15);
                    text-decoration: none;
                }
                .alert-btn-line:hover {
                    background: #05b04b;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(6, 199, 85, 0.2);
                }
                .alert-btn-line:active {
                    transform: translateY(0);
                    box-shadow: 0 2px 4px rgba(6, 199, 85, 0.1);
                }
                
                .dashboard-card.has-items {
                    border-color: rgba(0, 0, 0, 0.12);
                    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.05);
                }
                .dashboard-card.status-pending.has-items {
                    border-left: 4px solid #0071e3;
                }
                .dashboard-card.status-audit.has-items {
                    border-left: 4px solid #ff9500;
                }
                .dashboard-card.status-user-audit.has-items {
                    border-left: 4px solid #34c759;
                }
                .dashboard-card.status-member-audit.has-items {
                    border-left: 4px solid #af52de;
                }
                
                .dashboard-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 12px 28px rgba(0,0,0,0.06);
                    border-color: rgba(0, 0, 0, 0.12);
                }
                
                .dashboard-card-icon {
                    width: 64px;
                    height: 64px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 1.25rem;
                    flex-shrink: 0;
                }
                .dashboard-card-icon.icon-blue {
                    background: rgba(0, 113, 227, 0.08);
                    color: #0071e3;
                }
                .dashboard-card.status-pending.has-items .dashboard-card-icon.icon-blue {
                    background: rgba(0, 113, 227, 0.15);
                }
                .dashboard-card-icon.icon-warning {
                    background: rgba(255, 149, 0, 0.08);
                    color: #ff9500;
                }
                .dashboard-card.status-audit.has-items .dashboard-card-icon.icon-warning {
                    background: rgba(255, 149, 0, 0.15);
                }
                .dashboard-card-icon.icon-success {
                    background: rgba(52, 199, 89, 0.08);
                    color: #34c759;
                }
                .dashboard-card.status-user-audit.has-items .dashboard-card-icon.icon-success {
                    background: rgba(52, 199, 89, 0.15);
                }
                .dashboard-card-icon.icon-purple {
                    background: rgba(175, 82, 222, 0.08);
                    color: #af52de;
                }
                .dashboard-card.status-member-audit.has-items .dashboard-card-icon.icon-purple {
                    background: rgba(175, 82, 222, 0.15);
                }
                .dashboard-card-content {
                    flex: 1;
                    text-align: left;
                }
                .dashboard-card-content h3 {
                    margin: 0 0 0.4rem 0;
                    font-size: 1rem;
                    color: #86868b;
                    font-weight: 600;
                }
                .dashboard-value {
                    font-size: 2.25rem;
                    font-weight: 700;
                    color: #1d1d1f;
                    line-height: 1.1;
                    margin-bottom: 0.6rem;
                    display: flex;
                    align-items: baseline;
                    gap: 0.4rem;
                    font-family: "SF Pro Display", -apple-system, sans-serif;
                }
                .dashboard-unit {
                    font-size: 0.95rem;
                    color: #86868b;
                    font-weight: 500;
                }
                .status-badge {
                    font-size: 0.725rem;
                    padding: 3px 9px;
                    border-radius: 980px;
                    background: rgba(0, 113, 227, 0.08);
                    color: #0071e3;
                    margin-left: 0.5rem;
                    font-weight: 600;
                    vertical-align: middle;
                    display: inline-block;
                }
                .badge-warning {
                    background: rgba(255, 149, 0, 0.08);
                    color: #ff9500;
                }
                .badge-success {
                    background: rgba(52, 199, 89, 0.08);
                    color: #34c759;
                }
                .badge-purple {
                    background: rgba(175, 82, 222, 0.08);
                    color: #af52de;
                }
 
                .dashboard-link {
                    font-size: 0.875rem;
                    color: #0071e3;
                    text-decoration: none;
                    font-weight: 600;
                    display: inline-block;
                    transition: all 0.2s ease;
                }
                .dashboard-link:hover {
                    color: #0077ed;
                    transform: translateX(3px);
                }
                
                @media (max-width: 768px) {
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                        gap: 1.25rem;
                    }
                    .dashboard-card {
                        padding: 1.5rem;
                    }
                    .dashboard-card-icon {
                        width: 56px;
                        height: 56px;
                        border-radius: 12px;
                        margin-right: 1rem;
                    }
                    .dashboard-value {
                        font-size: 2rem;
                    }
                }
            ` }} />
        </div>
    );
}

export default StaffDashboardPage;
