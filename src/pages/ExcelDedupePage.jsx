import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

function ExcelDedupePage() {
    const [fileList, setFileList] = useState([]); // { id, file, data, headers, progress, isReading }
    const [compareKey, setCompareKey] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [message, setMessage] = useState(null);
    const [dragOver, setDragOver] = useState(false);
    
    const fileInputRef = useRef(null);

    // 模擬讀取進度
    const simulateProgress = (id) => {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 30;
            setFileList(prev => prev.map(f => 
                f.id === id ? { ...f, progress: Math.min(progress, 90) } : f
            ));
            if (progress >= 90) clearInterval(interval);
        }, 100);
        return interval;
    };

    const handleFiles = (files) => {
        const newFiles = Array.from(files).filter(f => f.name.match(/\.(xlsx|xls)$/i));
        
        if (newFiles.length === 0) {
            setMessage({ type: 'error', text: '請上傳有效的 Excel 檔案 (.xlsx 或 .xls)' });
            return;
        }

        newFiles.forEach(file => {
            const id = Math.random().toString(36).substr(2, 9);
            const newFileObj = { id, file, data: [], headers: [], progress: 0, isReading: true };
            setFileList(prev => [...prev, newFileObj]);

            const interval = simulateProgress(id);
            const reader = new FileReader();

            reader.onload = (evt) => {
                try {
                    const bstr = evt.target.result;
                    const wb = XLSX.read(bstr, { type: 'binary' });
                    const ws = wb.Sheets[wb.SheetNames[0]];
                    const data = XLSX.utils.sheet_to_json(ws);
                    const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })[0];
                    
                    setFileList(prev => {
                        const updated = prev.map(f => {
                            if (f.id === id) {
                                return { ...f, data, headers: headers || [], progress: 100, isReading: false };
                            }
                            return f;
                        });
                        
                        // 如果是第一個上傳的檔案或是目前沒選 Key，預設選第一個欄位
                        if (updated.length > 0 && !compareKey) {
                            const firstFile = updated[0];
                            if (firstFile.headers && firstFile.headers.length > 0) {
                                setCompareKey(firstFile.headers[0]);
                            }
                        }
                        
                        return updated;
                    });
                    clearInterval(interval);
                } catch (err) {
                    console.error(err);
                    clearInterval(interval);
                    removeFile(id);
                    setMessage({ type: 'error', text: `${file.name} 解析失敗` });
                }
            };
            reader.readAsBinaryString(file);
        });
    };

    const removeFile = (id) => {
        setFileList(prev => {
            const newList = prev.filter(f => f.id !== id);
            // 如果刪掉的是基準檔或導致 Key 失效，重新檢查
            if (newList.length > 0) {
                 if (!newList[0].headers.includes(compareKey)) {
                    setCompareKey(newList[0].headers[0] || '');
                 }
            } else {
                setCompareKey('');
            }
            return newList;
        });
    };

    const handleDedupe = () => {
        if (fileList.length < 2) {
            setMessage({ type: 'error', text: '請至少上傳兩個檔案（一個基準檔，一個核對檔）' });
            return;
        }
        if (!compareKey) {
            setMessage({ type: 'error', text: '請選擇比對基準欄位' });
            return;
        }

        setIsProcessing(true);
        try {
            // 基準：第一個檔案
            const baseFile = fileList[0];
            const baseData = baseFile.data;
            
            // 統合所有「核對檔」(B, C, ...) 的 Key 集合
            const excludeSet = new Set();
            fileList.slice(1).forEach(f => {
                f.data.forEach(row => {
                    const val = String(row[compareKey] || '').trim();
                    if (val) excludeSet.add(val);
                });
            });

            // 執行「去從」：保留 A 裡面「不存在於 excludeSet」的列
            const resultData = baseData.filter(row => {
                const val = String(row[compareKey] || '').trim();
                return !excludeSet.has(val);
            });

            const removedCount = baseData.length - resultData.length;

            if (resultData.length === 0 && baseData.length > 0) {
                setMessage({ type: 'warning', text: '去從後資料變為空（所有資料都在核對檔中找到了）' });
            }

            const ws = XLSX.utils.json_to_sheet(resultData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "去從結果");
            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

            const date = new Date().toISOString().split('T')[0];
            saveAs(new Blob([buf], { type: "application/octet-stream" }), `Excel去從結果_${date}.xlsx`);
            setMessage({ 
                type: 'success', 
                text: `處理完成！原始 ${baseData.length} 筆，移除 ${removedCount} 筆重複，剩餘 ${resultData.length} 筆。` 
            });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '處理過程中發生錯誤' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="admin-page-content excel-compare-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">EXCEL 資料去從工具</h2>
                <p className="admin-content-subtitle">從第一個檔案中，移除出現在後續檔案中的重複內容。</p>
            </div>

            {/* 上傳區塊 */}
            <div 
                className={`converter-upload-zone ${dragOver ? 'drag-over' : ''} ${fileList.length > 0 ? 'has-file' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current.click()}
                style={{ marginBottom: '1.5rem', cursor: 'pointer' }}
            >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple onChange={(e) => handleFiles(e.target.files)} style={{ display: 'none' }} />
                <div className="converter-upload-prompt">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                    <p className="upload-main-text">點擊或拖入檔案</p>
                    <p className="upload-sub-text">第 1 個檔案為【基準】，後續檔案為【移除清單】</p>
                </div>
            </div>

            {/* 已上傳檔案列表 */}
            {fileList.length > 0 && (
                <div className="file-list-card">
                    <h3 className="section-small-title">檔案順序 (首檔為基準)</h3>
                    <div className="file-items-grid">
                        {fileList.map((f, index) => (
                            <div key={f.id} className="file-item-row" style={index === 0 ? { borderLeft: '4px solid var(--brand)' } : {}}>
                                <div className="file-index" style={index === 0 ? { background: 'var(--brand)' } : { background: '#666' }}>
                                    {index === 0 ? '基' : '刪'}
                                </div>
                                <div className="file-info-main">
                                    <span className="file-name">{f.file.name}</span>
                                    <span className="file-count">{f.isReading ? '讀取中...' : `${f.data.length} 筆`}</span>
                                </div>
                                {f.isReading && (
                                    <div className="item-progress">
                                        <div className="item-progress-fill" style={{ width: `${f.progress}%` }}></div>
                                    </div>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="remove-btn">✕</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 訊息提示 */}
            {message && (
                <div className={`converter-message converter-message-${message.type}`} style={{ margin: '1rem 0' }}>
                    {message.type === 'success' ? '✅' : message.type === 'warning' ? '⚠️' : '❌'} {message.text}
                </div>
            )}

            {/* 配置與操作區 */}
            {fileList.length >= 2 && (
                <div className="compare-config-card">
                    <div className="config-row">
                        <div className="config-item">
                            <label className="compare-label-text">比對基準欄位：</label>
                            <select value={compareKey} onChange={(e) => setCompareKey(e.target.value)} className="admin-input" style={{ background: 'white', color: 'black' }}>
                                {fileList[0].headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>* 系統將比對所有檔案中此欄位的值進行移除</p>
                        </div>
                        <div className="config-actions">
                            <button onClick={handleDedupe} disabled={isProcessing || fileList.some(f => f.isReading)} className="btn btn-primary btn-lg">
                                {isProcessing ? '處理中...' : '執行去從並下載'}
                            </button>
                            <button onClick={() => { setFileList([]); setMessage(null); }} className="btn btn-outline btn-lg">全部清除</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="converter-info">
                <h3 className="converter-section-title">📖 使用說明</h3>
                <div className="converter-info-cards">
                    <div className="info-card">
                        <h4>去從規則 (A - B)</h4>
                        <p>上傳多個檔案時，系統會以<strong>第一個檔案(A)</strong>為底。只要資料的基準欄位值出現在<strong>其他檔案(B, C...)</strong>中，該筆資料就會從 A 中移除。</p>
                    </div>
                    <div className="info-card">
                        <h4>如何操作</h4>
                        <p>1. 先拖入要被清理的檔案 A。<br/>2. 再拖入包含要移除名單的檔案 B。<br/>3. 選擇要比對的欄位（如：手機號碼或 ID）。<br/>4. 點擊執行並下載。</p>
                    </div>
                    <div className="info-card">
                        <h4>隱私安全</h4>
                        <p>所有計算皆在您的瀏覽器端完成，Excel 內容不會上傳至伺服器。</p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .excel-compare-page .file-item-row { margin-bottom: 0px; }
                .file-list-card {
                    background: #fff;
                    border: 1px solid var(--border-light);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .section-small-title {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-bottom: 1rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .file-items-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .file-item-row {
                    display: flex;
                    align-items: center;
                    background: var(--bg-gray);
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    position: relative;
                    overflow: hidden;
                    border: 1px solid var(--border-light);
                }
                .file-index {
                    width: 28px;
                    height: 28px;
                    color: #fff;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    margin-right: 1rem;
                    font-weight: bold;
                }
                .file-info-main {
                    flex: 1;
                    display: flex;
                    justify-content: space-between;
                    margin-right: 1.5rem;
                }
                .file-name {
                    font-weight: 500;
                    max-width: 400px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    color: var(--text);
                }
                .file-count {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                }
                .remove-btn {
                    background: none;
                    border: none;
                    color: #ff4d4f;
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 5px;
                    line-height: 1;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                .remove-btn:hover { opacity: 1; }
                .item-progress {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 100%;
                    height: 2px;
                    background: rgba(0,0,0,0.05);
                }
                .item-progress-fill {
                    height: 100%;
                    background: var(--brand);
                    transition: width 0.3s ease;
                }
                .compare-config-card {
                    background: #fff;
                    border: 1px solid var(--border-light);
                    border-radius: 12px;
                    padding: 2rem;
                    margin-bottom: 2rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .compare-label-text {
                    display: block;
                    margin-bottom: 0.75rem;
                    font-weight: 600;
                    color: var(--text) !important;
                    font-size: 1rem;
                }
                .config-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    gap: 2rem;
                    flex-wrap: wrap;
                }
                .config-item {
                    flex: 1;
                    min-width: 250px;
                }
                .config-actions {
                    display: flex;
                    gap: 1rem;
                }
                .btn-lg {
                    padding: 0.75rem 1.5rem;
                    font-size: 1rem;
                }
                .converter-message-warning {
                    background-color: #fff7e6;
                    border: 1px solid #ffbb96;
                    color: #d46b08;
                    padding: 10px 15px;
                    border-radius: 8px;
                }
            ` }} />
        </div>
    );
}

export default ExcelDedupePage;
