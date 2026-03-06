import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

const COLUMN_HEADERS = ['會員編號', '姓名', '手機號', '註冊日期', '卡數量', '卡餘額', '積分餘額', '主卡號', '卡類型', 'LINE ID'];
const CARD_TYPES = ['一般會員', 'VIP會員', 'VVIP會員'];

function DataConverterPage() {
    const [fileData, setFileData] = useState(null);       // 原始解析資料 (二維陣列)
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState([]);            // 預覽用 (前5筆)
    const [converting, setConverting] = useState(false);
    const [message, setMessage] = useState(null);          // 成功/錯誤訊息
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // ===== 檔案處理 =====
    function handleFile(file) {
        if (!file) return;
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            setMessage({ type: 'error', text: '請上傳 Excel 檔案 (.xlsx 或 .xls)' });
            return;
        }
        setMessage(null);
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'array' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

                if (data.length < 2) {
                    setMessage({ type: 'error', text: '檔案中沒有資料列' });
                    return;
                }

                setFileData(data);
                // 預覽：表頭 + 前5筆資料
                setPreview(data.slice(0, 6));
                setMessage({ type: 'success', text: `成功讀取 ${data.length - 1} 筆資料` });
            } catch (err) {
                console.error('讀取失敗:', err);
                setMessage({ type: 'error', text: '檔案解析失敗，請確認格式是否正確' });
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function handleDrop(e) {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        handleFile(file);
    }

    function handleDragOver(e) {
        e.preventDefault();
        setDragOver(true);
    }

    function handleDragLeave() {
        setDragOver(false);
    }

    function handleInputChange(e) {
        handleFile(e.target.files[0]);
    }

    function clearFile() {
        setFileData(null);
        setFileName('');
        setPreview([]);
        setMessage(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // ===== 轉換功能 =====

    // LINE推播：J欄(index=9)，無表頭
    function convertLINE() {
        if (!fileData) return;
        setConverting(true);
        try {
            const rows = fileData.slice(1).map(row => [row[9] || '']).filter(r => r[0] !== '');
            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'LINE推播');
            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'LINE推播.xlsx');
            setMessage({ type: 'success', text: 'LINE推播 檔案已下載！' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '轉換失敗' });
        } finally {
            setConverting(false);
        }
    }

    // SMS推播：C欄(index=2)，表頭為「電話號碼」
    function convertSMS() {
        if (!fileData) return;
        setConverting(true);
        try {
            const rows = [['電話號碼'], ...fileData.slice(1).map(row => [row[2] || '']).filter(r => r[0] !== '')];
            const ws = XLSX.utils.aoa_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'SMS推播');
            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'SMS推播.xlsx');
            setMessage({ type: 'success', text: 'SMS推播 檔案已下載！' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '轉換失敗' });
        } finally {
            setConverting(false);
        }
    }

    // 生日推播：依I欄(index=8)分組，取J欄(index=9)，無表頭，打包ZIP
    async function convertBirthday() {
        if (!fileData) return;
        setConverting(true);
        try {
            const dataRows = fileData.slice(1);
            const grouped = {};
            CARD_TYPES.forEach(t => { grouped[t] = []; });

            dataRows.forEach(row => {
                const cardType = (row[8] || '').toString().trim();
                const lineId = (row[9] || '').toString().trim();
                if (CARD_TYPES.includes(cardType) && lineId) {
                    grouped[cardType].push([lineId]);
                }
            });

            const zip = new JSZip();
            let hasFile = false;

            CARD_TYPES.forEach(type => {
                if (grouped[type].length > 0) {
                    const ws = XLSX.utils.aoa_to_sheet(grouped[type]);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, type);
                    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                    zip.file(`生日推播_${type}.xlsx`, buf);
                    hasFile = true;
                }
            });

            if (!hasFile) {
                setMessage({ type: 'error', text: '沒有符合的資料（卡類型需為：一般會員、VIP會員、VVIP會員）' });
                return;
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, '生日推播.zip');
            setMessage({ type: 'success', text: '生日推播 ZIP 已下載！' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '轉換失敗' });
        } finally {
            setConverting(false);
        }
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">資料轉換系統</h2>
            </div>

            {/* 上傳區域 */}
            <div
                className={`converter-upload-zone ${dragOver ? 'drag-over' : ''} ${fileData ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !fileData && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleInputChange}
                    style={{ display: 'none' }}
                    id="excel-upload-input"
                />
                {fileData ? (
                    <div className="converter-file-info">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <polyline points="9 15 12 18 15 15" />
                        </svg>
                        <span className="converter-file-name">{fileName}</span>
                        <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="btn btn-sm btn-outline" id="clear-file-btn">
                            重新上傳
                        </button>
                    </div>
                ) : (
                    <div className="converter-upload-prompt">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <p className="upload-main-text">拖拽 Excel 檔案到此處，或點擊上傳</p>
                        <p className="upload-sub-text">支援 .xlsx / .xls 格式</p>
                    </div>
                )}
            </div>

            {/* 訊息提示 */}
            {message && (
                <div className={`converter-message converter-message-${message.type}`} id="converter-message">
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            {/* 資料預覽 */}
            {preview.length > 0 && (
                <div className="converter-preview">
                    <h3 className="converter-section-title">📋 資料預覽（前 5 筆）</h3>
                    <div className="converter-table-wrap">
                        <table className="converter-table">
                            <thead>
                                <tr>
                                    {COLUMN_HEADERS.map((h, i) => (
                                        <th key={i}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.slice(1).map((row, ri) => (
                                    <tr key={ri}>
                                        {COLUMN_HEADERS.map((_, ci) => (
                                            <td key={ci}>{row[ci] ?? ''}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 轉換按鈕 */}
            {fileData && (
                <div className="converter-actions">
                    <h3 className="converter-section-title">🔄 選擇轉換格式</h3>
                    <div className="converter-btn-group">
                        <button
                            onClick={convertLINE}
                            disabled={converting}
                            className="converter-btn converter-btn-line"
                            id="convert-line-btn"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                            </svg>
                            <span>LINE 推播</span>
                            <small>輸出 LINE ID 清單</small>
                        </button>

                        <button
                            onClick={convertSMS}
                            disabled={converting}
                            className="converter-btn converter-btn-sms"
                            id="convert-sms-btn"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>SMS 推播</span>
                            <small>輸出電話號碼清單</small>
                        </button>

                        <button
                            onClick={convertBirthday}
                            disabled={converting}
                            className="converter-btn converter-btn-birthday"
                            id="convert-birthday-btn"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                <path d="M12 3v4" />
                                <path d="M8 7h8" />
                            </svg>
                            <span>生日推播</span>
                            <small>依卡類型分檔 (ZIP)</small>
                        </button>
                    </div>
                </div>
            )}

            {/* 格式說明 */}
            <div className="converter-info">
                <h3 className="converter-section-title">📖 格式說明</h3>
                <div className="converter-info-cards">
                    <div className="info-card">
                        <h4>原始檔案格式</h4>
                        <p>A~J 欄：會員編號 / 姓名 / 手機號 / 註冊日期 / 卡數量 / 卡餘額 / 積分餘額 / 主卡號 / 卡類型 / LINE ID</p>
                    </div>
                    <div className="info-card">
                        <h4>LINE 推播</h4>
                        <p>無表頭，僅輸出 LINE ID 欄</p>
                    </div>
                    <div className="info-card">
                        <h4>SMS 推播</h4>
                        <p>表頭「電話號碼」，輸出手機號欄</p>
                    </div>
                    <div className="info-card">
                        <h4>生日推播</h4>
                        <p>依卡類型分成三個檔案（一般/VIP/VVIP），無表頭，僅輸出 LINE ID 欄，打包 ZIP 下載</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DataConverterPage;
