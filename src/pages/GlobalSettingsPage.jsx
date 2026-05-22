import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function GlobalSettingsPage() {
    const [settings, setSettings] = useState({
        siteName: 'HANDS 台隆手創館',
        footerCopyright: 'Copyright © Tailung Capital Inc. All rights reserved.',
        seoTitle: '台隆手創館公告',
        seoDescription: '最新消息與通知',
        fb: '',
        ig: '',
        threads: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'social', 'seo'

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'settings', 'site'));
            if (docSnap.exists()) {
                setSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        } catch (err) {
            console.error('Fetch settings failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'site'), settings);
            alert('設定已儲存');
        } catch (err) {
            console.error('Save settings failed:', err);
            alert('儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="admin-page-content">載入中...</div>;

    return (
        <div className="admin-page-content global-settings-page">
            <div className="admin-content-header">
                <div className="title-area">
                    <h2 className="admin-content-title">全域設定</h2>
                    <p className="admin-content-subtitle">管理網站的基本資訊、社群媒體與 SEO 搜尋引擎優化設定。</p>
                </div>
                <button onClick={handleSave} className="btn btn-primary btn-save" disabled={saving}>
                    {saving ? (
                        <>
                            <span className="loading-spinner"></span>
                            儲存中...
                        </>
                    ) : '儲存設定'}
                </button>
            </div>

            <div className="settings-split-container">
                {/* 左側：設定目錄 */}
                <aside className="settings-navigation-sidebar">
                    <button 
                        type="button" 
                        className={`settings-nav-item ${activeTab === 'basic' ? 'active' : ''}`}
                        onClick={() => setActiveTab('basic')}
                    >
                        <div className="nav-item-icon-wrapper icon-blue">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="2" y1="12" x2="22" y2="12"/>
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <span className="nav-item-label">網站基本資訊</span>
                        <svg className="nav-item-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>

                    <button 
                        type="button" 
                        className={`settings-nav-item ${activeTab === 'social' ? 'active' : ''}`}
                        onClick={() => setActiveTab('social')}
                    >
                        <div className="nav-item-icon-wrapper icon-green">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                            </svg>
                        </div>
                        <span className="nav-item-label">社群媒體連結</span>
                        <svg className="nav-item-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>

                    <button 
                        type="button" 
                        className={`settings-nav-item ${activeTab === 'seo' ? 'active' : ''}`}
                        onClick={() => setActiveTab('seo')}
                    >
                        <div className="nav-item-icon-wrapper icon-purple">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </div>
                        <span className="nav-item-label">搜尋引擎優化</span>
                        <svg className="nav-item-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </aside>

                {/* 右側：表單設定細節 */}
                <main className="settings-content-detail">
                    {activeTab === 'basic' && (
                        <div className="settings-section-card fade-in">
                            <h3 className="settings-section-title">網站基本資訊</h3>
                            <div className="apple-list-group">
                                <div className="apple-list-row">
                                    <label className="apple-list-label">首頁標誌名稱</label>
                                    <input 
                                        type="text" 
                                        className="apple-list-input"
                                        value={settings.siteName} 
                                        onChange={e => setSettings({...settings, siteName: e.target.value})} 
                                    />
                                </div>
                                <div className="apple-list-row">
                                    <label className="apple-list-label">頁底版權宣告 (Footer)</label>
                                    <input 
                                        type="text" 
                                        className="apple-list-input"
                                        value={settings.footerCopyright} 
                                        onChange={e => setSettings({...settings, footerCopyright: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <p className="settings-section-tip">💡 此處設定將會即時套用到前台公告標誌與頁尾資訊。</p>
                        </div>
                    )}

                    {activeTab === 'social' && (
                        <div className="settings-section-card fade-in">
                            <h3 className="settings-section-title">社群媒體連結</h3>
                            <div className="apple-list-group">
                                <div className="apple-list-row">
                                    <label className="apple-list-label">Facebook 連結</label>
                                    <input 
                                        type="text" 
                                        className="apple-list-input"
                                        placeholder="https://facebook.com/..." 
                                        value={settings.fb} 
                                        onChange={e => setSettings({...settings, fb: e.target.value})} 
                                    />
                                </div>
                                <div className="apple-list-row">
                                    <label className="apple-list-label">Instagram 連結</label>
                                    <input 
                                        type="text" 
                                        className="apple-list-input"
                                        placeholder="https://instagram.com/..." 
                                        value={settings.ig} 
                                        onChange={e => setSettings({...settings, ig: e.target.value})} 
                                    />
                                </div>
                                <div className="apple-list-row">
                                    <label className="apple-list-label">Threads 連結</label>
                                    <input 
                                        type="text" 
                                        className="apple-list-input"
                                        placeholder="https://threads.net/..." 
                                        value={settings.threads} 
                                        onChange={e => setSettings({...settings, threads: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <p className="settings-section-tip">💡 社群媒體圖示連結將自動渲染在前台頁尾 (Footer) 區域。</p>
                        </div>
                    )}

                    {activeTab === 'seo' && (
                        <div className="settings-section-card fade-in">
                            <h3 className="settings-section-title">搜尋引擎優化 (SEO)</h3>
                            <div className="apple-list-group">
                                <div className="apple-list-row">
                                    <label className="apple-list-label">預設網頁標題</label>
                                    <input 
                                        type="text" 
                                        className="apple-list-input"
                                        value={settings.seoTitle} 
                                        onChange={e => setSettings({...settings, seoTitle: e.target.value})} 
                                    />
                                </div>
                                <div className="apple-list-row align-start">
                                    <label className="apple-list-label pt-2">預設網頁描述</label>
                                    <textarea 
                                        className="apple-list-textarea"
                                        rows="4"
                                        value={settings.seoDescription} 
                                        onChange={e => setSettings({...settings, seoDescription: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <p className="settings-section-tip">💡 網站標題及描述是搜尋引擎 (Google等) 建立索引時呈現的預設推廣內容。</p>
                        </div>
                    )}
                </main>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .global-settings-page {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
                    padding-bottom: 5rem;
                }
                .admin-content-subtitle {
                    font-size: 0.875rem;
                    color: #86868b;
                    margin-top: 0.25rem;
                }
                .btn-save {
                    background-color: #0071e3;
                    border-color: #0071e3;
                    border-radius: 980px;
                    padding: 8px 18px;
                    font-weight: 500;
                    font-size: 0.875rem;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .btn-save:hover {
                    background-color: #0077ed;
                    border-color: #0077ed;
                    transform: scale(1.02);
                }
                .btn-save:active {
                    transform: scale(0.98);
                }
                .btn-save:disabled {
                    background-color: #e5e5ea;
                    border-color: #e5e5ea;
                    color: #aeaea2;
                }
                .loading-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #ffffff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* 仿 iPad / macOS Settings 左右排版 */
                .settings-split-container {
                    display: flex;
                    gap: 2rem;
                    margin-top: 1.5rem;
                    align-items: flex-start;
                }

                .settings-navigation-sidebar {
                    width: 250px;
                    background: #ffffff;
                    border: 1px solid #d2d2d7;
                    border-radius: 12px;
                    padding: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    flex-shrink: 0;
                }

                .settings-nav-item {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    background: transparent;
                    border: none;
                    padding: 10px 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background-color 0.2s ease, color 0.2s ease;
                    text-align: left;
                    outline: none;
                }

                .settings-nav-item:hover {
                    background-color: #f5f5f7;
                }

                .settings-nav-item.active {
                    background-color: rgba(0, 113, 227, 0.08);
                }

                .nav-item-icon-wrapper {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ffffff;
                    margin-right: 12px;
                    flex-shrink: 0;
                }

                .icon-blue { background-color: #0071e3; }
                .icon-green { background-color: #34c759; }
                .icon-purple { background-color: #af52de; }

                .nav-item-label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #1d1d1f;
                    flex: 1;
                }

                .settings-nav-item.active .nav-item-label {
                    color: #0071e3;
                    font-weight: 600;
                }

                .nav-item-chevron {
                    color: #c7c7cc;
                    transition: transform 0.2s ease;
                }

                .settings-nav-item:hover .nav-item-chevron {
                    color: #86868b;
                    transform: translateX(2px);
                }

                /* 右側設定區塊 */
                .settings-content-detail {
                    flex: 1;
                    max-width: 750px;
                    width: 100%;
                }

                .settings-section-card {
                    background: #ffffff;
                    border: 1px solid #d2d2d7;
                    border-radius: 12px;
                    padding: 1.75rem;
                }

                .settings-section-title {
                    font-size: 1.125rem;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin-top: 0;
                    margin-bottom: 1.25rem;
                    text-align: left;
                }

                /* Apple List Group 格式 */
                .apple-list-group {
                    border: 1px solid #d2d2d7;
                    border-radius: 10px;
                    overflow: hidden;
                    background: #ffffff;
                    margin-bottom: 1.25rem;
                }

                .apple-list-row {
                    display: flex;
                    align-items: center;
                    padding: 10px 16px;
                    border-bottom: 1px solid #e5e5ea;
                    min-height: 48px;
                }

                .apple-list-row.align-start {
                    align-items: flex-start;
                }

                .apple-list-row:last-child {
                    border-bottom: none;
                }

                .apple-list-label {
                    width: 160px;
                    font-size: 0.875rem;
                    font-weight: 500;
                    color: #1d1d1f;
                    text-align: left;
                    flex-shrink: 0;
                    user-select: none;
                }

                .pt-2 {
                    padding-top: 0.5rem;
                }

                .apple-list-input, .apple-list-textarea {
                    flex: 1;
                    border: none;
                    background: transparent;
                    padding: 6px 8px;
                    font-size: 0.9rem;
                    color: #1d1d1f;
                    outline: none;
                    border-radius: 6px;
                    transition: background-color 0.2s ease, box-shadow 0.2s ease;
                    font-family: inherit;
                    width: 100%;
                }

                .apple-list-input:focus, .apple-list-textarea:focus {
                    background-color: #f5f5f7;
                    box-shadow: inset 0 0 0 1px rgba(0, 113, 227, 0.2);
                }

                .apple-list-textarea {
                    resize: vertical;
                    min-height: 90px;
                }

                .settings-section-tip {
                    font-size: 0.8rem;
                    color: #86868b;
                    margin: 0;
                    text-align: left;
                }

                .fade-in {
                    animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* 響應式佈局：當寬度小於 768px 時，自動堆疊為單欄 */
                @media (max-width: 768px) {
                    .settings-split-container {
                        flex-direction: column;
                        gap: 1rem;
                    }
                    .settings-navigation-sidebar {
                        width: 100%;
                    }
                    .settings-content-detail {
                        width: 100%;
                    }
                    .apple-list-row {
                        flex-direction: column;
                        align-items: flex-start;
                        padding: 12px;
                        gap: 4px;
                    }
                    .apple-list-label {
                        width: 100%;
                    }
                    .apple-list-input, .apple-list-textarea {
                        padding: 6px 0;
                    }
                }
            ` }} />
        </div>
    );
}

export default GlobalSettingsPage;
