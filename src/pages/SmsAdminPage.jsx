import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';

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
        const textToInsert = '【HANDS台隆手創館】';
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

    // 提交發送簡訊
    const handleSend = async (e) => {
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

            if (res.ok && result.ok) {
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

                // (已移除餘額更新)

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
        }
    };

    // 歷史發送明細統計數據計算
    const getHistoryStats = () => {
        const total = history.length;
        const success = history.filter(item => item.status === 'delivered').length;
        const stopCount = history.filter(item => item.status === 'stop').length;
        const failedOnly = history.filter(item => item.status === 'failed').length;
        const failed = failedOnly + stopCount;
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
                </div>
            </div>

            {/* 已移除餘額看板 */}

            {/* 訊息提示 */}
            {message && (
                <div className={`converter-message converter-message-${message.type} mb-5`}>
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
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span>拖曳或點選上傳 Excel / CSV / TXT 匯入名單</span>
                                </div>
                            )}

                            {/* 欄位對齊設定 UI 面板 */}
                            {excelHeaders.length > 0 && (
                                <div className="column-mapping-panel">
                                    <h4 className="mapping-title">Excel/CSV 欄位對齊設定</h4>
                                    <p className="mapping-subtitle">請將匯入檔案的表頭與發送欄位進行映射，以利個性化變數代入。</p>
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
                                                <option value="">-- 請選擇對應欄位 --</option>
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
                                                <option value="">-- 不對齊 / 無 --</option>
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
                                                <option value="">-- 不對齊 / 無 --</option>
                                                {excelHeaders.map((h, i) => (
                                                    <option key={i} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* 前 3 筆數據映射預覽 */}
                                    {columnMapping.phone && excelRows.length > 0 && (
                                        <div className="mapping-preview-section">
                                            <h5 className="preview-title">名單資料映射預覽 (前 3 筆)</h5>
                                            <div className="preview-table-wrapper">
                                                <table className="preview-table">
                                                    <thead>
                                                        <tr>
                                                            <th>流水號</th>
                                                            <th>手機號碼 ({columnMapping.phone})</th>
                                                            <th>會員姓名 {columnMapping.name ? `(${columnMapping.name})` : '(未對齊)'}</th>
                                                            <th>點數 {columnMapping.points ? `(${columnMapping.points})` : '(未對齊)'}</th>
                                                            <th>簡訊預覽效果</th>
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

                                                            const formattedPhone = formatPhoneNumber(String(phoneVal)) || '格式不符';
                                                            
                                                            let previewText = smsBody;
                                                            if (smsBody) {
                                                                previewText = previewText
                                                                    .replace(/{{姓名}}/g, nameVal !== undefined ? String(nameVal) : '')
                                                                    .replace(/{{點數}}/g, pointsVal !== undefined ? String(pointsVal) : '');
                                                            } else {
                                                                previewText = '(未輸入簡訊內容)';
                                                            }

                                                            return (
                                                                <tr key={idx}>
                                                                    <td>{idx + 1}</td>
                                                                    <td className="cell-phone">{formattedPhone}</td>
                                                                    <td>{nameVal !== undefined && nameVal !== null ? String(nameVal) : '-'}</td>
                                                                    <td>{pointsVal !== undefined && pointsVal !== null ? String(pointsVal) : '-'}</td>
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
                                <div className="action-buttons-group">
                                    <button type="button" className="text-action-btn" onClick={() => insertVariable('姓名')}>
                                        插入姓名變數
                                    </button>
                                    <span className="btn-separator">|</span>
                                    <button type="button" className="text-action-btn" onClick={() => insertVariable('點數')}>
                                        插入點數變數
                                    </button>
                                    <span className="btn-separator">|</span>
                                    <button type="button" className="text-action-btn" onClick={insertMarketingText}>
                                        插入 NCC 行銷警語
                                    </button>
                                </div>
                            </div>
                            <textarea
                                ref={textareaRef}
                                className="admin-input sms-textarea"
                                placeholder="輸入簡訊內容... 點擊上方變數按鈕可於游標處插入 {{姓名}} 與 {{點數}}，系統發送時會為每位會員代入專屬內容。"
                                value={smsBody}
                                onChange={(e) => setSmsBody(e.target.value)}
                                rows="4"
                                maxLength="1000"
                            />
                            {/* 即時字數計算與成本估計 */}
                            {smsBody && (
                                <div className="sms-metrics-panel">
                                    {metrics.isPersonalized ? (
                                        <>
                                            <div className="metric-item">
                                                發送模式: <span className="badge-personalized">個性化變數簡訊</span>
                                            </div>
                                            <div className="metric-item">
                                                平均字數: <strong>{metrics.chars}</strong> 字
                                            </div>
                                            <div className="metric-item">
                                                發送名單: <strong>{metrics.totalCount}</strong> 人
                                            </div>
                                            <div className="metric-item">
                                                總計費段數: <strong>{metrics.segments}</strong> 段
                                            </div>
                                            <div className="metric-item highlight-metric">
                                                預估費用: <strong>NT$ {metrics.cost}</strong>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="metric-item">
                                                字數: <strong>{metrics.chars}</strong> 字
                                            </div>
                                            <div className="metric-item">
                                                單筆段數: <strong>{metrics.singleSegments}</strong> 段
                                            </div>
                                            <div className="metric-item">
                                                收件人: <strong>{getFinalRecipients().length}</strong> 人
                                            </div>
                                            <div className="metric-item">
                                                總計費段數: <strong>{metrics.segments}</strong> 段
                                            </div>
                                            <div className="metric-item highlight-metric">
                                                預估費用: <strong>NT$ {metrics.cost}</strong>
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
                <div className="sms-card history-card mt-5">
                    <div className="card-header-row">
                        <h3 className="card-title">發送歷史明細 (最近50筆)</h3>
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
                                    {history.map((item, idx) => (
                                        <tr key={item.id || idx}>
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
                    margin-bottom: 1.5rem;
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
                .action-buttons-group {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .btn-separator {
                    color: var(--border);
                    font-size: 0.8rem;
                    user-select: none;
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
                    padding: 1.25rem 1rem;
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
                    flex-wrap: wrap;
                    gap: 0.5rem;
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
                
                /* 精美錢包卡片樣式 */
                .wallet-balance-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: #ffffff;
                    border-radius: 12px;
                    padding: 1.25rem 1.5rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
                    transition: all 0.3s ease;
                }
                .wallet-balance-card:hover {
                    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
                    transform: translateY(-2px);
                }
                .wallet-card-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                .wallet-icon-wrapper {
                    background: rgba(255, 255, 255, 0.15);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .wallet-svg {
                    stroke: #ffffff;
                }
                .wallet-info-area {
                    display: flex;
                    flex-direction: column;
                    text-align: left;
                }
                .wallet-card-label {
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.8);
                    font-weight: 500;
                    margin-bottom: 0.15rem;
                }
                .wallet-card-value {
                    font-size: 1.6rem;
                    font-weight: 700;
                    letter-spacing: -0.5px;
                }
                .wallet-refresh-btn {
                    background: rgba(255, 255, 255, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    color: #ffffff;
                    padding: 0.45rem 0.75rem;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    transition: all 0.2s ease;
                }
                .wallet-refresh-btn:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.02);
                }
                .wallet-refresh-btn:active {
                    transform: scale(0.98);
                }
                .refresh-svg.spinning {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                /* 個性化徽章 */
                .badge-personalized {
                    background: #e0f2fe;
                    color: #0369a1;
                    border: 1px solid #bae6fd;
                    padding: 0.15rem 0.4rem;
                    border-radius: 4px;
                    font-weight: 600;
                    font-size: 0.8rem;
                }

                /* 欄位對齊面板 */
                .column-mapping-panel {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 1.25rem;
                    margin-top: 1rem;
                    animation: slideDown 0.3s ease;
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .mapping-title {
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0 0 0.25rem 0;
                    text-align: left;
                }
                .mapping-subtitle {
                    font-size: 0.8rem;
                    color: #64748b;
                    margin: 0 0 1rem 0;
                    text-align: left;
                }
                .mapping-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.25rem;
                }
                .mapping-item {
                    display: flex;
                    flex-direction: column;
                    gap: 0.35rem;
                    text-align: left;
                }
                .mapping-label {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #475569;
                }
                .mapping-select {
                    padding: 0.5rem;
                    font-size: 0.85rem;
                    border: 1px solid #cbd5e1;
                    background-color: #ffffff;
                    border-radius: 6px;
                    outline: none;
                    width: 100%;
                }
                .mapping-select:focus {
                    border-color: #10b981;
                }

                /* 映射預覽表格 */
                .mapping-preview-section {
                    border-top: 1px dashed #e2e8f0;
                    padding-top: 1rem;
                }
                .preview-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #334155;
                    margin: 0 0 0.75rem 0;
                    text-align: left;
                }
                .preview-table-wrapper {
                    overflow-x: auto;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                }
                .preview-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                    text-align: left;
                    background-color: #ffffff;
                }
                .preview-table th {
                    background: #f1f5f9;
                    padding: 0.6rem 0.75rem;
                    font-weight: 600;
                    color: #475569;
                    border-bottom: 1px solid #e2e8f0;
                }
                .preview-table td {
                    padding: 0.6rem 0.75rem;
                    border-bottom: 1px solid #f1f5f9;
                    color: #334155;
                    white-space: nowrap;
                }
                .cell-preview-body {
                    max-width: 250px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: #64748b;
                    font-style: italic;
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
                .card-header-row .card-title {
                    margin-bottom: 0 !important;
                    border-bottom: none !important;
                    padding-bottom: 0 !important;
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
