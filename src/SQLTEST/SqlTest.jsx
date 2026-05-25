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

    const [sqlQuery, setSqlQuery] = useState('SELECT TOP 10 * FROM sys.tables;');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // 常用 SQL 範本一鍵填入 (MSSQL 語法)
    const applySqlTemplate = (template) => {
        setSqlQuery(template);
    };

    // 執行查詢主函數
    const handleExecuteQuery = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setResult(null);

        if (!sqlQuery.trim()) {
            setError('SQL 查詢欄位不可為空。');
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/sql-test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    dbType: 'mssql',
                    host: '192.168.180.21',
                    port: '1433',
                    database: 'brms_erp',
                    user: 'sa',
                    password: '5/4gj65p',
                    sql: sqlQuery
                })
            });

            const data = await response.json();
            if (response.ok && data.success) {
                setResult({
                    columns: data.columns,
                    rows: data.rows
                });
            } else {
                setError(data.error || 'SQL Server 連線或執行失敗。');
            }
        } catch (err) {
            console.error(err);
            setError('無法連線至 API 代理伺服器，請確認本地 Vite server 正常運作。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="sqltest-container">
            <header className="sqltest-header">
                <h1>SQL Server 資料庫測試工具</h1>
                <p>針對您的 ERP 資料庫，進行即時 SQL 查詢測試。</p>
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

                        <div className="connection-status-info">
                            <div className="status-indicator-wrapper">
                                <span className="status-dot pulsing"></span>
                                <span className="status-text">已鎖定為此測試伺服器</span>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* 右側：主操作區與查詢結果 */}
                <main className="sqltest-main">
                    {/* SQL 編輯卡片 */}
                    <section className="sqltest-card editor-card">
                        <div className="card-tabs">
                            <button className="tab-btn active">
                                SQL Server 查詢編輯器
                            </button>
                        </div>

                        <div className="tab-content">
                            <div className="sql-templates">
                                <span className="templates-label">MSSQL 範本:</span>
                                <button
                                    type="button"
                                    onClick={() => applySqlTemplate('SELECT TOP 10 * FROM sys.tables;')}
                                    className="template-badge"
                                    title="列出此資料庫中所有的資料表"
                                >
                                    🔍 探索所有資料表
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applySqlTemplate('SELECT TOP 100 * FROM [您的資料表名稱];')}
                                    className="template-badge"
                                >
                                    📄 前 100 筆查詢
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applySqlTemplate('SELECT COUNT(*) as TotalRows FROM [您的資料表名稱];')}
                                    className="template-badge"
                                >
                                    📊 統計資料筆數
                                </button>
                            </div>

                            <form onSubmit={handleExecuteQuery}>
                                <div className="textarea-wrapper">
                                    <textarea
                                        value={sqlQuery}
                                        onChange={(e) => setSqlQuery(e.target.value)}
                                        placeholder="請輸入 SQL Server 語法，例如：SELECT TOP 10 * FROM sys.tables;"
                                        rows="8"
                                    />
                                </div>
                                <div className="editor-actions">
                                    <button
                                        type="submit"
                                        className="execute-btn"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="spinner"></span>
                                                資料庫查詢中...
                                            </>
                                        ) : (
                                            '⚡ 執行 SQL 查詢'
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </section>

                    {/* 查詢結果卡片 */}
                    <section className="sqltest-card result-card">
                        <div className="result-header">
                            <h2>查詢結果</h2>
                            {result && (
                                <span className="rows-count">
                                    共 {result.rows.length} 筆資料
                                </span>
                            )}
                        </div>

                        <div className="result-body">
                            {isLoading && (
                                <div className="result-placeholder">
                                    <span className="spinner large"></span>
                                    <p>正在與 {dbConfig.host} 連線並執行查詢，請稍候...</p>
                                </div>
                            )}

                            {!isLoading && !result && !error && (
                                <div className="result-placeholder">
                                    <p className="hint">💡 請在上方輸入 SQL 查詢，並點選「執行 SQL 查詢」按鈕查看結果。</p>
                                </div>
                            )}

                            {!isLoading && error && (
                                <div className="error-alert">
                                    <h4>⚠️ 查詢執行失敗</h4>
                                    <p>{error}</p>
                                </div>
                            )}

                            {!isLoading && result && (
                                <div className="table-responsive">
                                    {result.rows.length === 0 ? (
                                        <div className="empty-result">
                                            <p>查詢成功，但未傳回任何資料列。</p>
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
                                                                    : <span className="null-val">NULL</span>}
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
