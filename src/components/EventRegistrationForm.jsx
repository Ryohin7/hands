import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import ReCAPTCHA from 'react-google-recaptcha';
import DOMPurify from 'dompurify';
import { autoSpace } from '../utils/textUtils';

function EventRegistrationForm({ post }) {
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [membershipLevel, setMembershipLevel] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    const [isFull, setIsFull] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [captchaValue, setCaptchaValue] = useState(null);
    const [isReviewing, setIsReviewing] = useState(false);
    const [captchaLoaded, setCaptchaLoaded] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [currentRegCount, setCurrentRegCount] = useState(0);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [termsContent, setTermsContent] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [isReadToBottom, setIsReadToBottom] = useState(false);
    const [termsTimer, setTermsTimer] = useState(10);
    const [canCloseTerms, setCanCloseTerms] = useState(false);
    const scrollRef = useRef(null);
    const timerRef = useRef(null);
    const formRef = useRef(null);

    const membershipLevels = ['一般會員', '白金會員', '黑卡會員', '非會員'];

    useEffect(() => {
        if (post?.formDeadline) {
            const now = new Date();
            const deadline = post.formDeadline.toDate ? post.formDeadline.toDate() : new Date(post.formDeadline);
            if (now > deadline) {
                setIsExpired(true);
            }
        }

        if (post?.id) {
            fetchCurrentCount();
        }
    }, [post]);

    useEffect(() => {
        let interval;
        if (showTermsModal && termsTimer > 0) {
            interval = setInterval(() => {
                setTermsTimer((prev) => prev - 1);
            }, 1000);
        } else if (termsTimer === 0 && isReadToBottom) {
            setCanCloseTerms(true);
        }
        return () => clearInterval(interval);
    }, [showTermsModal, termsTimer, isReadToBottom]);

    const openTermsModal = async () => {
        setShowTermsModal(true);
        setTermsTimer(5);
        setIsReadToBottom(false);
        setCanCloseTerms(false);

        if (!termsContent) {
            try {
                const docRef = doc(db, 'custom_pages', 'DataCollectionEventTerms');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setTermsContent(docSnap.data().content);
                } else {
                    setTermsContent('<p>個資聲明內容載入失敗或頁面不存在。</p>');
                }
            } catch (err) {
                console.error('取得聲明資料失敗:', err);
                setTermsContent('<p>載入出錯，請稍後再試。</p>');
            }
        }
    };

    const handleTermsScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // 容差 5 像素
        if (scrollTop + clientHeight >= scrollHeight - 5) {
            setIsReadToBottom(true);
        }
    };

    function sanitizeHtml(html) {
        if (!html) return '';
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'ul', 'ol', 'li', 'span', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
            ALLOWED_ATTR: ['style', 'class', 'colspan', 'rowspan'],
        });
    }

    async function fetchCurrentCount() {
        try {
            const q = query(collection(db, 'event_registrations'), where('postId', '==', post.id));
            const snapshot = await getDocs(q);
            setCurrentRegCount(snapshot.size);

            // 判斷是否額滿並停止報名
            if (post?.registrationLimit > 0 && post.allowWaitlist === false) {
                if (snapshot.size >= post.registrationLimit) {
                    setIsFull(true);
                }
            }
        } catch (err) {
            console.error('獲取報名人數失敗:', err);
        }
    }

    const handlePreSubmit = (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!name || !gender || !phone || !membershipLevel) {
            setErrorMsg('請填寫所有必填欄位！');
            return;
        }

        if (!agreed) {
            setErrorMsg('請閱讀並勾選同意個資收集暨活動聲明事項！');
            return;
        }

        if (!captchaValue) {
            setErrorMsg('請先勾選「我不是機器人」進行驗證！');
            return;
        }

        setIsReviewing(true);
        setTimeout(() => {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    };

    const handleSubmit = async () => {
        if (submitting) return;
        setSubmitting(true);
        setErrorMsg('');

        try {
            // 決定狀態：使用者要求預設為「報名確認中」
            const status = '報名確認中';

            await addDoc(collection(db, 'event_registrations'), {
                postId: post.id,
                postTitle: post.title,
                name: name.trim(),
                gender,
                phone: phone.trim(),
                email: email.trim(),
                membershipLevel,
                status,
                submittedAt: serverTimestamp(),
            });

            setSubmitted(true);
        } catch (error) {
            console.error('送出報名失敗', error);
            setErrorMsg('資料送出失敗：' + (error.message || '未知錯誤') + '。請稍後再試。');
        } finally {
            setSubmitting(false);
        }
    };

    if (isExpired || isFull) {
        return (
            <div className="winner-form-container expired-form">
                <h3>實體活動報名表單</h3>
                <div className="empty-state" style={{ padding: '2rem', border: '1px solid #ddd', borderRadius: '8px', marginTop: '1rem', textAlign: 'center' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d32f2f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '1.2rem' }}>此活動報名已截止或已額滿。</p>
                </div>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="winner-form-container success-form">
                <h3>實體活動報名表單</h3>
                <div className="empty-state" style={{ padding: '2rem', border: '1px solid #007130', borderRadius: '8px', marginTop: '1rem', textAlign: 'center', background: '#e8f5e9' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#007130" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <p style={{ color: '#007130', fontWeight: 'bold', fontSize: '1.2rem' }}>報名資料已送出！</p>
                    <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>感謝您的參與，您可至首頁「報名查詢」確認狀態。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="winner-form-container" ref={formRef}>
            <div className="winner-form-card">
                <div className="winner-form-header">
                    <h3>{isReviewing ? '確認報名資料' : '實體活動報名表'}</h3>
                </div>

                {!isReviewing && post?.formDeadline && (
                    <div className="deadline-alert">
                        報名截止時間：{(post.formDeadline.toDate ? post.formDeadline.toDate() : new Date(post.formDeadline)).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}

                {!isReviewing && post?.registrationLimit > 0 && (
                    <div className="limit-info" style={{ margin: '0 2rem 1rem', fontSize: '0.9rem', color: '#666' }}>
                        目前報名人數：{currentRegCount} / {post.registrationLimit}
                        {currentRegCount >= post.registrationLimit && <span style={{ color: '#d32f2f', marginLeft: '10px' }}>(目前為候補登記，不代表報名成功)</span>}
                    </div>
                )}

                {isReviewing ? (
                    <div className="review-container">
                        <div className="review-item">
                            <label>姓名</label>
                            <div>{name}</div>
                        </div>
                        <div className="review-item">
                            <label>性別</label>
                            <div>{gender}</div>
                        </div>
                        <div className="review-item">
                            <label>手機</label>
                            <div>{phone}</div>
                        </div>
                        <div className="review-item">
                            <label>E-mail</label>
                            <div>{email}</div>
                        </div>
                        <div className="review-item">
                            <label>會員級別</label>
                            <div>{membershipLevel}</div>
                        </div>

                        {errorMsg && <div className="error-message-inline">{errorMsg}</div>}

                        <div className="review-actions">
                            <button type="button" className="edit-btn" onClick={() => setIsReviewing(false)} disabled={submitting}>
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
                            <div className="form-grid">
                                <div className="form-item">
                                    <label>姓名 <span className="required">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="請輸入姓名"
                                    />
                                </div>
                                <div className="form-item">
                                    <label>性別 <span className="required">*</span></label>
                                    <select required value={gender} onChange={e => setGender(e.target.value)}>
                                        <option value="">請選擇</option>
                                        <option value="男">男</option>
                                        <option value="女">女</option>
                                        <option value="其他">其他</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-grid">
                                <div className="form-item">
                                    <label>連絡電話 <span className="required">*</span></label>
                                    <input
                                        type="tel"
                                        required
                                        value={phone}
                                        onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                                        placeholder="如: 0912345678"
                                    />
                                </div>
                                <div className="form-item">
                                    <label>會員級別 <span className="required">*</span></label>
                                    <select required value={membershipLevel} onChange={e => setMembershipLevel(e.target.value)}>
                                        <option value="">請選擇</option>
                                        {membershipLevels.map(level => (
                                            <option key={level} value={level}>{level}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-item full-width">
                                <label>E-mail</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="example@mail.com"
                                />
                                <span style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>※ 若手機無法接通，工作人員可能將以E-mail方式與您聯繫，建議填寫。</span>
                            </div>

                            <div className="form-item full-width" style={{ marginTop: '0.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'flex-start', fontWeight: '500', cursor: 'pointer', fontSize: '0.9rem', lineHeight: '1.4' }}>
                                    <input
                                        type="checkbox"
                                        checked={agreed}
                                        onChange={e => {
                                            if (e.target.checked) {
                                                openTermsModal();
                                            } else {
                                                setAgreed(false);
                                            }
                                        }}
                                        style={{ width: '18px', height: '18px', marginRight: '10px', marginTop: '2px' }}
                                    />
                                    <span>我已閱讀並同意 <button type="button" onClick={openTermsModal} style={{ background: 'none', border: 'none', color: '#007130', textDecoration: 'underline', padding: 0, cursor: 'pointer', font: 'inherit', fontWeight: 'bold' }}>個資收集暨活動聲明事項</button></span>
                                </label>
                            </div>
                        </div>

                        <div className="captcha-section">
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

            {/* 條款彈窗 */}
            {showTermsModal && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <h3>個資收集暨活動聲明事項</h3>
                        </div>
                        <div
                            className="modal-content ql-editor"
                            ref={scrollRef}
                            onScroll={handleTermsScroll}
                        >
                            <div
                                className="post-detail-content"
                                dangerouslySetInnerHTML={{ __html: autoSpace(sanitizeHtml(termsContent)) }}
                            />
                        </div>
                        <div className="modal-footer">
                            <div className="terms-hint">
                                {!isReadToBottom && <span>請滑動至內容最底部</span>}
                                {isReadToBottom && termsTimer > 0 && <span>請繼續閱讀 ({termsTimer}s)</span>}
                                {isReadToBottom && termsTimer === 0 && <span style={{ color: '#007130' }}>感謝您的閱讀，現在可以關閉視窗</span>}
                            </div>
                            <button
                                type="button"
                                className="btn btn-primary"
                                disabled={!canCloseTerms}
                                onClick={() => {
                                    setShowTermsModal(false);
                                    setAgreed(true);
                                }}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', cursor: canCloseTerms ? 'pointer' : 'not-allowed', background: canCloseTerms ? '#007130' : '#ccc' }}
                            >
                                {canCloseTerms ? '我已了解並關閉' : `請閱讀內容並等待 (${termsTimer}s)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default EventRegistrationForm;
