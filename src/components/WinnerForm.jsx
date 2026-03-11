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
        <div className="winner-form-container">
            <div className="winner-form-card">
                <div className="winner-form-header">
                    <h3>得獎者寄件資料填寫</h3>
                </div>

                {post?.formDeadline && (
                    <div className="deadline-alert">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        填寫截止時間：{(post.formDeadline.toDate ? post.formDeadline.toDate() : new Date(post.formDeadline)).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="responsive-form">
                    <div className="form-section">
                        <div className="form-item full-width">
                            <label>Facebook 名稱 / Instagram 帳號 <span className="required">*</span></label>
                            <input
                                type="text"
                                required
                                value={communityName}
                                onChange={e => setCommunityName(e.target.value)}
                                placeholder="輸入您的 FB 名稱或 IG 帳號"
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
                                    placeholder="請輸入真實姓名"
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
                                <select
                                    required
                                    value={county}
                                    onChange={handleCountyChange}
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
                                    placeholder="郵遞"
                                    className="zip-input"
                                />
                            </div>
                            <input
                                type="text"
                                required
                                value={addressDetail}
                                onChange={e => setAddressDetail(e.target.value)}
                                placeholder="請輸入詳細地址 (街道、巷弄、號、樓)"
                                className="address-detail-input"
                            />
                        </div>
                    </div>

                    <div className="captcha-section">
                        <ReCAPTCHA
                            sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                            onChange={(value) => setCaptchaValue(value)}
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="submit-btn" disabled={submitting || !captchaValue}>
                            {submitting ? '處理中...' : '確認送出資料'}
                        </button>
                    </div>
                </form>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .winner-form-container {
                    margin-top: 3rem;
                    max-width: 800px;
                    margin-left: auto;
                    margin-right: auto;
                }
                .winner-form-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e5e7eb;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    overflow: hidden;
                }
                .winner-form-header {
                    background: #fdfdfd;
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid #e5e7eb;
                }
                .winner-form-header h3 {
                    margin: 0;
                    color: #007130;
                    font-size: 1.5rem;
                    font-weight: 700;
                }
                .deadline-alert {
                    margin: 1.5rem 2rem;
                    background: #fef2f2;
                    border: 1px solid #fee2e2;
                    color: #dc2626;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.95rem;
                }
                .responsive-form {
                    padding: 0 2rem 2rem 2rem;
                }
                .form-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .form-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.25rem;
                }
                .form-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .form-item label {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #374151;
                }
                .required {
                    color: #ef4444;
                }
                .responsive-form input[type="text"],
                .responsive-form input[type="tel"],
                .responsive-form select {
                    padding: 0.75rem 1rem;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 1rem;
                    transition: all 0.2s;
                    background: #fff;
                }
                .responsive-form input:focus,
                .responsive-form select:focus {
                    outline: none;
                    border-color: #007130;
                    box-shadow: 0 0 0 3px rgba(0, 113, 48, 0.1);
                }
                .address-selectors {
                    display: grid;
                    grid-template-columns: 1fr 1fr 80px;
                    gap: 8px;
                    margin-bottom: 8px;
                }
                .zip-input {
                    background: #f3f4f6 !important;
                    cursor: not-allowed;
                    text-align: center;
                }
                .captcha-section {
                    display: flex;
                    justify-content: center;
                    margin: 2rem 0;
                }
                .form-actions {
                    display: flex;
                    justify-content: center;
                }
                .submit-btn {
                    background: #007130;
                    color: white;
                    border: none;
                    padding: 1rem 4rem;
                    font-size: 1.1rem;
                    font-weight: 600;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 6px -1px rgba(0, 113, 48, 0.2);
                }
                .submit-btn:hover:not(:disabled) {
                    background: #005a26;
                    transform: translateY(-1px);
                    box-shadow: 0 10px 15px -3px rgba(0, 113, 48, 0.3);
                }
                .submit-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                @media (max-width: 640px) {
                    .winner-form-card {
                        border-radius: 0;
                        border-left: none;
                        border-right: none;
                        box-shadow: none;
                    }
                    .winner-form-header {
                        padding: 1.5rem 1rem;
                    }
                    .responsive-form {
                        padding: 0 1rem 1.5rem 1rem;
                    }
                    .deadline-alert {
                        margin: 1rem;
                    }
                    .form-grid {
                        grid-template-columns: 1fr;
                    }
                    .address-selectors {
                        grid-template-columns: 1fr 1fr;
                    }
                    .zip-input {
                        grid-column: span 2;
                    }
                    .submit-btn {
                        width: 100%;
                    }
                }
            ` }} />
        </div>
    );
}

export default WinnerForm;
