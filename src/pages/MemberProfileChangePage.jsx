import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

function MemberProfileChangePage() {
    const navigate = useNavigate();
    
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

    // 驗證手機格式：09 開頭且共 10 位數字
    const validatePhoneFormat = (phoneStr) => {
        const regex = /^09\d{8}$/;
        return regex.test(phoneStr);
    };

    const handleSubmit = async (e) => {
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
            if (newPhone.trim() !== confirmPhone.trim()) {
                setError('兩次輸入的新手機號碼不一致');
                return;
            }
        } else if (changeType === 'birthday') {
            if (!newBirthday) {
                setError('請選擇或填寫新的生日');
                return;
            }
        }

        setSubmitting(true);
        try {
            // 轉換為後台 member_actions 規格
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
                submittedByLineId: null,
                createdAt: serverTimestamp()
            };

            // 寫入 Firestore
            await addDoc(collection(db, 'member_actions'), applyData);
            
            // 提交成功，顯示彈窗
            setShowModal(true);
        } catch (err) {
            console.error('提交資料變更申請失敗:', err);
            setError('提交失敗，請檢查網路連線後再試。');
        } finally {
            setSubmitting(false);
        }
    };

    const handleModalConfirm = () => {
        setShowModal(false);
        // 清空表單
        setIdentifier('');
        setNewPhone('');
        setConfirmPhone('');
        setNewBirthday('');
        // 導回首頁
        navigate('/');
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
                justifyContent: 'center',
                padding: '3rem 1.5rem'
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
                                border: '1px solid rgba(0, 0, 0, 0.02)'
                            }}
                        >
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
                                            background: isSelected ? '#ffffff' : 'transparent',
                                            color: isSelected ? '#1d1d1f' : '#86868b',
                                            fontSize: '0.85rem',
                                            fontWeight: isSelected ? '600' : '500',
                                            cursor: 'pointer',
                                            boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 1px rgba(0,0,0,0.02)' : 'none',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

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
                                e.target.style.borderColor = '#0071e3';
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
                                        e.target.style.borderColor = '#0071e3';
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
                                        e.target.style.borderColor = '#0071e3';
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
                                    min="1900-01-01"
                                    max={new Date().toISOString().split('T')[0]}
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
                                        e.target.style.borderColor = '#0071e3';
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
                            刪除會員後，您的會員點數、消費紀錄及相關權益將會一併移除且無法復原。送出此申請即代表您同意刪除會員所有資料。
                        </div>
                    )}

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
                                background: '#eafaf1', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                margin: '0 auto 1rem' 
                            }}
                        >
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </div>
                        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: '700', color: '#1d1d1f' }}>
                            申請提交成功
                        </h3>
                        <p style={{ margin: '0 0 1.5rem', color: '#86868b', fontSize: '0.875rem', lineHeight: '1.5' }}>
                            您的資料申請將於七個工作天處理完畢
                        </p>
                        <button 
                            onClick={handleModalConfirm}
                            style={{ 
                                width: '100%', 
                                padding: '0.8rem', 
                                background: '#0071e3', 
                                color: '#ffffff', 
                                border: 'none', 
                                borderRadius: '10px', 
                                fontWeight: '600', 
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = '#0077ed'}
                            onMouseLeave={e => e.currentTarget.style.background = '#0071e3'}
                        >
                            確定
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MemberProfileChangePage;
