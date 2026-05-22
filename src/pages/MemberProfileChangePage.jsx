import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

function MemberProfileChangePage() {
    const navigate = useNavigate();

    // 計算 10 歲與 90 歲的限制日期，每年自動更新
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentDate = String(today.getDate()).padStart(2, '0');
    const minDate = `${currentYear - 90}-${currentMonth}-${currentDate}`;
    const maxDate = `${currentYear - 10}-${currentMonth}-${currentDate}`;

    // 表單欄位狀態
    const [changeType, setChangeType] = useState('phone'); // 'phone' | 'birthday' | 'delete'
    const [identifier, setIdentifier] = useState(''); // 手機或卡號
    const [newPhone, setNewPhone] = useState('');
    const [confirmPhone, setConfirmPhone] = useState('');
    const [newBirthday, setNewBirthday] = useState('');

    // 介面狀態
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [submittedSummary, setSubmittedSummary] = useState(null);
    const [modalStep, setModalStep] = useState('confirm'); // 'confirm' | 'success'

    // 驗證手機格式：09 開頭且共 10 位數字
    const validatePhoneFormat = (phoneStr) => {
        const regex = /^09\d{8}$/;
        return regex.test(phoneStr);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        // 基本防呆：手機或卡號必填
        if (!identifier.trim()) {
            setError('請輸入您的手機號碼或會員卡號');
            return;
        }

        // 依據不同類型進行驗證
        if (changeType === 'phone') {
            if (!newPhone.trim() || !confirmPhone.trim()) {
                setError('請填寫新手機號碼與確認新手機號碼');
                return;
            }
            if (!validatePhoneFormat(newPhone.trim())) {
                setError('新手機號碼格式不正確，須為 09 開頭的 10 位數字');
                return;
            }
            if (newPhone.trim() === identifier.trim()) {
                setError('新手機號碼不可與原手機號碼相同');
                return;
            }
            if (newPhone.trim() !== confirmPhone.trim()) {
                setError('兩次輸入的新手機號碼不一致');
                return;
            }
        } else if (changeType === 'birthday') {
            if (!newBirthday) {
                setError('請選擇或填寫新的生日');
                return;
            }
            // 限制 10 歲到 90 歲
            const birthDate = new Date(newBirthday);
            const minDateTime = new Date(minDate);
            const maxDateTime = new Date(maxDate);
            if (birthDate < minDateTime || birthDate > maxDateTime) {
                setError('生日西元年須限制在 10 歲到 90 歲之間');
                return;
            }
        }

        // 僅轉換格式，供確認彈窗顯示與後續送出使用
        let actionType = '';
        let newData = null;
        let changeDetail = '';

        if (changeType === 'phone') {
            actionType = 'edit_phone';
            newData = newPhone.trim();
            changeDetail = `修改手機: ${newData}`;
        } else if (changeType === 'birthday') {
            actionType = 'edit_birthday';
            newData = newBirthday;
            changeDetail = `修改生日: ${newData}`;
        } else if (changeType === 'delete') {
            actionType = 'delete_member';
            changeDetail = '申請刪除會員';
        }

        const applyData = {
            type: actionType,
            memberId: identifier.trim(),
            points: null,
            newData: newData,
            detail: changeDetail,
            status: 'pending',
            submittedBy: 'client',
            submittedByName: '會員自主申請',
            submittedByStore: '官網前台',
            submittedByLineId: null
        };

        setSubmittedSummary({
            type: changeType,
            identifier: identifier.trim(),
            newPhone: newPhone.trim(),
            newBirthday: newBirthday,
            applyData
        });
        setModalStep('confirm');
        setShowModal(true);
    };

    const handleConfirmSubmit = async () => {
        if (!submittedSummary || !submittedSummary.applyData) return;

        setSubmitting(true);
        setError('');
        try {
            const finalApplyData = {
                ...submittedSummary.applyData,
                createdAt: serverTimestamp()
            };

            // 寫入 Firestore
            await addDoc(collection(db, 'member_actions'), finalApplyData);

            // 提交成功，切換到成功提示步驟
            setModalStep('success');
        } catch (err) {
            console.error('提交資料變更申請失敗:', err);
            const errCode = err?.code || err?.message || '未知錯誤';
            setError(`提交失敗 (${errCode})，請檢查網路連線後再試。`);
            setShowModal(false);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        setShowModal(false);
    };

    const handleModalConfirm = () => {
        setShowModal(false);
        // 清空表單
        setIdentifier('');
        setNewPhone('');
        setConfirmPhone('');
        setNewBirthday('');
        setSubmittedSummary(null);
        setModalStep('confirm');
        // 保留在此頁面，不導回首頁
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#ffffff',
                color: '#1d1d1f',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                padding: '8vh 1.5rem 3rem'
            }}
        >
            <div
                style={{
                    maxWidth: '440px',
                    width: '100%',
                    margin: '0 auto',
                    animation: 'fadeIn 0.4s ease both'
                }}
            >
                {/* Apple 風格大文字標題 */}
                <h1
                    style={{
                        fontSize: '2.5rem',
                        fontWeight: '800',
                        letterSpacing: '-0.03em',
                        lineHeight: '1.15',
                        color: '#1d1d1f',
                        marginBottom: '0.5rem',
                        textAlign: 'left'
                    }}
                >
                    會員資料變更
                </h1>
                <p
                    style={{
                        fontSize: '1rem',
                        color: '#86868b',
                        marginBottom: '2.5rem',
                        textAlign: 'left',
                        lineHeight: '1.4'
                    }}
                >
                    請填寫以下表單以提交您的資料變更申請。
                </p>

                <form onSubmit={handleSubmit}>
                    {/* 1. 膠囊式分段選擇器 (Segmented Control) */}
                    <div style={{ marginBottom: '2.25rem' }}>
                        <div
                            style={{
                                display: 'flex',
                                background: '#f5f5f7',
                                borderRadius: '10px',
                                padding: '2px',
                                border: '1px solid rgba(0, 0, 0, 0.02)',
                                position: 'relative'
                            }}
                        >
                            {/* 滑動背景指示器 */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '2px',
                                    bottom: '2px',
                                    left: '2px',
                                    width: 'calc((100% - 4px) / 3)',
                                    background: '#ffffff',
                                    borderRadius: '8px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.02)',
                                    transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                                    transform: `translateX(${['phone', 'birthday', 'delete'].indexOf(changeType) * 100}%)`,
                                    pointerEvents: 'none'
                                }}
                            />
                            {[
                                { id: 'phone', label: '修改手機' },
                                { id: 'birthday', label: '修改生日' },
                                { id: 'delete', label: '刪除會員' }
                            ].map((item) => {
                                const isSelected = changeType === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            setChangeType(item.id);
                                            setError('');
                                        }}
                                        style={{
                                            flex: 1,
                                            padding: '0.6rem 0',
                                            border: 'none',
                                            borderRadius: '8px',
                                            background: 'transparent',
                                            color: isSelected ? '#1d1d1f' : '#86868b',
                                            fontSize: '0.85rem',
                                            fontWeight: isSelected ? '600' : '500',
                                            cursor: 'pointer',
                                            zIndex: 1,
                                            transition: 'color 0.25s cubic-bezier(0.25, 0.8, 0.25, 1)'
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. 表單欄位容器 - 設定最小高度以避免下方的送出按鈕與上方標題抖動 */}
                    <div style={{ minHeight: '260px', display: 'flex', flexDirection: 'column' }}>
                        {/* 2. 共同欄位 */}
                        <div style={{ marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1d1d1f' }}>
                                原手機號碼 或 會員卡號
                            </label>
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="輸入您的手機號碼或會員卡號"
                                style={{
                                    padding: '0.85rem 1rem',
                                    border: '1px solid #d2d2d7',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    outline: 'none',
                                    transition: 'all 0.2s',
                                    background: '#ffffff',
                                    fontFamily: 'inherit'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#1d1d1f';
                                    e.target.style.boxShadow = '0 0 0 4px rgba(0, 113, 227, 0.12)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#d2d2d7';
                                    e.target.style.boxShadow = 'none';
                                }}
                                required
                            />
                        </div>

                        {/* 3. 動態欄位 */}
                        {changeType === 'phone' && (
                            <div style={{ animation: 'fadeIn 0.25s ease both' }}>
                                <div style={{ marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1d1d1f' }}>
                                        新手機號碼
                                    </label>
                                    <input
                                        type="tel"
                                        value={newPhone}
                                        onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                                        placeholder="09開頭的10位數字"
                                        maxLength={10}
                                        style={{
                                            padding: '0.85rem 1rem',
                                            border: '1px solid #d2d2d7',
                                            borderRadius: '12px',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                            background: '#ffffff',
                                            fontFamily: 'inherit'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#1d1d1f';
                                            e.target.style.boxShadow = '0 0 0 4px rgba(0, 113, 227, 0.12)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#d2d2d7';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                        required
                                    />
                                </div>

                                <div style={{ marginBottom: '2.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1d1d1f' }}>
                                        確認新手機號碼
                                    </label>
                                    <input
                                        type="tel"
                                        value={confirmPhone}
                                        onChange={(e) => setConfirmPhone(e.target.value.replace(/\D/g, ''))}
                                        placeholder="再次輸入新手機號碼"
                                        maxLength={10}
                                        style={{
                                            padding: '0.85rem 1rem',
                                            border: '1px solid #d2d2d7',
                                            borderRadius: '12px',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                            background: '#ffffff',
                                            fontFamily: 'inherit'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#1d1d1f';
                                            e.target.style.boxShadow = '0 0 0 4px rgba(0, 113, 227, 0.12)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#d2d2d7';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {changeType === 'birthday' && (
                            <div style={{ animation: 'fadeIn 0.25s ease both' }}>
                                <div style={{ marginBottom: '2.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1d1d1f' }}>
                                        新的生日
                                    </label>
                                    <input
                                        type="date"
                                        value={newBirthday}
                                        onChange={(e) => setNewBirthday(e.target.value)}
                                        min={minDate}
                                        max={maxDate}
                                        style={{
                                            padding: '0.85rem 1rem',
                                            border: '1px solid #d2d2d7',
                                            borderRadius: '12px',
                                            fontSize: '1rem',
                                            outline: 'none',
                                            transition: 'all 0.2s',
                                            background: '#ffffff',
                                            fontFamily: 'inherit'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#1d1d1f';
                                            e.target.style.boxShadow = '0 0 0 4px rgba(0, 113, 227, 0.12)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#d2d2d7';
                                            e.target.style.boxShadow = 'none';
                                        }}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        {changeType === 'delete' && (
                            <div
                                style={{
                                    animation: 'fadeIn 0.25s ease both',
                                    background: '#fff2f2',
                                    border: '1px solid #ffcfcf',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    color: '#ff3b30',
                                    fontSize: '0.85rem',
                                    marginBottom: '2.25rem',
                                    lineHeight: '1.6'
                                }}
                            >
                                <div style={{ fontWeight: '700', marginBottom: '6px' }}>
                                    警告：刪除會員權益提示
                                </div>
                                刪除會員後，您將無法使用會員相關權益，送出此申請即代表您同意刪除會員資料。
                            </div>
                        )}
                    </div>

                    {/* 錯誤提示 */}
                    {error && (
                        <div
                            style={{
                                color: '#ff3b30',
                                textAlign: 'center',
                                fontSize: '0.85rem',
                                marginBottom: '1.5rem',
                                background: '#fff2f2',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                fontWeight: '500'
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* Apple 經典膠囊送出按鈕 */}
                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: submitting ? '#d2d2d7' : '#1d1d1f',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '980px',
                            fontWeight: '600',
                            fontSize: '1rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                            textAlign: 'center'
                        }}
                        onMouseEnter={e => {
                            if (!submitting) e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={e => {
                            if (!submitting) e.currentTarget.style.opacity = '1';
                        }}
                        onMouseDown={e => {
                            if (!submitting) e.currentTarget.style.transform = 'scale(0.98)';
                        }}
                        onMouseUp={e => {
                            if (!submitting) e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        {submitting ? '提交申請中...' : '送出申請'}
                    </button>
                </form>
            </div>

            {/* iOS 風格成功彈窗 Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.4)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)',
                        padding: '1.5rem'
                    }}
                >
                    <div
                        style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            padding: '2rem',
                            maxWidth: '320px',
                            width: '100%',
                            textAlign: 'center',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                            animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both'
                        }}
                    >
                        <div
                            style={{
                                width: '48px',
                                height: '48px',
                                background: modalStep === 'success' ? '#eafaf1' : '#f5f5f7',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1rem',
                                transition: 'background 0.3s'
                            }}
                        >
                            {modalStep === 'success' ? (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="12" x2="12" y2="16" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                            )}
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: '700', color: '#1d1d1f' }}>
                            {modalStep === 'success' ? '申請提交成功' : '確認變更內容'}
                        </h3>
                        {submittedSummary && (
                            <div style={{
                                background: '#f5f5f7',
                                borderRadius: '12px',
                                padding: '1rem',
                                margin: '1rem 0',
                                fontSize: '0.85rem',
                                color: '#1d1d1f',
                                textAlign: 'left',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                border: '1px solid rgba(0, 0, 0, 0.04)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e5e7', paddingBottom: '4px' }}>
                                    <span style={{ color: '#86868b' }}>變更項目</span>
                                    <span style={{ fontWeight: '600' }}>
                                        {submittedSummary.type === 'phone' ? '修改手機' : submittedSummary.type === 'birthday' ? '修改生日' : '刪除會員'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                                    <span style={{ color: '#86868b' }}>會員識別</span>
                                    <span style={{ fontWeight: '500' }}>{submittedSummary.identifier}</span>
                                </div>
                                {submittedSummary.type === 'phone' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#86868b' }}>新手機號碼</span>
                                        <span style={{ fontWeight: '600', color: '#1d1d1f' }}>{submittedSummary.newPhone}</span>
                                    </div>
                                )}
                                {submittedSummary.type === 'birthday' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#86868b' }}>新生日</span>
                                        <span style={{ fontWeight: '600', color: '#1d1d1f' }}>{submittedSummary.newBirthday}</span>
                                    </div>
                                )}
                                {submittedSummary.type === 'delete' && (
                                    <div style={{ color: '#ff3b30', fontWeight: '600', textAlign: 'center', marginTop: '4px' }}>
                                        申請刪除此會員帳號
                                    </div>
                                )}
                            </div>
                        )}
                        <p style={{ margin: '0 0 1.5rem', color: '#86868b', fontSize: '0.875rem', lineHeight: '1.5' }}>
                            {modalStep === 'success' ? '您的資料申請將於七個工作天處理完畢' : '請確認上述變更資訊無誤後點擊送出'}
                        </p>
                        {modalStep === 'confirm' ? (
                            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                <button
                                    onClick={handleCancel}
                                    disabled={submitting}
                                    style={{
                                        flex: 1,
                                        padding: '0.8rem',
                                        background: '#f5f5f7',
                                        color: '#1d1d1f',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        fontSize: '0.95rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#e8e8ed'; }}
                                    onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#f5f5f7'; }}
                                >
                                    返回修改
                                </button>
                                <button
                                    onClick={handleConfirmSubmit}
                                    disabled={submitting}
                                    style={{
                                        flex: 1,
                                        padding: '0.8rem',
                                        background: submitting ? '#d2d2d7' : '#1d1d1f',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        fontSize: '0.95rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#007130'; }}
                                    onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = '#1d1d1f'; }}
                                >
                                    {submitting ? '送出中...' : '確認送出'}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleModalConfirm}
                                style={{
                                    width: '100%',
                                    padding: '0.8rem',
                                    background: '#1d1d1f',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    fontSize: '0.95rem',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#0077ed'}
                                onMouseLeave={e => e.currentTarget.style.background = '#1d1d1f'}
                            >
                                確定
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MemberProfileChangePage;
