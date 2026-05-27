import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

function SmsAdminPage() {
    // 格式化 Date 為本地 datetime-local 輸入框所需的 YYYY-MM-DDTHH:MM 格式
    const getLocalDatetimeString = (date) => {
        const tzoffset = date.getTimezoneOffset() * 60000;
        return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    };

    // 專案的內部 API KEY，用於安全校驗後端 API
    const INTERNAL_API_KEY = 'HANDSFORSTAFF2026';

    const [recipientInput, setRecipientInput] = useState('');
    const [importedNumbers, setImportedNumbers] = useState([]);
    const [duplicateCount, setDuplicateCount] = useState(0);
    const [smsBody, setSmsBody] = useState('');
    const [sendType, setSendType] = useState('immediate'); // 'immediate' 或 'scheduled'
    const [scheduledTime, setScheduledTime] = useState(() => {
        return getLocalDatetimeString(new Date(Date.now() + 600000));
    });
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [expandedHistoryId, setExpandedHistoryId] = useState(null);
    const [pendingSend, setPendingSend] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    // const [walletBalance, setWalletBalance] = useState(null); // 已移除餘額顯示

    // Excel/CSV 欄位對齊狀態
    const [excelHeaders, setExcelHeaders] = useState([]);
    const [excelRows, setExcelRows] = useState([]);
    const [columnMapping, setColumnMapping] = useState({ phone: '', name: '', points: '' });

    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

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
            } else {
                console.error('無法載入歷史紀錄:', data?.error);
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
        let cleaned = String(num).replace(/\D/g, '');
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

    // 動態更新有效號碼列表
    const updateImportedNumbersFromMapping = (rows, headers, mapping) => {
        if (!mapping.phone) {
            setImportedNumbers([]);
            setDuplicateCount(0);
            return;
        }

        const phoneIdx = headers.indexOf(mapping.phone);
        if (phoneIdx === -1) {
            setImportedNumbers([]);
            setDuplicateCount(0);
            return;
        }

        const validNumbers = [];
        let duplicates = 0;
        const uniqueSet = new Set();

        rows.forEach(row => {
            const rawPhone = row[phoneIdx];
            if (rawPhone !== undefined && rawPhone !== null) {
                const formatted = formatPhoneNumber(String(rawPhone));
                if (formatted) {
                    if (uniqueSet.has(formatted)) {
                        duplicates++;
                    } else {
                        uniqueSet.add(formatted);
                        validNumbers.push(formatted);
                    }
                }
            }
        });

        setImportedNumbers(validNumbers);
        setDuplicateCount(duplicates);
    };

    // 處理 Excel/CSV/TXT 檔案導入
    const handleFiles = (files) => {
        const file = files[0];
        if (!file) return;

        if (!file.name.match(/\.(xlsx|xls|csv|txt)$/i)) {
            setMessage({ type: 'error', text: '請上傳有效的 Excel (.xlsx, .xls) 或 CSV, TXT 檔案' });
            return;
        }

        const reader = new FileReader();

        if (file.name.match(/\.txt$/i)) {
            // TXT 檔案智慧提取
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
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
                    setExcelHeaders([]);
                    setExcelRows([]);
                    setColumnMapping({ phone: '', name: '', points: '' });
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
        } else {
            // Excel & CSV 檔案使用 XLSX 解析
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // 取得二維陣列 (含 header)
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    if (jsonData.length === 0) {
                        setMessage({ type: 'error', text: '工作表內容為空' });
                        return;
                    }

                    // 第一列作為 Header 欄位
                    const headers = jsonData[0].map(h => String(h || '').trim()).filter(Boolean);

                    // 過濾掉完全空的資料行
                    const rows = jsonData.slice(1).filter(row =>
                        row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
                    );

                    if (rows.length === 0) {
                        setMessage({ type: 'error', text: '檔案中沒有任何有效的資料列' });
                        return;
                    }

                    setExcelHeaders(headers);
                    setExcelRows(rows);

                    // 自動智慧對齊
                    const phoneRegex = /電話|手機|號碼|to|phone|mobile|tel/i;
                    const nameRegex = /姓名|名稱|會員|name|member/i;
                    const pointsRegex = /點數|點|紅利|point|score/i;

                    let autoPhone = '';
                    let autoName = '';
                    let autoPoints = '';

                    headers.forEach(h => {
                        if (!autoPhone && phoneRegex.test(h)) autoPhone = h;
                        else if (!autoName && nameRegex.test(h)) autoName = h;
                        else if (!autoPoints && pointsRegex.test(h)) autoPoints = h;
                    });

                    // 若手機欄位沒有匹配，預設取第一欄
                    if (!autoPhone && headers.length > 0) {
                        autoPhone = headers[0];
                    }

                    const newMapping = {
                        phone: autoPhone,
                        name: autoName,
                        points: autoPoints
                    };
                    setColumnMapping(newMapping);
                    updateImportedNumbersFromMapping(rows, headers, newMapping);

                    setMessage({
                        type: 'success',
                        text: `成功匯入 Excel/CSV 檔案，共 ${rows.length} 筆資料。欄位已自動對齊設定。`
                    });

                } catch (err) {
                    console.error(err);
                    setMessage({ type: 'error', text: 'Excel/CSV 檔案解析失敗，請確認檔案格式是否正確。' });
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };

    // 清除導入的號碼
    const clearImported = () => {
        setImportedNumbers([]);
        setDuplicateCount(0);
        setExcelHeaders([]);
        setExcelRows([]);
        setColumnMapping({ phone: '', name: '', points: '' });
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

    // 簡訊字數與計費估計
    const getSmsMetrics = () => {
        const length = smsBody.length;
        if (length === 0) return { chars: 0, segments: 0, cost: '0.00', isPersonalized: false };

        // 判斷是否啟用了個性化發送 (且內文包含 {{姓名}} 或 {{點數}}，並有 Excel 對齊)
        const isPersonalizedActive = (smsBody.includes('{{姓名}}') || smsBody.includes('{{點數}}')) && excelRows.length > 0 && columnMapping.phone;

        if (isPersonalizedActive) {
            let totalSegments = 0;
            let totalChars = 0;
            const phoneIdx = excelHeaders.indexOf(columnMapping.phone);
            const nameIdx = columnMapping.name ? excelHeaders.indexOf(columnMapping.name) : -1;
            const pointsIdx = columnMapping.points ? excelHeaders.indexOf(columnMapping.points) : -1;

            // 遍歷所有有效資料 (限制前 100 筆)
            const listToEstimate = excelRows.filter(row => {
                const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : '';
                return formatPhoneNumber(String(rawPhone)) !== null;
            }).slice(0, 100);

            listToEstimate.forEach(row => {
                const nameVal = nameIdx !== -1 ? String(row[nameIdx] || '') : '';
                const pointsVal = pointsIdx !== -1 ? String(row[pointsIdx] || '') : '';

                const replacedBody = smsBody
                    .replace(/{{姓名}}/g, nameVal)
                    .replace(/{{點數}}/g, pointsVal);

                const rowLen = replacedBody.length;
                const hasChinese = /[\u4e00-\u9fa5]/.test(replacedBody);
                const limitPerSegment = hasChinese ? 70 : 160;

                let segments = 1;
                if (rowLen > limitPerSegment) {
                    const splitLimit = hasChinese ? 67 : 153;
                    segments = Math.ceil(rowLen / splitLimit);
                }
                totalSegments += segments;
                totalChars += rowLen;
            });

            const avgChars = listToEstimate.length > 0 ? Math.round(totalChars / listToEstimate.length) : 0;
            const costPerSegment = 0.78;
            const totalCost = (totalSegments * costPerSegment).toFixed(2);

            return {
                chars: avgChars,
                segments: totalSegments,
                cost: totalCost,
                isPersonalized: true,
                totalCount: listToEstimate.length
            };
        } else {
            // 普通發送估算
            const hasChinese = /[\u4e00-\u9fa5]/.test(smsBody);
            const limitPerSegment = hasChinese ? 70 : 160;

            let segments = 1;
            if (length > limitPerSegment) {
                const splitLimit = hasChinese ? 67 : 153;
                segments = Math.ceil(length / splitLimit);
            }

            const costPerSegment = 0.78;
            const totalNumbers = getFinalRecipients().length || 1;
            const totalCost = (segments * costPerSegment * totalNumbers).toFixed(2);

            return {
                chars: length,
                segments: segments * totalNumbers,
                cost: totalCost,
                isPersonalized: false,
                singleSegments: segments
            };
        }
    };

    const metrics = getSmsMetrics();

    // 快速插入行銷警語
    const insertMarketingText = () => {
        const textToInsert = '【台隆手創館】';
        const textarea = textareaRef.current;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const newText = text.substring(0, start) + textToInsert + text.substring(end);
            setSmsBody(newText);
            setTimeout(() => {
                textarea.focus();
                const cursor = start + textToInsert.length;
                textarea.setSelectionRange(cursor, cursor);
            }, 0);
        } else {
            setSmsBody(prev => prev ? `${textToInsert}${prev}` : textToInsert);
        }
    };

    // 在游標處插入個性化變數
    const insertVariable = (variableName) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);

        const varText = `{{${variableName}}}`;
        const newText = before + varText + after;

        setSmsBody(newText);

        // 移動游標並重新 focus
        setTimeout(() => {
            textarea.focus();
            const cursorPosition = start + varText.length;
            textarea.setSelectionRange(cursorPosition, cursorPosition);
        }, 0);
    };

    // 提交發送簡訊 (改用自訂網頁彈窗確認)
    const handleSend = (e) => {
        e.preventDefault();

        const isPersonalizedActive = (smsBody.includes('{{姓名}}') || smsBody.includes('{{點數}}')) && excelRows.length > 0 && columnMapping.phone;

        let requestData = {};
        let recipientsCount = 0;

        if (isPersonalizedActive) {
            // 個性化變數發送模式
            const phoneIdx = excelHeaders.indexOf(columnMapping.phone);
            const nameIdx = columnMapping.name ? excelHeaders.indexOf(columnMapping.name) : -1;
            const pointsIdx = columnMapping.points ? excelHeaders.indexOf(columnMapping.points) : -1;

            const pRecipients = excelRows.map(row => {
                const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : '';
                const formatted = formatPhoneNumber(String(rawPhone));

                const nameVal = nameIdx !== -1 ? row[nameIdx] : '';
                const pointsVal = pointsIdx !== -1 ? row[pointsIdx] : '';

                return {
                    to: formatted,
                    variables: {
                        '姓名': nameVal !== undefined && nameVal !== null ? String(nameVal).trim() : '',
                        '點數': pointsVal !== undefined && pointsVal !== null ? String(pointsVal).trim() : ''
                    }
                };
            }).filter(r => r.to);

            if (pRecipients.length === 0) {
                setMessage({ type: 'error', text: '請上傳並選擇含有有效手機欄位的名單檔案' });
                return;
            }

            if (pRecipients.length > 100) {
                setMessage({ type: 'warning', text: '個性化簡訊單次發送限制最高 100 筆，系統已自動截取前 100 筆。' });
            }

            requestData = {
                isPersonalized: true,
                template: smsBody,
                recipients: pRecipients.slice(0, 100)
            };
            if (sendType === 'scheduled') {
                if (!scheduledTime) {
                    setMessage({ type: 'error', text: '請選擇預約發送的時間' });
                    return;
                }
                requestData.scheduled_at = new Date(scheduledTime).toISOString();
            }
            recipientsCount = Math.min(pRecipients.length, 100);

        } else {
            // 普通發送模式 (單筆或群發)
            const recipients = getFinalRecipients();

            if (recipients.length === 0) {
                setMessage({ type: 'error', text: '請輸入或匯入至少一個收件人電話號碼' });
                return;
            }

            if (!smsBody) {
                setMessage({ type: 'error', text: '請輸入簡訊內容' });
                return;
            }

            requestData = {
                to: recipients,
                body: smsBody
            };

            if (sendType === 'scheduled') {
                if (!scheduledTime) {
                    setMessage({ type: 'error', text: '請選擇預約發送的時間' });
                    return;
                }
                requestData.scheduled_at = new Date(scheduledTime).toISOString();
            }
            recipientsCount = recipients.length;
        }

        // 開啟自訂確認彈窗
        setPendingSend({ requestData, recipientsCount });
        setIsConfirmOpen(true);
    };

    // 真正執行發送的 API 呼叫
    const executeSend = async () => {
        if (!pendingSend) return;
        const { requestData } = pendingSend;

        setIsConfirmOpen(false);
        setIsSending(true);
        setMessage(null);

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

            if (res.ok && (result.ok || result.success)) {
                const isPersonalizedActive = (smsBody.includes('{{姓名}}') || smsBody.includes('{{點數}}')) && excelRows.length > 0 && columnMapping.phone;
                
                if (isPersonalizedActive) {
                    setMessage({
                        type: 'success',
                        text: `個性化簡訊已成功發送！成功：${result.successCount} 筆，失敗：${result.failedCount} 筆。`
                    });
                } else {
                    setMessage({
                        type: 'success',
                        text: sendType === 'immediate'
                            ? '簡訊已成功發送至發送佇列'
                            : `預約簡訊已排程成功，發送時間為：${new Date(scheduledTime).toLocaleString()}`
                    });
                }

                // 清除輸入
                setRecipientInput('');
                setSmsBody('');
                clearImported();
                
                // 重新整理歷史紀錄
                setTimeout(fetchHistory, 1000);
            } else {
                setMessage({
                    type: 'error',
                    text: result.error || '發送失敗，請檢查 API 額度或密鑰。'
                });
            }
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '連線後端 API 代理失敗，請稍後再試。' });
        } finally {
            setIsSending(false);
            setPendingSend(null);
        }
    };


    // 歷史發送明細統計數據計算
    const getHistoryStats = () => {
        const total = history.length;
        const success = history.filter(item => item.status === 'delivered').length;
        const stopCount = history.filter(item => item.status === 'stop').length;
        const failedOnly = history.filter(item => item.status === 'failed').length;
        const failed = failedOnly + stopCount;
        const processing = history.filter(item => item.status === 'sent' || item.status === 'queued' || item.status === 'reserved').length;
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
            case 'reserved':
                return '已預約排程';
            case 'stop':
                return '退訂攔截';
            default:
                return status;
        }
    };

    const toggleExpandHistory = (id) => {
        setExpandedHistoryId(prev => prev === id ? null : id);
    };

    const formatRecipients = (toStr) => {
        if (!toStr) return '-';
        const list = String(toStr).split(',').map(s => s.trim()).filter(Boolean);
        return (
            <div className="recipients-badges">
                {list.map((phone, i) => (
                    <span key={i} className="recipient-badge">{phone}</span>
                ))}
            </div>
        );
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
                </div>
            </div>

            {/* 訊息提示 */}
            {message && (
                <div className={`converter-message converter-message-${message.type} mb-5`}>
                    {message.type === 'success' ? '成功: ' : message.type === 'warning' ? '警告: ' : '錯誤: '} {message.text}
                </div>
            )}

            <div className="sms-container-grid">
                {/* 左邊欄：發送表單 */}
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
                                        {importedNumbers.slice(0, 10).map((num, i) => (
                                            <span key={i} className="phone-chip">{num}</span>
                                        ))}
                                        {importedNumbers.length > 10 && <span className="phone-chip more-chip">+{importedNumbers.length - 10} 筆...</span>}
                                    </div>
                                </div>
                            )}

                            {/* Excel / CSV / TXT 上傳 */}
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
                                        accept=".xlsx,.xls,.csv,.txt"
                                        onChange={(e) => handleFiles(e.target.files)}
                                        style={{ display: 'none' }}
                                    />
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span>匯入 Excel / CSV / TXT 名單</span>
                                </div>
                            )}

                            {/* 欄位對齊設定 UI 面板 */}
                            {excelHeaders.length > 0 && (
                                <div className="column-mapping-panel">
                                    <h4 className="mapping-title">Excel 欄位對齊設定</h4>
                                    <p className="mapping-subtitle">請映射表頭欄位，以利代入個性化變數。</p>
                                    <div className="mapping-grid">
                                        <div className="mapping-item">
                                            <label className="mapping-label">手機號碼 (必填)</label>
                                            <select
                                                className="mapping-select"
                                                value={columnMapping.phone}
                                                onChange={(e) => {
                                                    const newMapping = { ...columnMapping, phone: e.target.value };
                                                    setColumnMapping(newMapping);
                                                    updateImportedNumbersFromMapping(excelRows, excelHeaders, newMapping);
                                                }}
                                            >
                                                <option value="">-- 請選擇 --</option>
                                                {excelHeaders.map((h, i) => (
                                                    <option key={i} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="mapping-item">
                                            <label className="mapping-label">會員姓名 (選填)</label>
                                            <select
                                                className="mapping-select"
                                                value={columnMapping.name}
                                                onChange={(e) => {
                                                    setColumnMapping(prev => ({ ...prev, name: e.target.value }));
                                                }}
                                            >
                                                <option value="">-- 無 --</option>
                                                {excelHeaders.map((h, i) => (
                                                    <option key={i} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="mapping-item">
                                            <label className="mapping-label">點數 (選填)</label>
                                            <select
                                                className="mapping-select"
                                                value={columnMapping.points}
                                                onChange={(e) => {
                                                    setColumnMapping(prev => ({ ...prev, points: e.target.value }));
                                                }}
                                            >
                                                <option value="">-- 無 --</option>
                                                {excelHeaders.map((h, i) => (
                                                    <option key={i} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* 前 3 筆數據映射預覽 */}
                                    {columnMapping.phone && excelRows.length > 0 && (
                                        <div className="mapping-preview-section">
                                            <h5 className="preview-title">資料預覽 (前 3 筆)</h5>
                                            <div className="preview-table-wrapper">
                                                <table className="preview-table">
                                                    <thead>
                                                        <tr>
                                                            <th>姓名</th>
                                                            <th>手機</th>
                                                            <th>預覽內文</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {excelRows.slice(0, 3).map((row, idx) => {
                                                            const phoneIdx = excelHeaders.indexOf(columnMapping.phone);
                                                            const nameIdx = columnMapping.name ? excelHeaders.indexOf(columnMapping.name) : -1;
                                                            const pointsIdx = columnMapping.points ? excelHeaders.indexOf(columnMapping.points) : -1;

                                                            const phoneVal = phoneIdx !== -1 ? row[phoneIdx] : '';
                                                            const nameVal = nameIdx !== -1 ? row[nameIdx] : '';
                                                            const pointsVal = pointsIdx !== -1 ? row[pointsIdx] : '';

                                                            const formattedPhone = formatPhoneNumber(String(phoneVal)) || '格式錯誤';

                                                            let previewText = smsBody;
                                                            if (smsBody) {
                                                                previewText = previewText
                                                                    .replace(/{{姓名}}/g, nameVal !== undefined ? String(nameVal) : '')
                                                                    .replace(/{{點數}}/g, pointsVal !== undefined ? String(pointsVal) : '');
                                                            } else {
                                                                previewText = '(請輸入簡訊內容)';
                                                            }

                                                            return (
                                                                <tr key={idx}>
                                                                    <td>{nameVal !== undefined && nameVal !== null ? String(nameVal) : '-'}</td>
                                                                    <td>{formattedPhone}</td>
                                                                    <td className="cell-preview-body" title={previewText}>{previewText}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 簡訊內容 */}
                        <div className="form-group">
                            <div className="label-with-action">
                                <label className="form-label">2. 簡訊內容</label>
                            </div>
                            <div className="action-buttons-group mb-2">
                                <button type="button" className="text-action-btn" onClick={() => insertVariable('姓名')}>
                                    + 姓名變數
                                </button>
                                <button type="button" className="text-action-btn" onClick={() => insertVariable('點數')}>
                                    + 點數變數
                                </button>
                                <button type="button" className="text-action-btn text-action-btn-secondary" onClick={insertMarketingText}>
                                    + NCC行銷警語
                                </button>
                            </div>
                            <textarea
                                ref={textareaRef}
                                className="admin-input sms-textarea"
                                placeholder="請在此輸入簡訊內容，可代入上方變數做個人化群發。"
                                value={smsBody}
                                onChange={(e) => setSmsBody(e.target.value)}
                                rows="5"
                                maxLength="1000"
                            />
                            {/* 即時字數計算與成本估計 */}
                            {smsBody && (
                                <div className="sms-metrics-panel">
                                    {metrics.isPersonalized ? (
                                        <>
                                            <div className="metric-row">
                                                <span>模式：</span>
                                                <span className="badge-personalized">個性化簡訊</span>
                                            </div>
                                            <div className="metric-grid-2">
                                                <div className="metric-item">平均字數: <strong>{metrics.chars}</strong> 字</div>
                                                <div className="metric-item">發送名單: <strong>{metrics.totalCount}</strong> 人</div>
                                                <div className="metric-item">總段數: <strong>{metrics.segments}</strong> 段</div>
                                                <div className="metric-item highlight-metric">預估費用: <strong>NT$ {metrics.cost}</strong></div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="metric-grid-2">
                                                <div className="metric-item">字數: <strong>{metrics.chars}</strong> 字</div>
                                                <div className="metric-item">單筆計費段數: <strong>{metrics.singleSegments}</strong> 段</div>
                                                <div className="metric-item">收件人: <strong>{getFinalRecipients().length}</strong> 人</div>
                                                <div className="metric-item highlight-metric">預估總費用: <strong>NT$ {metrics.cost}</strong></div>
                                            </div>
                                        </>
                                    )}
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
                                    預約發送
                                </button>
                            </div>

                            {sendType === 'scheduled' && (
                                <div className="datetime-picker-container">
                                    <input
                                        type="datetime-local"
                                        className="admin-input datetime-input"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        min={getLocalDatetimeString(new Date())}
                                    />
                                    <p className="helper-text">* 建議預約於每日 09:00 - 20:00，避免干擾會員。</p>
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

                {/* 右邊欄：數據統計與發送歷史 */}
                <div className="sms-right-column">
                    {/* 數據統計儀表板 */}
                    {history.length > 0 && (
                        <div className="stats-dashboard">
                            <div className="stat-card">
                                <div className="stat-label">傳送數量</div>
                                <div className="stat-value">{stats.total}</div>
                                <div className="stat-desc">總筆數</div>
                            </div>
                            <div className="stat-card stat-card-success">
                                <div className="stat-label">成功數量</div>
                                <div className="stat-value">{stats.success}</div>
                                <div className="stat-desc">已送達</div>
                            </div>
                            <div className="stat-card stat-card-failed">
                                <div className="stat-label">失敗/退訂</div>
                                <div className="stat-value">{stats.failed}</div>
                                <div className="stat-desc">
                                    失敗 {stats.failedOnly} | 退訂 {stats.stop}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 歷史明細卡片 */}
                    <div className="sms-card history-card">
                        <div className="card-header-row">
                            <h3 className="card-title">發送歷史明細 (最近50筆)</h3>
                            <button onClick={fetchHistory} disabled={isLoadingHistory} className="refresh-btn">
                                {isLoadingHistory ? '整理中...' : '重新整理'}
                            </button>
                        </div>

                        <div className="history-table-container admin-table-wrap">
                            {history.length === 0 ? (
                                <div className="empty-history">
                                    {isLoadingHistory ? '正在載入歷史明細...' : '尚無簡訊發送紀錄'}
                                </div>
                            ) : (
                                <table className="admin-table history-table">
                                    <thead>
                                        <tr>
                                            <th>收件人</th>
                                            <th>簡訊內容</th>
                                            <th>送達狀態</th>
                                            <th>發送時間</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((item, idx) => {
                                            const itemId = item.id || `idx-${idx}`;
                                            const isExpanded = expandedHistoryId === itemId;
                                            return (
                                                <React.Fragment key={itemId}>
                                                    <tr
                                                        className={`history-row ${isExpanded ? 'is-expanded' : ''}`}
                                                        onClick={() => toggleExpandHistory(itemId)}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <td className="cell-phone">{item.to_phone || item.to}</td>
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
                                                    {isExpanded && (
                                                        <tr className="history-detail-row">
                                                            <td colSpan="4" className="history-detail-cell" onClick={e => e.stopPropagation()}>
                                                                <div className="history-detail-content">
                                                                    <div className="detail-item">
                                                                        <strong>完整收件人 ({String(item.to_phone || item.to).split(',').filter(Boolean).length} 筆)：</strong>
                                                                        <div className="detail-value">
                                                                            {formatRecipients(item.to_phone || item.to)}
                                                                        </div>
                                                                    </div>
                                                                    <div className="detail-item">
                                                                        <strong>完整簡訊內容：</strong>
                                                                        <div className="detail-value sms-body-full">
                                                                            {item.body}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* 1. 二次確認彈窗 */}
            {isConfirmOpen && pendingSend && (
                <div className="modal-overlay">
                    <div className="confirm-modal">
                        <div className="modal-header">
                            <h4 className="modal-title">確認發送簡訊</h4>
                        </div>
                        <div className="modal-body">
                            <div className="info-item">
                                <div className="info-label">發送模式</div>
                                <div className="info-value" style={{ color: sendType === 'scheduled' ? '#d76e00' : '#0071e3' }}>
                                    {sendType === 'scheduled' ? '預約排程發送' : '立即發送'}
                                </div>
                            </div>
                            {sendType === 'scheduled' && (
                                <div className="info-item">
                                    <div className="info-label">排程發送時間</div>
                                    <div className="info-value">{new Date(scheduledTime).toLocaleString()}</div>
                                </div>
                            )}
                            <div className="info-item">
                                <div className="info-label">收件人數</div>
                                <div className="info-value">{pendingSend.recipientsCount} 人</div>
                            </div>
                            <div className="info-item">
                                <div className="info-label">簡訊文案預覽</div>
                                <div className="sms-preview-card">{smsBody}</div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn-modal-cancel" onClick={() => { setIsConfirmOpen(false); setPendingSend(null); }}>
                                取消
                            </button>
                            <button type="button" className="btn-modal-confirm" onClick={executeSend}>
                                確定送出
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Apple 亮藍簡約風格 CSS 樣式 */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .sms-admin-page {
                    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
                    letter-spacing: -0.01em;
                }
                
                /* 自訂確認與說明彈窗樣式 */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(5px);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    animation: fadeIn 0.2s ease-out;
                }

                .confirm-modal {
                    background: rgba(255, 255, 255, 0.95);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 18px;
                    width: 90%;
                    max-width: 500px;
                    padding: 24px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    color: #1d1d1f;
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .modal-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .modal-icon {
                    font-size: 1.5rem;
                    margin-right: 10px;
                }

                .modal-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    margin: 0;
                }

                .modal-body {
                    margin-bottom: 24px;
                    text-align: left;
                }

                .info-item {
                    margin-bottom: 12px;
                }

                .info-label {
                    font-size: 0.85rem;
                    color: #86868b;
                    margin-bottom: 4px;
                }

                .info-value {
                    font-size: 1rem;
                    font-weight: 600;
                }

                .sms-preview-card {
                    background: #f5f5f7;
                    border-radius: 12px;
                    padding: 14px;
                    font-size: 0.9rem;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    border: 1px solid #e8e8ed;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                .btn-modal-cancel {
                    background: #f5f5f7;
                    color: #1d1d1f;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-modal-cancel:hover {
                    background: #e8e8ed;
                }

                .btn-modal-confirm {
                    background: #0071e3;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-modal-confirm:hover {
                    background: #0077ed;
                }

                .btn-cancel-sms {
                    background: rgba(255, 59, 48, 0.08);
                    color: #ff3b30;
                    border: 1px solid rgba(255, 59, 48, 0.2);
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    display: inline-flex;
                    align-items: center;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-cancel-sms:hover {
                    background: rgba(255, 59, 48, 0.15);
                    border-color: rgba(255, 59, 48, 0.3);
                    box-shadow: 0 2px 8px rgba(255, 59, 48, 0.1);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .admin-content-subtitle {
                    font-size: 0.875rem;
                    color: #86868b;
                    margin-top: 0.35rem;
                }
                .status-badge {
                    display: flex;
                    align-items: center;
                    background: #ffffff;
                    border: 1px solid #d2d2d7;
                    padding: 6px 14px;
                    border-radius: 980px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #1d1d1f;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
                }
                .status-active {
                    background: rgba(52, 199, 89, 0.08);
                    border-color: rgba(52, 199, 89, 0.3);
                    color: #1a8f30;
                }
                .badge-dot {
                    width: 7px;
                    height: 7px;
                    background: #34c759;
                    border-radius: 50%;
                    margin-right: 8px;
                    display: inline-block;
                    box-shadow: 0 0 4px #34c759;
                }
                
                /* 響應式左右雙欄 Grid */
                .sms-container-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 1.5rem;
                    width: 100%;
                    align-items: flex-start;
                    margin-top: 1.5rem;
                }

                @media (min-width: 1024px) {
                    .sms-container-grid {
                        grid-template-columns: 440px 1fr;
                    }
                }

                .sms-right-column {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .sms-card {
                    background: #ffffff;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    border-radius: 16px;
                    padding: 1.75rem;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.03);
                    transition: box-shadow 0.3s ease;
                }
                .sms-card:hover {
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
                }

                .card-title {
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin-top: 0;
                    margin-bottom: 1.25rem;
                    padding-bottom: 0.85rem;
                    border-bottom: 1px solid #f5f5f7;
                    text-align: left;
                }

                .form-group {
                    margin-bottom: 1.5rem;
                    text-align: left;
                }

                .form-label {
                    display: block;
                    font-weight: 600;
                    margin-bottom: 0.6rem;
                    font-size: 0.825rem;
                    color: #86868b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .label-with-action {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                /* Apple 質感膠囊按鈕 */
                .action-buttons-group {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .text-action-btn {
                    background-color: #f5f5f7;
                    border: 1px solid #d2d2d7;
                    color: #1d1d1f;
                    font-size: 0.775rem;
                    font-weight: 500;
                    cursor: pointer;
                    padding: 5px 12px;
                    border-radius: 980px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                }

                .text-action-btn:hover {
                    background-color: #0071e3;
                    border-color: #0071e3;
                    color: #ffffff;
                }

                .text-action-btn:active {
                    transform: scale(0.96);
                }

                .text-action-btn-secondary {
                    background-color: rgba(0, 113, 227, 0.05);
                    border-color: rgba(0, 113, 227, 0.15);
                    color: #0071e3;
                }

                .text-action-btn-secondary:hover {
                    background-color: #0071e3;
                    border-color: #0071e3;
                    color: #ffffff;
                }

                .sms-textarea {
                    width: 100%;
                    border: 1px solid #d2d2d7;
                    border-radius: 10px;
                    padding: 0.85rem;
                    font-family: inherit;
                    font-size: 0.9rem;
                    background: #f5f5f7;
                    resize: vertical;
                    outline: none;
                    transition: all 0.2s ease;
                    box-sizing: border-box;
                }

                .sms-textarea:focus {
                    border-color: #0071e3;
                    background: #ffffff;
                    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.18);
                }

                /* Apple 質感上傳區 */
                .sms-upload-zone {
                    margin-top: 0.75rem;
                    border: 1.5px dashed #c7c7cc;
                    border-radius: 12px;
                    padding: 1.25rem;
                    text-align: center;
                    cursor: pointer;
                    color: #86868b;
                    font-size: 0.825rem;
                    font-weight: 500;
                    transition: all 0.25s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #fafafa;
                }

                .sms-upload-zone:hover, .sms-upload-zone.drag-over {
                    border-color: #0071e3;
                    background: rgba(0, 113, 227, 0.03);
                    color: #0071e3;
                    transform: translateY(-1px);
                }

                .upload-icon {
                    stroke: #86868b;
                    transition: stroke 0.2s, transform 0.2s;
                }

                .sms-upload-zone:hover .upload-icon {
                    stroke: #0071e3;
                    transform: translateY(-2px);
                }

                .imported-preview-box {
                    background: rgba(0, 113, 227, 0.03);
                    border: 1px solid rgba(0, 113, 227, 0.12);
                    border-radius: 10px;
                    padding: 0.85rem 1.1rem;
                }

                .imported-info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.6rem;
                }

                .imported-count {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #0071e3;
                }

                .clear-import-btn {
                    background: none;
                    border: none;
                    color: #ff3b30;
                    font-size: 0.775rem;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 0;
                    transition: opacity 0.2s;
                }

                .clear-import-btn:hover {
                    opacity: 0.8;
                    text-decoration: underline;
                }

                .imported-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }

                .phone-chip {
                    background: #ffffff;
                    border: 1px solid #e5e5ea;
                    border-radius: 6px;
                    padding: 3px 8px;
                    font-size: 0.75rem;
                    color: #1d1d1f;
                    font-weight: 500;
                }

                .more-chip {
                    background: #0071e3;
                    color: #ffffff;
                    border-color: #0071e3;
                    font-weight: 600;
                }

                .import-status-text {
                    color: #0071e3;
                    font-weight: 600;
                }

                /* 發送估計資訊面板 */
                .sms-metrics-panel {
                    background: #f5f5f7;
                    border: 1px solid #e5e5ea;
                    border-radius: 10px;
                    padding: 0.85rem 1.1rem;
                    margin-top: 0.85rem;
                    font-size: 0.825rem;
                    color: #86868b;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    text-align: left;
                }

                .metric-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border-bottom: 1px dashed #e5e5ea;
                    padding-bottom: 6px;
                    margin-bottom: 2px;
                }

                .metric-grid-2 {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 6px;
                }

                .metric-item strong {
                    color: #1d1d1f;
                    font-size: 0.875rem;
                }

                .highlight-metric {
                    color: #0071e3;
                }

                .highlight-metric strong {
                    color: #0071e3;
                    font-size: 0.95rem;
                }

                .badge-personalized {
                    background: rgba(0, 113, 227, 0.08);
                    color: #0071e3;
                    border: 1px solid rgba(0, 113, 227, 0.15);
                    padding: 2px 8px;
                    border-radius: 980px;
                    font-weight: 600;
                    font-size: 0.725rem;
                }

                /* Apple Segmented Control */
                .send-type-toggle {
                    display: flex;
                    background: #f5f5f7;
                    border-radius: 10px;
                    padding: 2px;
                    margin-bottom: 0.85rem;
                    border: 1px solid #e5e5ea;
                }

                .toggle-btn {
                    flex: 1;
                    background: transparent;
                    border: none;
                    padding: 7px;
                    font-size: 0.85rem;
                    cursor: pointer;
                    color: #86868b;
                    font-weight: 500;
                    border-radius: 8px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    outline: none;
                }

                .toggle-btn.active {
                    background: #ffffff;
                    color: #1d1d1f;
                    font-weight: 600;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
                }

                .datetime-picker-container {
                    animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .datetime-input {
                    width: 100%;
                    padding: 10px;
                    font-size: 0.875rem;
                    border: 1px solid #d2d2d7;
                    background-color: #f5f5f7;
                    border-radius: 10px;
                    outline: none;
                    box-sizing: border-box;
                    transition: all 0.2s;
                }

                .datetime-input:focus {
                    border-color: #0071e3;
                    background-color: #ffffff;
                    box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
                }

                .helper-text {
                    font-size: 0.75rem;
                    color: #86868b;
                    margin-top: 6px;
                }

                .send-action-btn {
                    padding: 11px;
                    font-size: 0.95rem;
                    font-weight: 600;
                    background: linear-gradient(180deg, #3595ff 0%, #0071e3 100%);
                    border: 1px solid #0066d6;
                    border-radius: 10px;
                    color: #ffffff;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 2px 6px rgba(0, 113, 227, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                }

                .send-action-btn:hover {
                    background: linear-gradient(180deg, #4ca3ff 0%, #007df2 100%);
                    box-shadow: 0 4px 12px rgba(0, 113, 227, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.15);
                }

                .send-action-btn:active {
                    transform: scale(0.98);
                    box-shadow: 0 1px 3px rgba(0, 113, 227, 0.15);
                }

                .send-action-btn:disabled {
                    background: #e5e5ea;
                    border-color: #e5e5ea;
                    color: #aeaea2;
                    cursor: not-allowed;
                    box-shadow: none;
                }

                /* 欄位對齊面板 */
                .column-mapping-panel {
                    background: #f5f5f7;
                    border: 1px solid #e5e5ea;
                    border-radius: 10px;
                    padding: 1rem;
                    margin-top: 0.85rem;
                }

                .mapping-title {
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin: 0 0 2px 0;
                    text-align: left;
                }

                .mapping-subtitle {
                    font-size: 0.775rem;
                    color: #86868b;
                    margin: 0 0 0.85rem 0;
                    text-align: left;
                }

                .mapping-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-bottom: 0.85rem;
                }

                .mapping-item {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    text-align: left;
                }

                .mapping-label {
                    font-size: 0.75rem;
                    font-weight: 500;
                    color: #86868b;
                }

                .mapping-select {
                    padding: 7px;
                    font-size: 0.8rem;
                    border: 1px solid #cbd5e1;
                    background-color: #ffffff;
                    border-radius: 8px;
                    outline: none;
                    width: 100%;
                    transition: border-color 0.2s;
                }

                .mapping-select:focus {
                    border-color: #0071e3;
                }

                /* 映射預覽表格 */
                .mapping-preview-section {
                    border-top: 1px dashed #e5e5ea;
                    padding-top: 0.85rem;
                }

                .preview-title {
                    font-size: 0.775rem;
                    font-weight: 600;
                    color: #1d1d1f;
                    margin: 0 0 0.6rem 0;
                    text-align: left;
                }

                .preview-table-wrapper {
                    overflow-x: auto;
                    border-radius: 8px;
                    border: 1px solid #e5e5ea;
                }

                .preview-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.75rem;
                    text-align: left;
                    background-color: #ffffff;
                }

                .preview-table th {
                    background: #f5f5f7;
                    padding: 8px 10px;
                    font-weight: 600;
                    color: #86868b;
                    border-bottom: 1px solid #e5e5ea;
                }

                .preview-table td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #f5f5f7;
                    color: #1d1d1f;
                    white-space: nowrap;
                }

                .cell-preview-body {
                    max-width: 160px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #86868b;
                    font-style: italic;
                }

                /* 數據統計儀表板 */
                .stats-dashboard {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    width: 100%;
                }

                .stat-card {
                    background: #ffffff;
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    border-radius: 16px;
                    padding: 1.15rem;
                    text-align: left;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015);
                    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease;
                }

                .stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.03);
                }

                .stat-label {
                    font-size: 0.775rem;
                    color: #86868b;
                    font-weight: 600;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                .stat-value {
                    font-size: 1.65rem;
                    font-weight: 700;
                    color: #1d1d1f;
                    line-height: 1.1;
                }

                .stat-desc {
                    font-size: 0.725rem;
                    color: #86868b;
                    margin-top: 6px;
                }

                .stat-card-success {
                    background: rgba(52, 199, 89, 0.06);
                    border-color: rgba(52, 199, 89, 0.15);
                }

                .stat-card-success .stat-label, .stat-card-success .stat-value {
                    color: #1a8f30;
                }

                .stat-card-failed {
                    background: rgba(255, 59, 48, 0.06);
                    border-color: rgba(255, 59, 48, 0.15);
                }

                .stat-card-failed .stat-label, .stat-card-failed .stat-value {
                    color: #d7271e;
                }

                /* 歷史列表區 */
                .card-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.15rem;
                    border-bottom: 1px solid #f5f5f7;
                    padding-bottom: 0.85rem;
                }

                .card-header-row .card-title {
                    margin-bottom: 0 !important;
                    border-bottom: none !important;
                    padding-bottom: 0 !important;
                }

                .refresh-btn {
                    background: #f5f5f7;
                    border: 1px solid #d2d2d7;
                    border-radius: 8px;
                    padding: 5px 12px;
                    font-size: 0.775rem;
                    font-weight: 500;
                    color: #1d1d1f;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .refresh-btn:hover {
                    background: #e5e5ea;
                }

                .refresh-btn:active {
                    transform: scale(0.97);
                }

                .history-table-container {
                    max-height: 520px;
                    overflow-y: auto;
                    width: 100%;
                }

                .empty-history {
                    text-align: center;
                    padding: 3rem 1.5rem;
                    color: #86868b;
                    font-size: 0.85rem;
                }

                .history-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                    font-size: 0.8rem;
                }

                .history-table th {
                    background: #f5f5f7;
                    padding: 10px 12px;
                    font-weight: 600;
                    color: #86868b;
                    border-bottom: 1px solid #e5e5ea;
                }

                .history-table td {
                    padding: 12px 12px;
                    border-bottom: 1px solid #f5f5f7;
                    vertical-align: middle;
                }

                .history-table tbody tr {
                    transition: background-color 0.15s ease;
                }

                .history-table tbody tr:hover {
                    background-color: #fafafa;
                }

                .cell-phone {
                    font-weight: 600;
                    color: #1d1d1f;
                    white-space: nowrap;
                }

                .cell-body {
                    max-width: 220px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #424245;
                }

                .cell-time {
                    color: #86868b;
                    font-size: 0.75rem;
                    white-space: nowrap;
                }

                .status-badge-row {
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 980px;
                    font-size: 0.725rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .status-delivered {
                    background: rgba(52, 199, 89, 0.08);
                    color: #1a8f30;
                }

                .status-reserved {
                    background: rgba(255, 149, 0, 0.08);
                    color: #d76e00;
                }

                .status-sent, .status-queued {
                    background: rgba(0, 113, 227, 0.08);
                    color: #0071e3;
                }

                .status-failed {
                    background: rgba(255, 59, 48, 0.08);
                    color: #ff3b30;
                }

                .status-stop {
                    background: #f5f5f7;
                    color: #86868b;
                }

                .loading-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #ffffff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    display: inline-block;
                }
                
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .mb-2 { margin-bottom: 0.5rem; }
                .mb-5 { margin-bottom: 1.25rem; }
                .w-full { width: 100%; }

                /* 歷史詳情展開樣式 */
                .history-row.is-expanded {
                    background-color: #f5f5f7 !important;
                }
                .history-detail-row {
                    background-color: #fafafa;
                }
                .history-detail-cell {
                    padding: 16px 20px !important;
                    border-bottom: 1px solid #e5e5ea !important;
                }
                .history-detail-content {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    text-align: left;
                }
                .detail-item {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .detail-item strong {
                    font-size: 0.825rem;
                    color: #86868b;
                }
                .detail-value {
                    font-size: 0.875rem;
                    color: #1d1d1f;
                }
                .sms-body-full {
                    background: #ffffff;
                    border: 1px solid #d2d2d7;
                    border-radius: 8px;
                    padding: 10px 12px;
                    white-space: pre-wrap;
                    word-break: break-all;
                    line-height: 1.5;
                }
                .recipients-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    max-height: 120px;
                    overflow-y: auto;
                    padding: 6px;
                    background: #ffffff;
                    border: 1px solid #d2d2d7;
                    border-radius: 8px;
                }
                .recipient-badge {
                    background: #f5f5f7;
                    border: 1px solid #d2d2d7;
                    color: #1d1d1f;
                    font-size: 0.775rem;
                    font-weight: 500;
                    padding: 3px 10px;
                    border-radius: 980px;
                }
            ` }} />
        </div>
    );
}

export default SmsAdminPage;
