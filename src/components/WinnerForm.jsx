import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { twzipcodeData } from '../utils/twzipcodeData';
import ReCAPTCHA from 'react-google-recaptcha';

function WinnerForm({ post }) {
    const [communityName, setCommunityName] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [recipientPhone, setRecipientPhone] = useState('');
    const [county, setCounty] = useState('');
    const [district, setDistrict] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [addressDetail, setAddressDetail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [captchaValue, setCaptchaValue] = useState(null);

    useEffect(() => {
        if (post?.formDeadline) {
            const now = new Date();
            const deadline = post.formDeadline.toDate ? post.formDeadline.toDate() : new Date(post.formDeadline);
            if (now > deadline) {
                setIsExpired(true);
            }
        }
    }, [post]);

    // 當縣市改變時，清空鄉鎮與郵遞區號
    const handleCountyChange = (e) => {
        const selectedCounty = e.target.value;
        setCounty(selectedCounty);
        setDistrict('');
        setZipCode('');
    };

    // 當鄉鎮改變時，自動帶入對應郵遞區號
    const handleDistrictChange = (e) => {
        const selectedDistrict = e.target.value;
        setDistrict(selectedDistrict);
        if (county && twzipcodeData[county] && twzipcodeData[county][selectedDistrict]) {
            setZipCode(twzipcodeData[county][selectedDistrict]);
        } else {
            setZipCode('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!communityName || !recipientName || !recipientPhone || !county || !district || !addressDetail) {
            alert('請填寫所有必填欄位！');
            return;
        }

        if (!captchaValue) {
            alert('請先勾選「我不是機器人」進行驗證！');
            return;
        }

        const confirmSubmit = window.confirm('送出後將無法修改資料，您確定要送出聯絡資訊嗎？');
        if (!confirmSubmit) return;

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'winner_submissions'), {
                postId: post.id,
                postTitle: post.title,
                communityName: communityName.trim(),
                recipientName: recipientName.trim(),
                recipientPhone: recipientPhone.trim(),
                zipCode: zipCode,
                county: county,
                district: district,
                addressDetail: addressDetail.trim(),
                submittedAt: serverTimestamp(),
            });

            setSubmitted(true);
            alert('寄件資料已成功送出！');
        } catch (error) {
            console.error('送出表單失敗', error);
            alert('資料送出失敗，請重試或聯絡系統管理員。');
        } finally {
            setSubmitting(false);
        }
    };

    if (isExpired) {
        return (
            <div className="winner-form-container expired-form">
                <h3>得獎者寄件資料填寫</h3>
                <div className="empty-state" style={{ padding: '2rem', border: '1px solid #ddd', borderRadius: '8px', marginTop: '1rem', textAlign: 'center' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '1.2rem' }}>此表單已超過填寫截止時間，無法再進行填寫。</p>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="winner-form-container success-form">
                <h3>得獎者寄件資料填寫</h3>
                <div className="empty-state" style={{ padding: '2rem', border: '1px solid #007130', borderRadius: '8px', marginTop: '1rem', textAlign: 'center', background: '#e8f5e9' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#007130" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <p style={{ color: '#007130', fontWeight: 'bold', fontSize: '1.2rem' }}>已成功收到您的資料！</p>
                    <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>我們將統整收件名單一併寄出，再請耐心等候，謝謝。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="winner-form-container" style={{ marginTop: '3rem', padding: '2rem', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa' }}>
            <h3 style={{ marginBottom: '1.5rem', color: '#007130', fontSize: '1.5rem', borderBottom: '2px solid #007130', paddingBottom: '0.5rem', display: 'inline-block' }}>得獎者寄件資料填寫</h3>

            {post?.formDeadline && (
                <div style={{ marginBottom: '1.5rem', color: '#d32f2f', fontWeight: 'bold' }}>
                    填寫截止時間：{(post.formDeadline.toDate ? post.formDeadline.toDate() : new Date(post.formDeadline)).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
            )}

            <form onSubmit={handleSubmit} className="edit-form" style={{ marginTop: 0 }}>
                <div className="form-group">
                    <label>Facebook 名稱 <span style={{ color: 'red' }}>*</span></label>
                    <input
                        type="text"
                        required
                        value={communityName}
                        onChange={e => setCommunityName(e.target.value)}
                        placeholder="輸入您的 FB 名稱，若您參加 IG 抽獎則填寫 IG 帳號"
                        className="input-md"
                    />
                </div>

                <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                        <label>收件者姓名 <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="text"
                            required
                            value={recipientName}
                            onChange={e => setRecipientName(e.target.value)}
                            placeholder="請輸入真實姓名"
                            className="input-md"
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
                        <label>收件者電話 <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="tel"
                            required
                            value={recipientPhone}
                            onChange={e => setRecipientPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="請輸入聯絡電話 (如: 0912345678)"
                            className="input-md"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>聯絡地址 <span style={{ color: 'red' }}>*</span></label>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <select
                            required
                            value={county}
                            onChange={handleCountyChange}
                            style={{ flex: 1, minWidth: '120px' }}
                        >
                            <option value="">選擇縣市</option>
                            {Object.keys(twzipcodeData).map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <select
                            required
                            value={district}
                            onChange={handleDistrictChange}
                            disabled={!county}
                            style={{ flex: 1, minWidth: '120px' }}
                        >
                            <option value="">選擇鄉鎮市區</option>
                            {county && twzipcodeData[county] && Object.keys(twzipcodeData[county]).map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            readOnly
                            value={zipCode}
                            placeholder="郵遞區號"
                            style={{ width: '80px', background: '#e9ecef', cursor: 'not-allowed' }}
                        />
                    </div>
                    <input
                        type="text"
                        required
                        value={addressDetail}
                        onChange={e => setAddressDetail(e.target.value)}
                        placeholder="請輸入詳細地址 (街道、巷弄、號、樓)"
                        className="input-md"
                    />
                </div>

                <div className="form-group" style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', marginBottom: '1rem' }}>
                    <ReCAPTCHA
                        sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                        onChange={(value) => setCaptchaValue(value)}
                    />
                </div>

                <div className="edit-actions" style={{ marginTop: '1rem', justifyContent: 'center' }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting || !captchaValue} style={{ padding: '0.8rem 3rem', fontSize: '1.1rem' }}>
                        {submitting ? '處理中...' : '確認送出'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default WinnerForm;
