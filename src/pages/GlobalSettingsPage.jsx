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
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">全域設定</h2>
                <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                    {saving ? '儲存中...' : '儲存設定'}
                </button>
            </div>

            <div className="info-card" style={{ marginBottom: '2rem' }}>
                <p>💡 此處設定將會即時套用到首頁標誌、SEO 標籤以及頁底資訊。</p>
            </div>

            <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <div className="admin-card" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600', color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        網站基本資訊
                    </h3>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>首頁標誌名稱</label>
                        <input 
                            type="text" 
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                            value={settings.siteName} 
                            onChange={e => setSettings({...settings, siteName: e.target.value})} 
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>頁底版權宣告 (Footer)</label>
                        <input 
                            type="text" 
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                            value={settings.footerCopyright} 
                            onChange={e => setSettings({...settings, footerCopyright: e.target.value})} 
                        />
                    </div>
                </div>

                <div className="admin-card" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600', color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-14 8.38 8.38 0 0 1 3.8.9L21 3.5l-2.6 2.6z"/></svg>
                        社群媒體連結
                    </h3>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Facebook</label>
                        <input 
                            type="text" 
                            placeholder="https://facebook.com/..." 
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                            value={settings.fb} 
                            onChange={e => setSettings({...settings, fb: e.target.value})} 
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Instagram</label>
                        <input 
                            type="text" 
                            placeholder="https://instagram.com/..." 
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                            value={settings.ig} 
                            onChange={e => setSettings({...settings, ig: e.target.value})} 
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>Threads</label>
                        <input 
                            type="text" 
                            placeholder="https://threads.net/..." 
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                            value={settings.threads} 
                            onChange={e => setSettings({...settings, threads: e.target.value})} 
                        />
                    </div>
                </div>

                <div className="admin-card" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-light)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', gridColumn: '1 / -1' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600', color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        搜尋引擎優化 (SEO)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div className="form-group">
                            <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>預設網頁標題</label>
                            <input 
                                type="text" 
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                                value={settings.seoTitle} 
                                onChange={e => setSettings({...settings, seoTitle: e.target.value})} 
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ fontWeight: '500', marginBottom: '0.5rem', display: 'block' }}>預設網頁描述</label>
                            <textarea 
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px', minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }}
                                value={settings.seoDescription} 
                                onChange={e => setSettings({...settings, seoDescription: e.target.value})} 
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GlobalSettingsPage;
