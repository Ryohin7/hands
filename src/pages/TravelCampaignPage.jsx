import React, { useEffect, useRef, useState } from 'react';
import ReCAPTCHA from "react-google-recaptcha";
import '../styles/TravelCampaign.css';

const TravelCampaignPage = () => {
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        email: '',
        receiptNo: ''
    });
    const [captchaValue, setCaptchaValue] = useState(null);
    const infoSectionRef = useRef(null);
    const scrollRevealRefs = useRef([]);

    const scrollToInfo = () => {
        infoSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        scrollRevealRefs.current.forEach(el => {
            if (el) observer.observe(el);
        });

        return () => {
            scrollRevealRefs.current.forEach(el => {
                if (el) observer.unobserve(el);
            });
        };
    }, []);

    const addToRefs = (el) => {
        if (el && !scrollRevealRefs.current.includes(el)) {
            scrollRevealRefs.current.push(el);
        }
    };

    const handleInput = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const onCaptchaChange = (value) => {
        setCaptchaValue(value);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!captchaValue) {
            alert('請先進行 reCAPTCHA 驗證');
            return;
        }
        console.log('Form Submit:', formData);
        alert('登錄成功！感謝您的參與。');
    };

    return (
        <div className="travel-campaign-container">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="reveal" ref={addToRefs}>
                    <h1 className="hero-title">跟著HANDS去旅行</h1>
                    <div
                        className="hero-subtitle"
                        onClick={scrollToInfo}
                        style={{ cursor: 'pointer' }}
                    >
                        明細登錄抽獎活動
                    </div>
                    <div className="hero-scroll-hint">Scroll to explore ✈️</div>
                </div>

                {/* Floating Elements */}
                <div className="floating-item icon-1">✈️</div>
                <div className="floating-item icon-2">🌍</div>
                <div className="floating-item icon-3">👜</div>
                <div className="floating-item icon-4">📸</div>
                <div className="floating-item icon-5">🗺️</div>
                <div className="floating-item icon-6">🎟️</div>
                <div className="floating-item icon-7">🚆</div>
                <div className="floating-item icon-8">🍜</div>
                <div className="floating-item icon-9">🗼</div>
            </section>

            {/* Prize Section - Light Background */}
            <section className="prize-section section-alt">
                <h2 className="section-title reveal" ref={addToRefs}>登錄明細抽 HANDS 購物金</h2>
                <div className="prize-grid">
                    <div className="prize-card reveal slide-left" ref={addToRefs}>
                        <div className="prize-icon">
                            <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="120" height="80" rx="10" fill="var(--hands-gold)" fillOpacity="0.1" />
                                <path d="M0 40C6 40 6 46 0 46V40Z" fill="var(--hands-gold)" />
                                <path d="M120 40C114 40 114 46 120 46V40Z" fill="var(--hands-gold)" />
                                <rect x="12" y="12" width="96" height="56" rx="6" stroke="var(--hands-gold)" strokeWidth="2" strokeDasharray="6 3" />
                                <text x="60" y="47" fill="var(--hands-gold)" fontFamily="Arial" fontWeight="bold" fontSize="14" textAnchor="middle" letterSpacing="1">COUPON</text>
                            </svg>
                        </div>
                        <h3>大獎</h3>
                        <div className="prize-amount">300元電子券</div>
                        <div className="prize-winners">共 3 名</div>
                    </div>
                    <div className="prize-card reveal slide-right" ref={addToRefs}>
                        <div className="prize-icon">
                            <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="120" height="80" rx="10" fill="var(--hands-gold)" fillOpacity="0.1" />
                                <path d="M0 40C6 40 6 46 0 46V40Z" fill="var(--hands-gold)" />
                                <path d="M120 40C114 40 114 46 120 46V40Z" fill="var(--hands-gold)" />
                                <rect x="12" y="12" width="96" height="56" rx="6" stroke="var(--hands-gold)" strokeWidth="2" strokeDasharray="6 3" />
                                <text x="60" y="47" fill="var(--hands-gold)" fontFamily="Arial" fontWeight="bold" fontSize="14" textAnchor="middle" letterSpacing="1">COUPON</text>
                            </svg>
                        </div>
                        <h3>貳獎</h3>
                        <div className="prize-amount">100元電子券</div>
                        <div className="prize-winners">共 10 名</div>
                        <div className="prize-winners">*單筆消費滿 500 元折抵 100 元</div>

                    </div>
                </div>
            </section>

            {/* Info Section - Dark Background */}
            <section className="info-section section-dark" ref={infoSectionRef}>
                <div className="info-content">
                    <div className="info-item reveal slide-left" ref={addToRefs}>
                        <div className="info-label">活動時間</div>
                        <div className="info-text" style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--hands-gold)' }}>2026/04/10 - 2026/08/31</div>
                    </div>
                    <div className="info-item reveal slide-right" ref={addToRefs}>
                        <div className="info-label">活動辦法</div>
                        <div className="info-text" style={{ color: 'rgba(0, 0, 0, 0.8)' }}>
                            活動期間內，於日本 <span style={{ color: 'rgba(11, 112, 26, 0.83)', fontWeight: '700' }}>HANDS</span> 出示台灣護照並使用指定 95 折優惠券消費，
                            並在活動期間內至本頁面登錄消費明細即可參加抽獎。
                        </div>
                    </div>
                    <div className="info-item reveal slide-left" ref={addToRefs}>
                        <div className="info-label">注意事項</div>
                        <div className="info-text" style={{ color: 'rgba(0, 0, 0, 0.8)' }}>1.消費明細限2026/04/10-2026/08/31 日本 HANDS 所開立之有效明細，台灣台隆手創館消費明細恕無法參加抽獎。
                            <br />2.中獎名單將於 2026/9/1 公布於 Facebook 粉絲專頁及 instagram。
                            <br />3.中獎獲得之電子券限台灣台隆手創館門市使用，使用期限至 2026 年 12 月 31 日止，逾期自動失效。
                            <br />4.登錄明細後視同了解並同意本活動所有相關規範。電子券不得要求折換現金或更換贈品內容。
                            <br />5.每人限參加乙次，若有多筆消費明細則以首次登錄資料為主。
                            <br />6.若有不實登錄或資料造假者，經查證屬實台隆手創館有權取消抽獎資格，不得有任何疑義。
                            <br />台隆手創館保留本活動隨時修改、終止及活動最終解釋權。
                        </div>
                    </div>
                </div>
                {/* Decorative Earth Icon */}
                <div className="info-bg-icon">🌍</div>
            </section >

            {/* Form Section - WinnerForm Style */}
            < section className="campaign-form-section reveal" ref={addToRefs} >
                <div className="winner-form-container">
                    <div className="winner-form-card">
                        <div className="winner-form-header">
                            <h3>明細登錄表單</h3>
                        </div>

                        <form onSubmit={handleSubmit} className="responsive-form">
                            <div className="form-section">
                                <div className="form-grid">
                                    <div className="form-item">
                                        <label>會員姓名 <span className="required">*</span></label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInput}
                                            required
                                            placeholder="請輸入姓名"
                                        />
                                    </div>
                                    <div className="form-item">
                                        <label>會員號碼 <span className="required">*</span></label>
                                        <input
                                            type="tel"
                                            name="mobile"
                                            value={formData.mobile}
                                            onChange={handleInput}
                                            required
                                            placeholder="例：0912345678"
                                        />
                                    </div>
                                </div>
                                <div className="form-item full-width" style={{ marginTop: '1.25rem' }}>
                                    <label>Email 信箱</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInput}
                                        placeholder="example@email.com"
                                    />
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.4rem', lineHeight: '1.4' }}>
                                        若手機無法接通，工作人員可能將以E-mail方式與您聯繫，建議填寫。
                                    </div>
                                </div>
                                <div className="form-item full-width" style={{ marginTop: '1.25rem' }}>
                                    <label>日本 HANDS 明細購物編號 <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        name="receiptNo"
                                        value={formData.receiptNo}
                                        onChange={handleInput}
                                        required
                                        placeholder="請輸入購物明細上的編號"
                                    />
                                </div>
                            </div>

                            <div className="captcha-section">
                                <ReCAPTCHA
                                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                                    onChange={onCaptchaChange}
                                />
                            </div>

                            <div className="form-actions" style={{ textAlign: 'center' }}>
                                <button type="submit" className="campaign-submit-btn">填寫完畢，送出</button>
                            </div>
                        </form>
                    </div>
                </div>
            </section >

            {/* Footer space */}
            < div style={{ height: '5rem', background: '#009B52' }}></div >
        </div >
    );
};

export default TravelCampaignPage;
