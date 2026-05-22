import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

const COUPON_TYPES = {
    'GREEN50': '綠卡註冊禮',
    'golden100': '白金卡升等禮',
    'black200': '黑卡升等禮'
};

const COLUMN_HEADERS = ['券編號', '原到期日', '轉換後到期日', '卡號', '活動編號', 'LINE UID'];

function CouponExpiryPage() {
    const [fileData, setFileData] = useState(null);       // 原始解析資料 (二維陣列)
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState([]);            // 預覽用
    const [converting, setConverting] = useState(false);
    const [days, setDays] = useState(7);                  // 到期天數，預設7天
    const [deduplicate, setDeduplicate] = useState(true);  // 是否排除重複 LINE UID
    const [message, setMessage] = useState(null);          // 提示訊息
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // ===== 日期轉換邏輯 =====
    function convertExcelDate(val) {
        if (!val) return '';
        const str = String(val).trim();

        // 1. 如果是數字，可能是 Excel 的日期序列值 (Excel serial date)
        if (!isNaN(str) && Number(str) > 30000) {
            const date = new Date((Number(str) - 25569) * 86400 * 1000);
            if (date && !isNaN(date.getTime())) {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}/${mm}/${dd}`;
            }
        }

        // 2. 處理 "01-6月 26" / "22-6月 -26" 等帶空白與破折號的格式
        let cleanStr = str.replace(/\s+/g, '-'); // 將所有空白字元轉換為破折號
        cleanStr = cleanStr.replace(/-+/g, '-'); // 將連續的破折號合併為單一破折號
        const match = cleanStr.match(/^(\d+)-(\d+)月?-(\d+)$/);
        if (match) {
            const d = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            let y = parseInt(match[3], 10);

            if (y < 100) {
                y = 2000 + y;
            }

            const yyyy = y;
            const mm = String(m).padStart(2, '0');
            const dd = String(d).padStart(2, '0');
            return `${yyyy}/${mm}/${dd}`;
        }

        // 3. 嘗試一般瀏覽器 Date 解析
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            return `${yyyy}/${mm}/${dd}`;
        }

        return str; // 無法解析則返回原字串
    }

    // ===== 檔案上傳與讀取 =====
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

                // 預覽：表頭以外的前 5 筆資料並做日期轉換展示
                const previewRows = data.slice(1, 6).map(row => {
                    const couponCode = String(row[0] || '').trim();
                    const origExpiry = String(row[1] || '').trim();
                    const convExpiry = convertExcelDate(origExpiry);
                    const cardNo = String(row[2] || '').trim();
                    const eventId = String(row[3] || '').trim();
                    const lineUid = String(row[4] || '').trim();
                    return [couponCode, origExpiry, convExpiry, cardNo, eventId, lineUid];
                });
                setPreview(previewRows);
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

    // ===== 名單處理與轉換 =====
    function processGroups() {
        if (!fileData) return null;

        const dataRows = fileData.slice(1);
        const groups = {
            'GREEN50': [],
            'golden100': [],
            'black200': []
        };

        const uidsSeen = {
            'GREEN50': new Set(),
            'golden100': new Set(),
            'black200': new Set()
        };

        // 基準時間計算
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + Number(days));

        dataRows.forEach(row => {
            const couponCode = String(row[0] || '').trim();
            const expiryStr = String(row[1] || '').trim();
            const lineUid = String(row[4] || '').trim();

            // 排除 LINE UID 空值
            if (!lineUid) return;

            // 比對券編號
            let matchedKey = null;
            if (couponCode.toLowerCase() === 'green50') matchedKey = 'GREEN50';
            else if (couponCode.toLowerCase() === 'golden100') matchedKey = 'golden100';
            else if (couponCode.toLowerCase() === 'black200') matchedKey = 'black200';

            if (!matchedKey) return;

            // 解析到期日並進行比對
            const convDateStr = convertExcelDate(expiryStr);
            const parts = convDateStr.split('/');
            if (parts.length === 3) {
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                d.setHours(0, 0, 0, 0);

                const isMatch = d.getTime() >= today.getTime() && d.getTime() <= targetDate.getTime();

                if (isMatch) {
                    if (deduplicate) {
                        if (!uidsSeen[matchedKey].has(lineUid)) {
                            uidsSeen[matchedKey].add(lineUid);
                            groups[matchedKey].push(lineUid);
                        }
                    } else {
                        groups[matchedKey].push(lineUid);
                    }
                }
            }
        });

        return groups;
    }

    // 打包 ZIP 下載
    async function handleConvertZip() {
        if (!fileData) return;
        setConverting(true);
        try {
            const groups = processGroups();
            if (!groups) return;

            const zip = new JSZip();
            let hasFile = false;

            Object.keys(groups).forEach(key => {
                if (groups[key].length > 0) {
                    const csvContent = '\uFEFF' + groups[key].join('\r\n');
                    zip.file(`${key}_${COUPON_TYPES[key]}到期提醒名單.csv`, csvContent);
                    hasFile = true;
                }
            });

            if (!hasFile) {
                setMessage({ type: 'error', text: `在指定的篩選條件下，未找到符合到期日之名單。` });
                return;
            }

            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `電子券到期名單_${days}天後.zip`);
            setMessage({ type: 'success', text: 'CSV 打包下載成功！' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '轉換並打包失敗' });
        } finally {
            setConverting(false);
        }
    }

    // 單一 CSV 下載
    function handleDownloadSingle(key) {
        if (!fileData) return;
        const groups = processGroups();
        if (!groups || !groups[key] || groups[key].length === 0) {
            setMessage({ type: 'error', text: `無此券編號 (${key}) 符合條件的資料` });
            return;
        }

        try {
            const csvContent = '\uFEFF' + groups[key].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
            saveAs(blob, `${key}_${COUPON_TYPES[key]}.csv`);
            setMessage({ type: 'success', text: `${COUPON_TYPES[key]} CSV 下載成功！` });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '下載失敗' });
        }
    }

    // 計算每個群組目前符合條件的數量
    const currentCounts = fileData ? (() => {
        const groups = processGroups();
        return groups ? {
            'GREEN50': groups['GREEN50'].length,
            'golden100': groups['golden100'].length,
            'black200': groups['black200'].length,
            'total': groups['GREEN50'].length + groups['golden100'].length + groups['black200'].length
        } : null;
    })() : null;

    // 日期格式化與提示計算
    const formatDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}/${mm}/${dd}`;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + Number(days));

    const dateHint = `📅 篩選範圍: ${formatDate(today)} ~ ${formatDate(targetDate)}`;

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">電子券到期名單轉換</h2>
                <p className="admin-content-subtitle">
                    上傳含有券編號、到期日、LINE UID 等欄位的 Excel 檔案，依據到期天數自動篩選並分成三個名單檔案。
                </p>
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

            {/* 參數設定 */}
            {fileData && (
                <div className="edit-section-card mb-5">
                    <h3 className="edit-section-title">
                        ⚙️ 篩選參數設定
                    </h3>
                    <div className="grid-2">
                        <div className="config-item">
                            <label className="compare-label-text">
                                到期天數 (天後)：
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={days}
                                onChange={(e) => setDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                className="admin-input w-full"
                            />
                            <div className="text-blue font-medium mt-2 text-dim">
                                {dateHint}
                            </div>
                        </div>

                        <div className="config-item d-flex align-end">
                            <label className="cursor-pointer font-bold pb-2 d-flex align-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={deduplicate}
                                    onChange={(e) => setDeduplicate(e.target.checked)}
                                />
                                排除重複的 LINE UID
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {/* 資料預覽 */}
            {fileData && preview.length > 0 && (
                <div className="converter-preview">
                    <div className="converter-section-header">
                        <h3 className="converter-section-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <path d="M16 13H8"></path>
                                <path d="M16 17H8"></path>
                                <path d="M10 9H8"></path>
                            </svg>
                            欄位解析預覽（前 5 筆）
                        </h3>
                        <span className="preview-badge">展示轉換後格式</span>
                    </div>
                    <div className="admin-table-wrap">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    {COLUMN_HEADERS.map((h, i) => (
                                        <th key={i}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((row, ri) => (
                                    <tr key={ri}>
                                        <td><strong>{row[0]}</strong></td>
                                        <td>{row[1]}</td>
                                        <td className="text-blue font-medium">{row[2]}</td>
                                        <td>{row[3]}</td>
                                        <td>{row[4]}</td>
                                        <td>{row[5] || <span className="text-danger font-italic">空值 (將被排除)</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 下載與轉換動作區 */}
            {fileData && currentCounts && (
                <div className="converter-actions mt-5">
                    <h3 className="converter-section-title">📥 篩選結果與名單導出</h3>

                    {/* 目前篩選結果統計 */}
                    <div className="card-stat-group">
                        <p className="card-stat-title">
                            符合條件統計結果 (天數: {days} 天內)：
                        </p>
                        <div className="card-stat-row">
                            <span>🟢 綠卡註冊禮：<strong className="text-success">{currentCounts.GREEN50}</strong> 筆</span>
                            <span>🟡 白金卡升等禮 ：<strong className="text-warning">{currentCounts.golden100}</strong> 筆</span>
                            <span>⚫ 黑卡升等禮：<strong className="text-dim font-bold">{currentCounts.black200}</strong> 筆</span>
                            <span className="total-stat-badge">總計名單：<strong>{currentCounts.total}</strong> 筆</span>
                        </div>
                    </div>

                    {/* 打包下載按鈕 */}
                    <div className="mb-5">
                        <button
                            onClick={handleConvertZip}
                            disabled={converting || currentCounts.total === 0}
                            className="btn btn-primary btn-zip-download"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            {converting ? '打包轉換中...' : `一鍵打包下載三種電子券 CSV 檔 (ZIP)`}
                        </button>
                    </div>

                    {/* 單檔下載 */}
                    <h4 className="mb-3 sec-title-upper">
                        個別檔案下載：
                    </h4>
                    <div className="converter-btn-group grid-3">
                        <button
                            onClick={() => handleDownloadSingle('GREEN50')}
                            disabled={currentCounts.GREEN50 === 0}
                            className="converter-btn coupon-btn-green"
                        >
                            <div className="font-bold text-dark">綠卡註冊禮 (GREEN50)</div>
                            <small className="text-dim">符合：{currentCounts.GREEN50} 筆名單</small>
                        </button>

                        <button
                            onClick={() => handleDownloadSingle('golden100')}
                            disabled={currentCounts.golden100 === 0}
                            className="converter-btn coupon-btn-gold"
                        >
                            <div className="font-bold text-dark">白金卡升等禮 (golden100)</div>
                            <small className="text-dim">符合：{currentCounts.golden100} 筆名單</small>
                        </button>

                        <button
                            onClick={() => handleDownloadSingle('black200')}
                            disabled={currentCounts.black200 === 0}
                            className="converter-btn coupon-btn-black"
                        >
                            <div className="font-bold text-dark">黑卡升等禮 (black200)</div>
                            <small className="text-dim">符合：{currentCounts.black200} 筆名單</small>
                        </button>
                    </div>
                </div>
            )}

            {/* 說明區塊 */}
            <div className="converter-info mt-6">
                <h3 className="converter-section-title">📖 轉換規則說明</h3>
                <div className="converter-info-cards">
                    <div className="info-card">
                        <h4>A 欄券編號分類</h4>
                        <p>
                            綠卡註冊禮：<code>GREEN50</code><br />
                            白金卡升等禮：<code>golden100</code><br />
                            黑卡升等禮：<code>black200</code>
                        </p>
                    </div>
                    <div className="info-card">
                        <h4>B 欄日期格式轉換</h4>
                        <p>
                            將 <code>01-6月 26</code> 格式轉換為標準 <code>YYYY/MM/DD</code> (例如：2026/06/01)。
                        </p>
                    </div>
                    <div className="info-card">
                        <h4>E 欄 LINE UID</h4>
                        <p>
                            CSV 檔僅輸出 LINE UID 名單（無表頭），並會排除空值資料，亦可勾選排除重複的 UID。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CouponExpiryPage;
