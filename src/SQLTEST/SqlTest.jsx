import { useState } from 'react';
import './SqlTest.css';

export default function SqlTest() {
    // 固定的 SQL Server 測試連線資訊
    const dbConfig = {
        dbType: 'Microsoft SQL Server',
        host: '192.168.180.21',
        port: '1433',
        database: 'brms_erp',
        user: 'sa',
        password: '• • • • • • • •' // 密碼於介面隱藏以維護安全性
    };

    const [searchKeyword, setSearchKeyword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // 新增：連線測試專用狀態
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionResult, setConnectionResult] = useState(null); // { success: boolean, message: string }

    // 測試資料庫連線主函數
    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        setConnectionResult(null);

        try {
            const response = await fetch('/api/sql-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sql: 'SELECT 1 as ConnectionTest;'
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                setConnectionResult({
                    success: true,
                    message: '連線成功！資料庫運作正常，已成功與內網 SQL Server 建立通訊。'
                });
            } else {
                setConnectionResult({
                    success: false,
                    message: data.error || '連線失敗。請確認是否已連線至公司內網、或帳號密碼是否正確。'
                });
            }
        } catch (err) {
            console.error(err);
            setConnectionResult({
                success: false,
                message: '連線失敗：無法與本地 Vite 代理建立連線，請確保本地 Vite 伺服器正在運作中。'
            });
        } finally {
            setIsTestingConnection(false);
        }
    };

    // 執行查詢主函數 (自動產生 INVMB 查詢)
    const handleSearch = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setResult(null);

        const escaped = searchKeyword.trim().replace(/'/g, "''");
        
        // 自動生成針對 INVMB 商品資料表的查詢
        // 若無關鍵字，預設列出前 100 筆商品；若有，則進行品號、品名與規格的模糊搜尋
        const sql = escaped
            ? `SELECT TOP 100 MB001 as [品號], MB002 as [品名], MB003 as [規格], MB004 as [單位] FROM INVMB WHERE MB001 LIKE '%${escaped}%' OR MB002 LIKE '%${escaped}%' OR MB003 LIKE '%${escaped}%';`
            : `SELECT TOP 100 MB001 as [品號], MB002 as [品名], MB003 as [規格], MB004 as [單位] FROM INVMB;`;

        try {
            const response = await fetch('/api/sql-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sql: sql
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                setResult({
                    columns: data.columns,
                    rows: data.rows
                });
            } else {
                setError(data.error || '商品查詢執行失敗。');
            }
        } catch (err) {
            console.error(err);
            setError('無法與資料庫建立連線，請確認您已連接至內網，且已在本地啟動開發伺服器。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="sqltest-container">
            <header className="sqltest-header">
                <h1>ERP 商品資料查詢系統</h1>
                <p>針對您的 brms_erp 資料庫進行商品資訊檢索，限公司內網使用。</p>
            </header>

            <div className="sqltest-grid">
                {/* 左側：唯讀連線資訊卡片 */}
                <aside className="sqltest-card sqltest-sidebar">
                    <div className="sidebar-header">
                        <h2>連線目標資訊</h2>
                        <span className="db-type-badge">SQL Server</span>
                    </div>

                    <div className="readonly-config-panel">
                        <div className="config-item">
                            <span className="config-label">伺服器主機 (Host)</span>
                            <span className="config-value">{dbConfig.host}</span>
                        </div>

                        <div className="config-row">
                            <div className="config-item">
                                <span className="config-label">連接埠 (Port)</span>
                                <span className="config-value">{dbConfig.port}</span>
                            </div>
                            <div className="config-item">
                                <span className="config-label">資料庫名稱</span>
                                <span className="config-value highlight-db">{dbConfig.database}</span>
                            </div>
                        </div>

                        <div className="config-item">
                            <span className="config-label">登入帳號 (Username)</span>
                            <span className="config-value">{dbConfig.user}</span>
                        </div>

                        <div className="config-item">
                            <span className="config-label">密碼 (Password)</span>
                            <span className="config-value password-masked">{dbConfig.password}</span>
                        </div>

                        {/* 測試連線按鈕區 */}
                        <div className="connection-actions">
                            <button
                                type="button"
                                className="test-conn-btn"
                                onClick={handleTestConnection}
                                disabled={isTestingConnection}
                            >
                                {isTestingConnection ? (
                                    <>
                                        <span className="spinner mini"></span>
                                        測試連線中...
                                    </>
                                ) : (
                                    '⚡ 測試資料庫連線'
                                )}
                            </button>
                        </div>

                        {/* 測試連線結果展示 */}
                        {connectionResult && (
                            <div className={`connection-alert ${connectionResult.success ? 'success' : 'error'}`}>
                                <strong>{connectionResult.success ? '✅ 連線成功' : '⚠️ 連線失敗'}</strong>
                                <p>{connectionResult.message}</p>
                            </div>
                        )}

                        <div className="connection-status-info">
                            <div className="status-indicator-wrapper">
                                <span className="status-dot pulsing"></span>
                                <span className="status-text">已鎖定為此測試伺服器</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* 右側：主查詢區與商品結果 */}
                <main className="sqltest-main">
                    {/* 商品搜尋卡片 */}
                    <section className="sqltest-card editor-card">
                        <div className="card-tabs">
                            <button className="tab-btn active">
                                🔍 商品快速檢索 (INVMB)
                            </button>
                        </div>

                        <div className="tab-content">
                            <form onSubmit={handleSearch} className="search-form-layout">
                                <p className="search-intro-text">
                                    💡 請輸入商品的<strong>品號、品名或規格</strong>關鍵字進行模糊搜尋（留空則預設列出前 100 筆商品）：
                                </p>
                                <div className="search-input-group">
                                    <input
                                        type="text"
                                        className="product-search-input"
                                        placeholder="例如：請輸入品名關鍵字、品號（如 MB001 等）"
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="submit"
                                        className="product-search-btn"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="spinner"></span>
                                                查詢中...
                                            </>
                                        ) : (
                                            '🔍 開始搜尋商品'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </section>

                    {/* 商品查詢結果卡片 */}
                    <section className="sqltest-card result-card">
                        <div className="result-header">
                            <h2>商品列表</h2>
                            {result && (
                                <span className="rows-count">
                                    共 {result.rows.length} 筆商品資料
                                </span>
                            )}
                        </div>

                        <div className="result-body">
                            {isLoading && (
                                <div className="result-placeholder">
                                    <span className="spinner large"></span>
                                    <p>正在連線內網資料庫檢索 INVMB 商品表，請稍候...</p>
                                </div>
                            )}

                            {!isLoading && !result && !error && (
                                <div className="result-placeholder">
                                    <p className="hint">💡 請在上方輸入商品關鍵字，並點選「開始搜尋商品」按鈕進行檢索。</p>
                                </div>
                            )}

                            {!isLoading && error && (
                                <div className="error-alert">
                                    <h4>⚠️ 商品檢索失敗</h4>
                                    <p>{error}</p>
                                </div>
                            )}

                            {!isLoading && result && (
                                <div className="table-responsive">
                                    {result.rows.length === 0 ? (
                                        <div className="empty-result">
                                            <p>未找到符合關鍵字的商品資料。</p>
                                        </div>
                                    ) : (
                                        <table className="sql-result-table">
                                            <thead>
                                                <tr>
                                                    {result.columns.map((col, idx) => (
                                                        <th key={idx}>{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.rows.map((row, rowIdx) => (
                                                    <tr key={rowIdx}>
                                                        {result.columns.map((col, colIdx) => (
                                                            <td key={colIdx}>
                                                                {row[col] !== undefined && row[col] !== null 
                                                                    ? String(row[col]) 
                                                                    : <span className="null-val">無</span>}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
