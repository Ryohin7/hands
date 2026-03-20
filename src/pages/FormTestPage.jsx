import EventRegistrationForm from '../components/EventRegistrationForm';
import WinnerForm from '../components/WinnerForm';

// Mock post data for testing
const mockEventPost = {
    id: 'test-event-001',
    title: '2026 春季親子手作體驗活動',
    formDeadline: { toDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    registrationLimit: 30,
    allowWaitlist: true,
};

const mockWinnerPost = {
    id: 'test-winner-001',
    title: '2026 春季抽獎活動 — 中獎名單',
    formDeadline: { toDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
};

function FormTestPage() {
    return (
        <div className="page-container" style={{ maxWidth: '900px' }}>
            <div style={{ marginBottom: '2.5rem' }}>
                <div className="page-header" style={{ marginBottom: '0.5rem' }}>
                    <h1 className="page-title">📋 表單測試頁面</h1>
                    <span className="status-badge status-draft">Dev Only</span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    此頁面僅供開發測試使用。表單送出功能已使用 mock 資料停用，驗證碼可能需要實際環境金鑰才能顯示。
                </p>
            </div>

            {/* 表單切換 Tab */}
            <div className="form-test-tabs">
                <div className="form-test-tab-wrapper" id="tab-event">
                    <div className="form-test-section-label">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        表單一：實體活動報名表
                    </div>
                    <div className="form-test-meta">
                        <span>模擬活動：{mockEventPost.title}</span>
                        <span className="status-badge status-published">報名中</span>
                    </div>
                    <EventRegistrationForm post={mockEventPost} />
                </div>

                <div className="form-test-divider">
                    <span>另一張表單</span>
                </div>

                <div className="form-test-tab-wrapper" id="tab-winner">
                    <div className="form-test-section-label">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 12 20 22 4 22 4 12"/>
                            <rect x="2" y="7" width="20" height="5"/>
                            <line x1="12" y1="22" x2="12" y2="7"/>
                            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
                        </svg>
                        表單二：得獎者寄件資料填寫
                    </div>
                    <div className="form-test-meta">
                        <span>模擬活動：{mockWinnerPost.title}</span>
                        <span className="status-badge status-published">填寫中</span>
                    </div>
                    <WinnerForm post={mockWinnerPost} />
                </div>
            </div>

            <style>{`
                .form-test-tabs {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }
                .form-test-tab-wrapper {
                    background: var(--bg);
                    border: 1px solid var(--border-light);
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: var(--shadow-sm);
                }
                .form-test-section-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--brand);
                    margin-bottom: 0.5rem;
                    letter-spacing: 0.05em;
                }
                .form-test-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-size: 0.8125rem;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px dashed var(--border-light);
                }
                .form-test-divider {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    color: var(--text-secondary);
                    font-size: 0.75rem;
                    letter-spacing: 0.1em;
                }
                .form-test-divider::before,
                .form-test-divider::after {
                    content: '';
                    flex: 1;
                    border-top: 1px dashed var(--border);
                }
                /* 微調兩個表單在測試頁面中的顯示 */
                .form-test-tab-wrapper .winner-form-container {
                    margin-top: 0 !important;
                    padding: 0 !important;
                    max-width: 100% !important;
                }
            `}</style>
        </div>
    );
}

export default FormTestPage;
