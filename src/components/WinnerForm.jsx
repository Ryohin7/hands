import { useState, useEffect, useRef } from 'react';
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
    const [isReviewing, setIsReviewing] = useState(false);
    const [isInsideApp, setIsInsideApp] = useState(false);
    const [captchaLoaded, setCaptchaLoaded] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const formRef = useRef(null);

    useEffect(() => {
        if (post?.formDeadline) {
            const now = new Date();
            const deadline = post.formDeadline.toDate ? post.formDeadline.toDate() : new Date(post.formDeadline);
            if (now > deadline) {
                setIsExpired(true);
            }
        }

        const ua = navigator.userAgent || navigator.vendor || window.opera;
        const isFB = (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf("Messenger") > -1);
        const isLine = (ua.indexOf("Line") > -1);
        if (isFB || isLine) {
            setIsInsideApp(true);
        }
    }, [post]);

    useEffect(() => {
        // 如果 10 秒後驗證元件還沒載入，顯示建議切換瀏覽器的訊息
        const timer = setTimeout(() => {
            if (!captchaLoaded && !submitted && !isExpired) {
                setErrorMsg('驗證元件載入過久，若持續未出現，請點擊右上角「...」並選擇「以瀏覽器開啟」。');
            }
        }, 10000);
        return () => clearTimeout(timer);
    }, [captchaLoaded, submitted, isExpired]);

    const handleCountyChange = (e) => {
        const selectedCounty = e.target.value;
        setCounty(selectedCounty);
        setDistrict('');
        setZipCode('');
    };

    const handleDistrictChange = (e) => {
        const selectedDistrict = e.target.value;
        setDistrict(selectedDistrict);
        if (county && twzipcodeData[county] && twzipcodeData[county][selectedDistrict]) {
            setZipCode(twzipcodeData[county][selectedDistrict]);
        } else {
            setZipCode('');
        }
    };

    const handlePreSubmit = (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!communityName || !recipientName || !recipientPhone || !county || !district || !addressDetail) {
            setErrorMsg('請填寫所有必填欄位！');
            return;
        }

        if (!captchaValue) {
            setErrorMsg('請先勾選「我不是機器人」進行驗證！');
            return;
        }

        setIsReviewing(true);
        // 捲動到表單區塊的最上方
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        setErrorMsg('');

        try {
            console.log('開始提交中獎表單...', post.id);
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

            console.log('提交成功');
            setSubmitted(true);
        } catch (error) {
            console.error('送出表單失敗', error);
            setErrorMsg('資料送出失敗：' + (error.message || '未知錯誤') + '。請稍後再試。');
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
        <div className="winner-form-container" ref={formRef}>
            {isInsideApp && (
                <div className="app-browser-notice">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                    <span>偵測到您在 App 內，若無法勾選驗證或送出，請點擊右上角「...」選擇「以瀏覽器開啟」。</span>
                </div>
            )}

            <div className="winner-form-card">
                <div className="winner-form-header">
                    <h3>{isReviewing ? '確認資料是否正確' : '得獎者寄件資料填寫'}</h3>
                </div>

                {!isReviewing && post?.formDeadline && (
                    <div className="deadline-alert">
                        填寫截止時間：{(post.formDeadline.toDate ? post.formDeadline.toDate() : new Date(post.formDeadline)).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}

                {isReviewing ? (
                    <div className="review-container">
                        <div className="review-item">
                            <label>社群名稱(帳號)</label>
                            <div>{communityName}</div>
                        </div>
                        <div className="review-item">
                            <label>收件者姓名</label>
                            <div>{recipientName}</div>
                        </div>
                        <div className="review-item">
                            <label>收件者電話</label>
                            <div>{recipientPhone}</div>
                        </div>
                        <div className="review-item">
                            <label>聯絡地址</label>
                            <div>{zipCode} {county}{district}{addressDetail}</div>
                        </div>

                        {errorMsg && <div className="error-message-inline">{errorMsg}</div>}

                        <div className="review-actions">
                            <button type="button" className="edit-btn" onClick={() => {
                                setIsReviewing(false);
                                setTimeout(() => {
                                    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }, 0);
                            }} disabled={submitting}>
                                返回修改
                            </button>
                            <button type="button" className="submit-btn" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? '處理中...' : '確認送出'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handlePreSubmit} className="responsive-form">
                        <div className="form-section">
                            <div className="form-item full-width">
                                <label>社群名稱(帳號) <span className="required">*</span></label>
                                <input
                                    type="text"
                                    required
                                    value={communityName}
                                    onChange={e => setCommunityName(e.target.value)}
                                    placeholder="請輸入您的FB名稱 (IG抽獎填IG帳號)"
                                />
                            </div>

                            <div className="form-grid">
                                <div className="form-item">
                                    <label>收件者姓名 <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={recipientName}
                                        onChange={e => setRecipientName(e.target.value)}
                                        placeholder="請輸入收件者姓名"
                                    />
                                </div>
                                <div className="form-item">
                                    <label>收件者電話 <span className="required">*</span></label>
                                    <input
                                        type="tel"
                                        required
                                        value={recipientPhone}
                                        onChange={e => setRecipientPhone(e.target.value.replace(/\D/g, ''))}
                                        placeholder="如: 0912345678"
                                    />
                                </div>
                            </div>

                            <div className="form-item full-width">
                                <label>聯絡地址 <span className="required">*</span></label>
                                <div className="address-selectors">
                                    <select required value={county} onChange={handleCountyChange}>
                                        <option value="">選擇縣市</option>
                                        {Object.keys(twzipcodeData).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    <select required value={district} onChange={handleDistrictChange} disabled={!county}>
                                        <option value="">選擇鄉鎮市區</option>
                                        {county && twzipcodeData[county] && Object.keys(twzipcodeData[county]).map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    <input type="text" readOnly value={zipCode} placeholder="郵遞" className="zip-input" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={addressDetail}
                                    onChange={e => setAddressDetail(e.target.value)}
                                    placeholder="詳細地址 (街道、巷弄、號、樓)"
                                    className="address-detail-input"
                                />
                            </div>
                        </div>

                        <div className="captcha-section">
                            {!captchaLoaded && <div className="captcha-loading">正在載入驗證元件...</div>}
                            <ReCAPTCHA
                                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                                onChange={(value) => setCaptchaValue(value)}
                                asyncScriptOnLoad={() => setCaptchaLoaded(true)}
                            />
                        </div>

                        {errorMsg && <div className="error-message-inline">{errorMsg}</div>}

                        <div className="form-actions">
                            <button type="submit" className="submit-btn" disabled={submitting || !captchaValue}>
                                下一步：核對資料
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default WinnerForm;
