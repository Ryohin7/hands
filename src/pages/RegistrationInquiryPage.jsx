import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import ReCAPTCHA from 'react-google-recaptcha';

function RegistrationInquiryPage() {
    const [phone, setPhone] = useState('');
    const [selectedEventId, setSelectedEventId] = useState('');
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(true);
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState('');
    const [captchaValue, setCaptchaValue] = useState(null);

    useEffect(() => {
        fetchEvents();
    }, []);

    async function fetchEvents() {
        try {
            const q = query(
                collection(db, 'posts'),
                where('category', '==', '實體活動'),
                where('status', '==', 'published'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
            setEvents(data);
        } catch (err) {
            console.error('獲取活動失敗:', err);
        } finally {
            setLoadingEvents(false);
        }
    }

    const handleSearch = async (e) => {
        e.preventDefault();
        setError('');
        setResults([]);

        if (!phone || !selectedEventId) {
            setError('請輸入手機號碼並選擇活動');
            return;
        }

        if (!captchaValue) {
            setError('請先完成機器人驗證');
            return;
        }

        setSearching(true);
        try {
            const q = query(
                collection(db, 'event_registrations'),
                where('postId', '==', selectedEventId),
                where('phone', '==', phone.trim())
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const data = snapshot.docs.map(doc => doc.data());
                setResults(data);
            } else {
                setError('找不到相關報名紀錄，請確認手機與活動是否正確。');
            }
        } catch (err) {
            console.error('查詢失敗:', err);
            setError('查詢時發生錯誤，請稍後再試。');
        } finally {
            setSearching(false);
        }
    };

    return (
        <div className="page-container">
            <div className="inquiry-card" style={{ maxWidth: '600px', margin: '2rem auto', padding: '2rem', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <h2 style={{ color: '#007130', textAlign: 'center', marginBottom: '1.5rem' }}>活動報名查詢</h2>
                
                <form onSubmit={handleSearch}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>活動名稱</label>
                        <select 
                            value={selectedEventId} 
                            onChange={e => setSelectedEventId(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                            required
                        >
                            <option value="">請選擇活動</option>
                            {events.map(event => (
                                <option key={event.id} value={event.id}>{event.title}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>手機號碼</label>
                        <input 
                            type="tel" 
                            value={phone} 
                            onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="請輸入報名時的手機號碼"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0' }}>
                        <ReCAPTCHA
                            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                            onChange={setCaptchaValue}
                        />
                    </div>

                    {error && <div style={{ color: '#d32f2f', textAlign: 'center', marginBottom: '1rem' }}>{error}</div>}

                    <button 
                        type="submit" 
                        disabled={searching || !captchaValue}
                        style={{ 
                            width: '100%', 
                            padding: '1rem', 
                            background: '#007130', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontWeight: 'bold', 
                            cursor: 'pointer',
                            opacity: (searching || !captchaValue) ? 0.6 : 1
                        }}
                    >
                        {searching ? '查詢中...' : '立即查詢'}
                    </button>
                </form>

                {results.length > 0 && (
                    <div style={{ marginTop: '2rem' }}>
                        <h3 style={{ margin: '0 0 1rem', color: '#333', textAlign: 'center' }}>查詢結果 (共 {results.length} 筆)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {results.map((res, idx) => (
                                <div key={idx} style={{ padding: '1.25rem', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #eee' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#666' }}>姓名:</span>
                                            <strong>{res.name}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#666' }}>活動:</span>
                                            <strong>{res.postTitle}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: '#666' }}>報名狀態:</span>
                                            <span style={{ 
                                                padding: '4px 12px', 
                                                borderRadius: '20px', 
                                                background: res.status === '報名成功' ? '#e8f5e9' : (res.status === '候補' ? '#fff3e0' : '#f5f5f5'),
                                                color: res.status === '報名成功' ? '#2e7d32' : (res.status === '候補' ? '#ef6c00' : '#666'),
                                                fontWeight: 'bold'
                                            }}>
                                                {res.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RegistrationInquiryPage;
