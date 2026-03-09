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

            <div className="edit-form" style={{ maxWidth: '800px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', fontWeight: '600', color: 'var(--brand)' }}>網站基本資訊</h3>
                    <div className="form-group">
                        <label>首頁左上角名稱</label>
                        <input 
                            type="text" 
                            value={settings.siteName} 
                            onChange={e => setSettings({...settings, siteName: e.target.value})} 
                        />
                    </div>
                    <div className="form-group">
                        <label>Footer 版權宣告</label>
                        <input 
                            type="text" 
                            value={settings.footerCopyright} 
                            onChange={e => setSettings({...settings, footerCopyright: e.target.value})} 
                        />
                    </div>

                    <h3 style={{ fontSize: '1rem', margin: '2rem 0 1.25rem', fontWeight: '600', color: 'var(--brand)' }}>SEO 全域設定</h3>
                    <div className="form-group">
                        <label>預設網頁標題 (SEO Title)</label>
                        <input 
                            type="text" 
                            value={settings.seoTitle} 
                            onChange={e => setSettings({...settings, seoTitle: e.target.value})} 
                        />
                    </div>
                    <div className="form-group">
                        <label>預設網頁描述 (SEO Description)</label>
                        <textarea 
                            style={{ width: '100%', padding: '0.625rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', minHeight: '80px', fontFamily: 'inherit' }}
                            value={settings.seoDescription} 
                            onChange={e => setSettings({...settings, seoDescription: e.target.value})} 
                        />
                    </div>
                </div>

                <div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', fontWeight: '600', color: 'var(--brand)' }}>社群媒體連結</h3>
                    <div className="form-group">
                        <label>Facebook 連結</label>
                        <input 
                            type="text" 
                            placeholder="https://facebook.com/..." 
                            value={settings.fb} 
                            onChange={e => setSettings({...settings, fb: e.target.value})} 
                        />
                    </div>
                    <div className="form-group">
                        <label>Instagram 連結</label>
                        <input 
                            type="text" 
                            placeholder="https://instagram.com/..." 
                            value={settings.ig} 
                            onChange={e => setSettings({...settings, ig: e.target.value})} 
                        />
                    </div>
                    <div className="form-group">
                        <label>Threads 連結</label>
                        <input 
                            type="text" 
                            placeholder="https://threads.net/..." 
                            value={settings.threads} 
                            onChange={e => setSettings({...settings, threads: e.target.value})} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GlobalSettingsPage;
