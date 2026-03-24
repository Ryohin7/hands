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
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">儀表板</h2>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>載入中...</div>
            ) : (
                <>
                    {!isLineLinked && (
                        <div className="alert-link-line" style={{
                            background: '#E8F5E9',
                            border: '1px solid #C8E6C9',
                            borderRadius: '12px',
                            padding: '1rem 1.5rem',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div>
                                    <h4 style={{ margin: 0, color: '#1B5E20', fontSize: '0.95rem' }}>尚未綁定 LINE 帳號</h4>
                                    <p style={{ margin: '2px 0 0 0', color: '#2E7D32', fontSize: '0.85rem' }}>請前往 LINE 官方帳號輸入「員工綁定」以接收即時各項通知。</p>
                                </div>
                            </div>
                            <a
                                href="https://line.me/R/ti/p/@143arkhr"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary"
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.875rem',
                                    background: '#00B900',
                                    borderColor: '#00B900',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                LINE 綁定
                            </a>
                        </div>
                    )}
                    <div className="dashboard-grid">
                        {/* 自己的申請中項目 */}
                        <div className={`card dashboard-card ${myApplyingCoupons > 0 ? 'has-items status-pending' : ''}`}>
                            <div className="dashboard-card-icon" style={{ background: myApplyingCoupons > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
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
                                <div className="dashboard-card-icon" style={{ background: pendingCoupons > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
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
                                <div className="dashboard-card-icon" style={{ background: pendingUsers > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
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
                                <div className="dashboard-card-icon" style={{ background: pendingMemberActions > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' }}>
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
                    border: 2px solid transparent;
                    position: relative;
                    overflow: hidden;
                    background: #fff;
                }
                .dashboard-card.has-items {
                    border-color: rgba(0,0,0,0.05);
                    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                }
                .dashboard-card.status-pending.has-items {
                    background: linear-gradient(135deg, #fff 0%, #eff6ff 100%);
                    border-color: #bfdbfe;
                }
                .dashboard-card.status-audit.has-items {
                    background: linear-gradient(135deg, #fff 0%, #fffbeb 100%);
                    border-color: #fde68a;
                }
                .dashboard-card.status-user-audit.has-items {
                    background: linear-gradient(135deg, #fff 0%, #ecfdf5 100%);
                    border-color: #a7f3d0;
                }
                .dashboard-card.status-member-audit.has-items {
                    background: linear-gradient(135deg, #fff 0%, #f5f3ff 100%);
                    border-color: #ddd6fe;
                }
                
                .dashboard-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 30px rgba(0,0,0,0.12);
                }
                
                .dashboard-card-icon {
                    width: 72px;
                    height: 72px;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 1.5rem;
                    flex-shrink: 0;
                }
                .dashboard-card-content {
                    flex: 1;
                }
                .dashboard-card-content h3 {
                    margin: 0 0 0.5rem 0;
                    font-size: 1.1rem;
                    color: #4b5563;
                    font-weight: 600;
                }
                .dashboard-value {
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: #111827;
                    line-height: 1;
                    margin-bottom: 0.75rem;
                    display: flex;
                    align-items: baseline;
                    gap: 0.5rem;
                }
                .dashboard-unit {
                    font-size: 1rem;
                    color: #6b7280;
                    font-weight: 500;
                }
                .status-badge {
                    font-size: 0.75rem;
                    padding: 0.25rem 0.6rem;
                    border-radius: 100px;
                    background: #3B82F6;
                    color: white;
                    margin-left: 0.5rem;
                    font-weight: 600;
                    vertical-align: middle;
                }
                .badge-warning { background: #F59E0B; }
                .badge-success { background: #10B981; }
                .badge-purple { background: #8B5CF6; }

                .dashboard-link {
                    font-size: 0.95rem;
                    color: #007130;
                    text-decoration: none;
                    font-weight: 600;
                    display: inline-block;
                    transition: color 0.2s;
                }
                .dashboard-link:hover {
                    color: #004d20;
                    text-decoration: underline;
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
                        width: 60px;
                        height: 60px;
                        border-radius: 16px;
                    }
                    .dashboard-value {
                        font-size: 2.25rem;
                    }
                }
            ` }} />
        </div>
    );
}

export default StaffDashboardPage;
