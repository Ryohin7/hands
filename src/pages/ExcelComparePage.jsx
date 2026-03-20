import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

function ExcelComparePage() {
    const [fileList, setFileList] = useState([]); // { id, file, data, headers, progress, isReading }
    const [compareKey, setCompareKey] = useState('');
    const [isComparing, setIsComparing] = useState(false);
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
                    
                    setFileList(prev => prev.map(f => {
                        if (f.id === id) {
                            // 如果是第一個檔案且未設定 key，預設選第一個欄位
                            if (prev.indexOf(f) === 0 || !compareKey) {
                                if (headers && headers.length > 0) setCompareKey(headers[0]);
                            }
                            return { ...f, data, headers: headers || [], progress: 100, isReading: false };
                        }
                        return f;
                    }));
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
            if (newList.length > 0 && !newList.find(f => f.headers.includes(compareKey))) {
                if (newList[0].headers.length > 0) setCompareKey(newList[0].headers[0]);
            }
            return newList;
        });
    };

    const handleCompare = () => {
        if (fileList.length < 2) {
            setMessage({ type: 'error', text: '請至少上傳兩個檔案進行比對' });
            return;
        }
        if (!compareKey) {
            setMessage({ type: 'error', text: '請選擇比對欄位' });
            return;
        }

        setIsComparing(true);
        try {
            // 以第一個檔案為基底
            const baseData = fileList[0].data;
            
            // 取得其他所有檔案的 Key 集合
            const otherKeySets = fileList.slice(1).map(f => {
                return new Set(f.data.map(row => String(row[compareKey] || '').trim()));
            });

            // 比對：每一列都必須存在於「所有」其他檔案中
            const matchedData = baseData.filter(row => {
                const val = String(row[compareKey] || '').trim();
                return otherKeySets.every(keySet => keySet.has(val));
            });

            if (matchedData.length === 0) {
                setMessage({ type: 'error', text: '未找到在所有檔案中都重複的資料' });
                setIsComparing(false);
                return;
            }

            const ws = XLSX.utils.json_to_sheet(matchedData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "交集比對結果");
            const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

            const date = new Date().toISOString().split('T')[0];
            saveAs(new Blob([buf], { type: "application/octet-stream" }), `多檔比對結果_${date}.xlsx`);
            setMessage({ type: 'success', text: `比對完成！共找出 ${matchedData.length} 筆共同重複資料。` });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: '比對失敗' });
        } finally {
            setIsComparing(false);
        }
    };

    return (
        <div className="admin-page-content excel-compare-page">
            <div className="admin-content-header">
                <h2 className="admin-content-title">多檔案資料比對系統</h2>
                <p className="admin-content-subtitle">上傳多份 Excel，找出同時存在於所有檔案中的重複名單（以首檔為格式基準）。</p>
            </div>

            {/* 上傳區塊 - 支援多檔案 */}
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
                    <p className="upload-main-text">點擊或拖入檔案 (支援多選)</p>
                    <p className="upload-sub-text">第一份檔案將作為下載結果的欄位基準</p>
                </div>
            </div>

            {/* 已上傳檔案列表 */}
            {fileList.length > 0 && (
                <div className="file-list-card">
                    <h3 className="section-small-title">已選取檔案 ({fileList.length})</h3>
                    <div className="file-items-grid">
                        {fileList.map((f, index) => (
                            <div key={f.id} className="file-item-row">
                                <div className="file-index">{index + 1}</div>
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
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                </div>
            )}

            {/* 配置與操作區 */}
            {fileList.length >= 2 && (
                <div className="compare-config-card">
                    <div className="config-row">
                        <div className="config-item">
                            <label className="compare-label-text">比對基準欄位 (由首檔讀取)：</label>
                            <select value={compareKey} onChange={(e) => setCompareKey(e.target.value)} className="admin-input" style={{ background: 'white', color: 'black' }}>
                                {fileList[0].headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div className="config-actions">
                            <button onClick={handleCompare} disabled={isComparing || fileList.some(f => f.isReading)} className="btn btn-primary btn-lg">
                                {isComparing ? '比對中...' : '開始聯合比對並下載'}
                            </button>
                            <button onClick={() => { setFileList([]); setMessage(null); }} className="btn btn-outline btn-lg">清空列表</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 說明區塊 */}
            <div className="converter-info">
                <h3 className="converter-section-title">📖 多檔比對原理</h3>
                <div className="converter-info-cards">
                    <div className="info-card">
                        <h4>聯合交集比對</h4>
                        <p>假設您上傳 A、B、C 三個檔，系統會找出在 A 裡面，且同時也存在於 B <strong>而且</strong>也存在於 C 的資料。</p>
                    </div>
                    <div className="info-card">
                        <h4>首檔基準制</h4>
                        <p>最終下載的檔案，欄位格式會完全依照<strong>第一份上傳的檔案</strong>。請將資訊最完整的檔案放在第一位。</p>
                    </div>
                    <div className="info-card">
                        <h4>本地運算</h4>
                        <p>所有比對都在瀏覽器端完成，不論檔案多大都不會上傳伺服器，確保數據安全與隱私。</p>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
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
                    width: 24px;
                    height: 24px;
                    background: var(--brand);
                    color: #fff;
                    border-radius: 50%;
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
            ` }} />
        </div>
    );
}

export default ExcelComparePage;
