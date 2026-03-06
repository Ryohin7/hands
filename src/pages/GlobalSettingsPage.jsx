import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

function GlobalSettingsPage() {
    const [socialLinks, setSocialLinks] = useState({
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
            const docSnap = await getDoc(doc(db, 'settings', 'social'));
            if (docSnap.exists()) {
                setSocialLinks(docSnap.data());
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
            await setDoc(doc(db, 'settings', 'social'), socialLinks);
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
                <p>💡 此處設定的連結將會顯示在網站底部的 Footer 區塊。若網址留空，則該圖示不會顯示。</p>
            </div>

            <div className="edit-form" style={{ maxWidth: '600px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1.25rem', fontWeight: '600' }}>社群媒體連結</h3>
                
                <div className="form-group">
                    <label>Facebook 連結</label>
                    <input 
                        type="text" 
                        placeholder="https://facebook.com/..." 
                        value={socialLinks.fb} 
                        onChange={e => setSocialLinks({...socialLinks, fb: e.target.value})} 
                    />
                </div>

                <div className="form-group">
                    <label>Instagram 連結</label>
                    <input 
                        type="text" 
                        placeholder="https://instagram.com/..." 
                        value={socialLinks.ig} 
                        onChange={e => setSocialLinks({...socialLinks, ig: e.target.value})} 
                    />
                </div>

                <div className="form-group">
                    <label>Threads 連結</label>
                    <input 
                        type="text" 
                        placeholder="https://threads.net/..." 
                        value={socialLinks.threads} 
                        onChange={e => setSocialLinks({...socialLinks, threads: e.target.value})} 
                    />
                </div>
            </div>
        </div>
    );
}

export default GlobalSettingsPage;
