import { useState, useEffect, useRef } from 'react';

function SmsAdminPage() {
    // 專案的內部 API KEY，用於安全校驗後端 API
    const INTERNAL_API_KEY = 'HANDSFORSTAFF2026';

    const [recipientInput, setRecipientInput] = useState('');
    const [importedNumbers, setImportedNumbers] = useState([]);
    const [duplicateCount, setDuplicateCount] = useState(0);
    const [smsBody, setSmsBody] = useState('');
    const [sendType, setSendType] = useState('immediate'); // 'immediate' 或 'scheduled'
    const [scheduledTime, setScheduledTime] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [walletBalance, setWalletBalance] = useState(null);
    
    const fileInputRef = useRef(null);

    // 載入發送歷史
    const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const res = await fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'list',
                    apiKey: INTERNAL_API_KEY,
                    data: { limit: 50 }
                })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                setHistory(data.messages || []);
                // 從最新的簡訊發送紀錄中提取餘額 (如果有的話)
                if (data.messages && data.messages.length > 0) {
                    const latestWithBalance = data.messages.find(m => m.balance_cents !== undefined);
                    if (latestWithBalance) {
                        setWalletBalance((latestWithBalance.balance_cents / 100).toFixed(2));
                    }
                }
            } else {
                console.error('無法載入歷史紀錄:', data.error);
            }
        } catch (err) {
            console.error('載入歷史紀錄發生錯誤:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // 格式化電話號碼
    const formatPhoneNumber = (num) => {
        let cleaned = num.replace(/\D/g, '');
        // 台灣號碼處理
        if (cleaned.startsWith('886')) {
            return '+' + cleaned;
        }
        if (cleaned.startsWith('09')) {
            return '+886' + cleaned.slice(1);
        }
        if (cleaned.startsWith('9') && cleaned.length === 9) {
            return '+886' + cleaned;
        }
        // 如果是國際格式開頭
        if (cleaned.length >= 10) {
            return '+' + cleaned;
        }
        return null;
    };

    // 處理 CSV/TXT 檔案導入
    const handleFiles = (files) => {
        const file = files[0];
        if (!file) return;

        if (!file.name.match(/\.(csv|txt)$/i)) {
            setMessage({ type: 'error', text: '請上傳有效的 CSV 或 TXT 檔案' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                // 智慧提取：利用正則表達式尋找所有可能是手機號碼的字串 (09xxxxxxxx 或 +8869xxxxxxxx 或 8869xxxxxxxx)
                const phoneRegex = /(?:\+?886|0)?9\d{8}/g;
                const matches = text.match(phoneRegex) || [];
                
                const validNumbers = [];
                let duplicates = 0;
                const uniqueSet = new Set();

                for (const num of matches) {
                    const formatted = formatPhoneNumber(num);
                    if (formatted) {
                        if (uniqueSet.has(formatted)) {
                            duplicates++;
                        } else {
                            uniqueSet.add(formatted);
                            validNumbers.push(formatted);
                        }
                    }
                }

                if (validNumbers.length === 0) {
                    setMessage({ type: 'warning', text: '未在檔案中偵測到任何有效的手機號碼' });
                    return;
                }

                setImportedNumbers(validNumbers);
                setDuplicateCount(duplicates);
                setMessage({
                    type: 'success',
                    text: `成功解析 ${validNumbers.length} 筆有效號碼 (已過濾 ${duplicates} 筆重複/無效)`
                });
            } catch (err) {
                console.error(err);
                setMessage({ type: 'error', text: '檔案解析失敗，請確認檔案格式是否正確。' });
            }
        };
        reader.readAsText(file);
    };

    // 清除導入的號碼
    const clearImported = () => {
        setImportedNumbers([]);
        setDuplicateCount(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setMessage(null);
    };

    // 獲取最終收件人清單
    const getFinalRecipients = () => {
        if (importedNumbers.length > 0) {
            return importedNumbers;
        }
        return recipientInput
            .split(',')
            .map(num => formatPhoneNumber(num.trim()))
            .filter(Boolean);
    };

    // 簡訊字數與 Segment 計算
    const getSmsMetrics = () => {
        const length = smsBody.length;
        if (length === 0) return { chars: 0, segments: 0, cost: 0 };
        
        // MAAC 簡訊 Segment 規則 (含中文 70 字一段，英文/ASCII 160 字一段)
        const hasChinese = /[\u4e00-\u9fa5]/.test(smsBody);
        const limitPerSegment = hasChinese ? 70 : 160;
        
        let segments = 1;
        if (length > limitPerSegment) {
            // 超過第一段時，每段上限會稍微縮減 (中文變 67 字一段，英文變 153 字一段，這是簡訊協定標準)
            const splitLimit = hasChinese ? 67 : 153;
            segments = Math.ceil(length / splitLimit);
        }
        
        const costPerSegment = 0.78; // 每段 NT$ 0.78 元
        const totalNumbers = getFinalRecipients().length || 1;
        const totalCost = (segments * costPerSegment * totalNumbers).toFixed(2);

        return {
            chars: length,
            segments,
            cost: totalCost
        };
    };

    const metrics = getSmsMetrics();

    // 快速插入行銷警語
    const insertMarketingText = () => {
        const textToAppend = '【Hands】退訂回覆STOP';
        if (smsBody.includes(textToAppend)) return;
        setSmsBody(prev => prev ? `${prev} ${textToAppend}` : `【品牌行銷】活動優惠 ${textToAppend}`);
    };

    // 提交發送簡訊
    const handleSend = async (e) => {
        e.preventDefault();
        const recipients = getFinalRecipients();
        
        if (recipients.length === 0) {
            setMessage({ type: 'error', text: '請輸入或匯入至少一個收件人電話號碼' });
            return;
        }

        if (!smsBody) {
            setMessage({ type: 'error', text: '請輸入簡訊內容' });
            return;
        }

        setIsSending(true);
        setMessage(null);

        const requestData = {
            to: recipients,
            body: smsBody
        };

        if (sendType === 'scheduled') {
            if (!scheduledTime) {
                setMessage({ type: 'error', text: '請選擇預約發送的時間' });
                setIsSending(false);
                return;
            }
            // 轉換為 ISO 8601
            requestData.scheduled_at = new Date(scheduledTime).toISOString();
        }

        try {
            const res = await fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send',
                    apiKey: INTERNAL_API_KEY,
                    data: requestData
                })
            });

            const result = await res.json();

            if (res.ok) {
                setMessage({
                    type: 'success',
                    text: sendType === 'immediate'
                        ? '簡訊已成功發送至發送佇列'
                        : `預約簡訊已排程成功，發送時間為：${new Date(scheduledTime).toLocaleString()}`
                });
                // 清除輸入
                setRecipientInput('');
                setSmsBody('');
                clearImported();
                // 重新整理歷史紀錄
                setTimeout(fetchHistory, 1000);
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || '發送失敗，請檢查 API 額度或 NCC 規章。'
                });
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '連線後端 API 代理失敗，請稍後再試。' });
        } finally {
            setIsSending(false);
        }
    };

    // 歷史發送明細統計數據計算
    const getHistoryStats = () => {
        const total = history.length;
        const success = history.filter(item => item.status === 'delivered').length;
        const stopCount = history.filter(item => item.status === 'stop').length;
        const failedOnly = history.filter(item => item.status === 'failed').length;
        const failed = failedOnly + stopCount; // 失敗數量包含一般失敗與退訂攔截
        const processing = history.filter(item => item.status === 'sent' || item.status === 'queued').length;
        return { total, success, failed, stop: stopCount, failedOnly, processing };
    };

    const stats = getHistoryStats();

    // 狀態轉繁體中文顯示
    const translateStatus = (status) => {
        switch (status) {
            case 'delivered':
                return '成功送達';
            case 'failed':
                return '發送失敗';
            case 'sent':
                return '已傳送';
            case 'queued':
                return '等待發送';
            case 'stop':
                return '退訂攔截';
            default:
                return status;
        }
    };

    return (
        <div className="admin-page-content sms-admin-page">
            <div className="admin-content-header">
                <div className="title-area">
                    <h2 className="admin-content-title">SMS 簡訊發送平台</h2>
                    <p className="admin-content-subtitle">利用 MAAC Go 高階簡訊通道，進行會員通知與行銷群發。</p>
                </div>
                <div className="status-badges">
                    <div className="status-badge status-active">
                        <span className="badge-dot"></span>
                        MAAC 通道正常 (NCC合規)
                    </div>
                    {walletBalance !== null && (
                        <div className="status-badge balance-badge">
                            餘額估算: NT$ {walletBalance}
                        </div>
                    )}
                </div>
            </div>

            {/* 訊息提示 */}
            {message && (
                <div className={`converter-message converter-message-${message.type}`} style={{ margin: '0 0 1.5rem 0' }}>
                    {message.type === 'success' ? '成功: ' : message.type === 'warning' ? '警告: ' : '錯誤: '} {message.text}
                </div>
            )}

            <div className="sms-container-vertical">
                {/* 上方區塊：發送表單 */}
                <div className="sms-card form-card">
                    <h3 className="card-title">新增簡訊任務</h3>
                    
                    <form onSubmit={handleSend}>
                        {/* 收件人設定 */}
                        <div className="form-group">
                            <label className="form-label">
                                1. 收件人電話號碼
                                {importedNumbers.length > 0 && (
                                    <span className="import-status-text"> (已載入匯入名單)</span>
                                )}
                            </label>
                            
                            {importedNumbers.length === 0 ? (
                                <textarea
                                    className="admin-input sms-textarea"
                                    placeholder="輸入電話號碼，多筆請用逗號隔開 (例: 0912345678, 0923456789)"
                                    value={recipientInput}
                                    onChange={(e) => setRecipientInput(e.target.value)}
                                    rows="3"
                                />
                            ) : (
                                <div className="imported-preview-box">
                                    <div className="imported-info-row">
                                        <span className="imported-count">已載入 {importedNumbers.length} 筆號碼</span>
                                        <button type="button" className="clear-import-btn" onClick={clearImported}>清除匯入</button>
                                    </div>
                                    <div className="imported-chips">
                                        {importedNumbers.slice(0, 15).map((num, i) => (
                                            <span key={i} className="phone-chip">{num}</span>
                                        ))}
                                        {importedNumbers.length > 15 && <span className="phone-chip more-chip">+{importedNumbers.length - 15} 筆...</span>}
                                    </div>
                                </div>
                            )}

                            {/* CSV 拖曳上傳 */}
                            {recipientInput.length === 0 && importedNumbers.length === 0 && (
                                <div 
                                    className={`sms-upload-zone ${dragOver ? 'drag-over' : ''}`}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                                    onClick={() => fileInputRef.current.click()}
                                >
                                    <input 
                                        ref={fileInputRef} 
                                        type="file" 
                                        accept=".csv,.txt" 
                                        onChange={(e) => handleFiles(e.target.files)} 
                                        style={{ display: 'none' }} 
                                    />
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span>拖曳或點選上傳 CSV / TXT 匯入號碼</span>
                                </div>
                            )}
                        </div>

                        {/* 簡訊內容 */}
                        <div className="form-group">
                            <div className="label-with-action">
                                <label className="form-label">2. 簡訊內容</label>
                                <button type="button" className="text-action-btn" onClick={insertMarketingText}>
                                    插入 NCC 行銷警語
                                </button>
                            </div>
                            <textarea
                                className="admin-input sms-textarea"
                                placeholder="輸入簡訊內容... (行銷簡訊必須包含【品牌】抬頭與「退訂回覆STOP」)"
                                value={smsBody}
                                onChange={(e) => setSmsBody(e.target.value)}
                                rows="4"
                                maxLength="1000"
                            />
                            {/* 即時字數計算與成本估計 */}
                            {smsBody && (
                                <div className="sms-metrics-panel">
                                    <div className="metric-item">
                                        字數: <strong>{metrics.chars}</strong> 字
                                    </div>
                                    <div className="metric-item">
                                        計費段數: <strong>{metrics.segments}</strong> 段
                                    </div>
                                    <div className="metric-item highlight-metric">
                                        預估費用: <strong>NT$ {metrics.cost}</strong>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 發送時間 */}
                        <div className="form-group text-left">
                            <label className="form-label">3. 發送時間</label>
                            <div className="send-type-toggle">
                                <button
                                    type="button"
                                    className={`toggle-btn ${sendType === 'immediate' ? 'active' : ''}`}
                                    onClick={() => setSendType('immediate')}
                                >
                                    立即發送
                                </button>
                                <button
                                    type="button"
                                    className={`toggle-btn ${sendType === 'scheduled' ? 'active' : ''}`}
                                    onClick={() => setSendType('scheduled')}
                                >
                                    預約發送 (排程)
                                </button>
                            </div>

                            {sendType === 'scheduled' && (
                                <div className="datetime-picker-container">
                                    <input
                                        type="datetime-local"
                                        className="admin-input datetime-input"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        min={new Date(Date.now() + 600000).toISOString().slice(0, 16)} // 限制預約最快 10 分鐘後
                                    />
                                    <p className="helper-text">* 根據 NCC 規範，預約發送時間建議為每日 09:00 - 20:00 間，以防干擾會員。</p>
                                </div>
                            )}
                        </div>

                        {/* 提交按鈕 */}
                        <button type="submit" disabled={isSending} className="btn btn-primary w-full send-action-btn">
                            {isSending ? (
                                <span className="loading-spinner"></span>
                            ) : sendType === 'immediate' ? (
                                '立即發送簡訊'
                            ) : (
                                '排程預約發送'
                            )}
                        </button>
                    </form>
                </div>

                {/* 下方區塊：發送歷史與統計 */}
                <div className="sms-card history-card" style={{ marginTop: '1.5rem' }}>
                    <div className="card-header-row">
                        <h3 className="card-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>發送歷史明細 (最近50筆)</h3>
                        <button onClick={fetchHistory} disabled={isLoadingHistory} className="refresh-btn">
                            {isLoadingHistory ? '整理中...' : '重新整理'}
                        </button>
                    </div>

                    {/* 數據統計儀表板 */}
                    {history.length > 0 && (
                        <div className="stats-dashboard">
                            <div className="stat-card">
                                <div className="stat-label">傳送數量</div>
                                <div className="stat-value">{stats.total}</div>
                                <div className="stat-desc">已提交至簡訊通道的總筆數</div>
                            </div>
                            <div className="stat-card stat-card-success">
                                <div className="stat-label">成功數量</div>
                                <div className="stat-value">{stats.success}</div>
                                <div className="stat-desc">已成功送達收件人手機</div>
                            </div>
                            <div className="stat-card stat-card-failed">
                                <div className="stat-label">失敗數量</div>
                                <div className="stat-value">{stats.failed}</div>
                                <div className="stat-desc">
                                    發送失敗或退訂攔截的筆數
                                    {stats.stop > 0 && <span className="stat-sub-desc"> (含 {stats.stop} 筆退訂)</span>}
                                </div>
                            </div>
                            {stats.processing > 0 && (
                                <div className="stat-card stat-card-processing">
                                    <div className="stat-label">傳送中</div>
                                    <div className="stat-value">{stats.processing}</div>
                                    <div className="stat-desc">正在發送佇列中處理</div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="history-table-container">
                        {history.length === 0 ? (
                            <div className="empty-history">
                                {isLoadingHistory ? '正在載入歷史明細...' : '尚無簡訊發送紀錄'}
                            </div>
                        ) : (
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>收件人</th>
                                        <th>簡訊內容</th>
                                        <th>送達狀態</th>
                                        <th>發送時間</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((item, idx) => (
                                        <tr key={item.id || idx}>
                                            <td className="cell-phone">{item.to}</td>
                                            <td className="cell-body" title={item.body}>{item.body}</td>
                                            <td>
                                                <span className={`status-badge-row status-${item.status}`}>
                                                    {translateStatus(item.status)}
                                                </span>
                                            </td>
                                            <td className="cell-time">
                                                {item.sent_at ? new Date(item.sent_at).toLocaleString() : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* 注入高質感日系簡約風格 CSS 樣式 */}
            <style dangerouslySetInnerHTML={{ __html: `
                .sms-admin-page {
                    font-family: var(--font);
                }
                .admin-content-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .status-badges {
                    display: flex;
                    gap: 0.75rem;
                }
                .status-badge {
                    display: flex;
                    align-items: center;
                    background: #fff;
                    border: 1px solid var(--border);
                    padding: 0.5rem 0.85rem;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--text);
                }
                .status-active {
                    border-color: #d9f7be;
                    background: #f6ffed;
                    color: #389e0d;
                }
                .badge-dot {
                    width: 6px;
                    height: 6px;
                    background: #52c41a;
                    border-radius: 50%;
                    margin-right: 6px;
                    display: inline-block;
                }
                .balance-badge {
                    background: #e6f4ec;
                    border-color: #a3d8be;
                    color: var(--brand);
                    font-weight: 600;
                }
                .sms-container-vertical {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    width: 100%;
                }
                .sms-card {
                    background: #fff;
                    border: 1px solid var(--border-light);
                    border-radius: 12px;
                    padding: 1.75rem;
                    box-shadow: var(--shadow-sm);
                    width: 100%;
                }
                .card-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text);
                    margin-bottom: 1.5rem;
                    border-bottom: 1px solid var(--border-light);
                    padding-bottom: 0.75rem;
                }
                .form-group {
                    margin-bottom: 1.5rem;
                }
                .form-label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                    font-size: 0.9rem;
                    color: var(--text);
                }
                .label-with-action {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .label-with-action .form-label {
                    margin-bottom: 0;
                }
                .text-action-btn {
                    background: none;
                    border: none;
                    color: var(--brand);
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 0;
                }
                .text-action-btn:hover {
                    color: var(--brand-dark);
                    text-decoration: underline;
                }
                .sms-textarea {
                    width: 100%;
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    padding: 0.75rem;
                    font-family: inherit;
                    font-size: 0.95rem;
                    background: #Fafafa;
                    resize: vertical;
                }
                .sms-textarea:focus {
                    outline: none;
                    border-color: var(--brand);
                    background: #fff;
                }
                .sms-upload-zone {
                    margin-top: 0.75rem;
                    border: 2px dashed var(--border);
                    border-radius: var(--radius);
                    padding: 1rem;
                    text-align: center;
                    cursor: pointer;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                }
                .sms-upload-zone:hover, .sms-upload-zone.drag-over {
                    border-color: var(--brand);
                    background: var(--brand-light);
                    color: var(--brand);
                }
                .upload-icon {
                    stroke: var(--text-secondary);
                }
                .sms-upload-zone:hover .upload-icon {
                    stroke: var(--brand);
                }
                .imported-preview-box {
                    background: var(--bg-gray);
                    border: 1px dashed var(--brand);
                    border-radius: var(--radius);
                    padding: 1rem;
                }
                .imported-info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }
                .imported-count {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--brand);
                }
                .clear-import-btn {
                    background: none;
                    border: none;
                    color: #ff4d4f;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                }
                .clear-import-btn:hover {
                    text-decoration: underline;
                }
                .imported-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .phone-chip {
                    background: #fff;
                    border: 1px solid var(--border);
                    border-radius: 4px;
                    padding: 0.2rem 0.5rem;
                    font-size: 0.8rem;
                    color: var(--text);
                }
                .more-chip {
                    background: var(--brand);
                    color: #fff;
                    border-color: var(--brand);
                    font-weight: 600;
                }
                .import-status-text {
                    color: var(--brand);
                    font-weight: 600;
                }
                .sms-metrics-panel {
                    display: flex;
                    justify-content: space-between;
                    background: var(--bg-gray);
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    padding: 0.75rem 1rem;
                    margin-top: 0.75rem;
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }
                .metric-item strong {
                    color: var(--text);
                    font-size: 0.95rem;
                }
                .highlight-metric {
                    color: var(--brand);
                }
                .highlight-metric strong {
                    color: var(--brand);
                    font-size: 1rem;
                }
                .send-type-toggle {
                    display: flex;
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    overflow: hidden;
                    margin-bottom: 0.75rem;
                }
                .toggle-btn {
                    flex: 1;
                    background: #fff;
                    border: none;
                    padding: 0.65rem;
                    font-size: 0.9rem;
                    cursor: pointer;
                    color: var(--text-secondary);
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .toggle-btn.active {
                    background: var(--brand);
                    color: #fff;
                    font-weight: 600;
                }
                .datetime-picker-container {
                    animation: fadeIn 0.2s ease;
                }
                .datetime-input {
                    width: 100%;
                    padding: 0.65rem;
                    font-size: 0.95rem;
                }
                .helper-text {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-top: 0.5rem;
                }
                .send-action-btn {
                    padding: 0.85rem;
                    font-size: 1rem;
                    font-weight: 600;
                    background: var(--brand);
                    border-color: var(--brand);
                }
                .send-action-btn:hover {
                    background: var(--brand-dark);
                    border-color: var(--brand-dark);
                }
                
                /* 歷史紀錄區樣式 */
                .header-title-group {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    flex-wrap: wrap;
                }
                .header-title-group .card-title {
                    margin-bottom: 0;
                    border-bottom: none;
                    padding-bottom: 0;
                }
                /* 數據統計儀表板 */
                .stats-dashboard {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                .stat-card {
                    background: var(--bg-gray);
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    padding: 1.25rem;
                    text-align: left;
                    transition: all 0.2s ease;
                }
                .stat-card:hover {
                    box-shadow: var(--shadow-sm);
                    transform: translateY(-2px);
                }
                .stat-label {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }
                .stat-value {
                    font-size: 1.75rem;
                    font-weight: 700;
                    color: var(--text);
                    line-height: 1.2;
                }
                .stat-desc {
                    font-size: 0.75rem;
                    color: var(--text-secondary);
                    margin-top: 0.5rem;
                }
                .stat-sub-desc {
                    color: #ff4d4f;
                    font-weight: 600;
                }
                .stat-card-success {
                    background: #f6ffed;
                    border-color: #d9f7be;
                }
                .stat-card-success .stat-label, .stat-card-success .stat-value {
                    color: #389e0d;
                }
                .stat-card-failed {
                    background: #fff1f0;
                    border-color: #ffa39e;
                }
                .stat-card-failed .stat-label, .stat-card-failed .stat-value {
                    color: #cf1322;
                }
                .stat-card-processing {
                    background: #e6f7ff;
                    border-color: #91d5ff;
                }
                .stat-card-processing .stat-label, .stat-card-processing .stat-value {
                    color: #096dd9;
                }
                
                .card-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    border-bottom: 1px solid var(--border-light);
                    padding-bottom: 0.75rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .refresh-btn {
                    background: none;
                    border: 1px solid var(--border);
                    border-radius: 4px;
                    padding: 0.35rem 0.75rem;
                    font-size: 0.8rem;
                    cursor: pointer;
                    color: var(--text);
                    transition: all 0.2s;
                }
                .refresh-btn:hover {
                    background: var(--bg-gray);
                    border-color: var(--text-secondary);
                }
                .history-table-container {
                    max-height: 520px;
                    overflow-y: auto;
                    width: 100%;
                }
                .empty-history {
                    text-align: center;
                    padding: 3rem;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                }
                .history-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.85rem;
                }
                .history-table th {
                    background: var(--bg-gray);
                    padding: 0.75rem;
                    font-weight: 600;
                    color: var(--text-secondary);
                    border-bottom: 1px solid var(--border);
                }
                .history-table td {
                    padding: 0.85rem 0.75rem;
                    border-bottom: 1px solid var(--border-light);
                    vertical-align: middle;
                }
                .cell-phone {
                    font-weight: 600;
                    color: var(--text);
                    white-space: nowrap;
                }
                .cell-body {
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #555;
                }
                .cell-time {
                    color: var(--text-secondary);
                    font-size: 0.8rem;
                    white-space: nowrap;
                }
                .status-badge-row {
                    display: inline-block;
                    padding: 0.25rem 0.6rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    white-space: nowrap;
                }
                .status-delivered {
                    background: #f6ffed;
                    border: 1px solid #b7eb8f;
                    color: #389e0d;
                }
                .status-sent, .status-queued {
                    background: #e6f7ff;
                    border: 1px solid #91d5ff;
                    color: #096dd9;
                }
                .status-failed {
                    background: #fff1f0;
                    border: 1px solid #ffa39e;
                    color: #cf1322;
                }
                .status-stop {
                    background: #fafafa;
                    border: 1px solid #d9d9d9;
                    color: rgba(0, 0, 0, 0.45);
                }
                .w-full {
                    width: 100%;
                }
            ` }} />
        </div>
    );
}

export default SmsAdminPage;
