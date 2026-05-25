import { useState } from 'react';
import './SqlTest.css';

export default function SqlTest() {
    const [dbConfig, setDbConfig] = useState({
        dbType: 'mysql',
        host: 'localhost',
        port: '3306',
        database: 'test_db',
        user: 'root',
        password: ''
    });

    const [sqlQuery, setSqlQuery] = useState('SELECT * FROM users;');
    const [mockMode, setMockMode] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('query'); // 'query' | 'schema'

    // Mock 資料庫資料
    const mockDb = {
        users: [
            { id: 1, name: '張小明', email: 'xiaoming@example.com', role: 'admin', created_at: '2026-01-10' },
            { id: 2, name: '李四', email: 'lisi@example.com', role: 'staff', created_at: '2026-02-15' },
            { id: 3, name: '王五', email: 'wangwu@example.com', role: 'user', created_at: '2026-03-20' },
            { id: 4, name: '趙六', email: 'zhaoliu@example.com', role: 'user', created_at: '2026-04-05' }
        ],
        products: [
            { id: 1, name: '極致保濕精華液', price: 1280, stock: 45, category: '保養品' },
            { id: 2, name: '亮白潔顏乳', price: 580, stock: 120, category: '清潔' },
            { id: 3, name: '緊緻眼霜', price: 1980, stock: 15, category: '保養品' },
            { id: 4, name: '防曬隔離乳', price: 850, stock: 88, category: '彩妝' }
        ]
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setDbConfig(prev => {
            const updated = { ...prev, [name]: value };
            // 當切換資料庫類型時，自動填入預設連接埠
            if (name === 'dbType') {
                updated.port = value === 'mysql' ? '3306' : '5432';
            }
            return updated;
        });
    };

    // 常用 SQL 範本一鍵填入
    const applySqlTemplate = (template) => {
        setSqlQuery(template);
    };

    // 模擬前端 SQL 執行器 (針對 Mock 模式)
    const runMockSql = (sql) => {
        const cleanedSql = sql.trim().replace(/;$/, '').toLowerCase();
        
        if (!cleanedSql.startsWith('select')) {
            throw new Error('Mock 模式僅支援基礎 SELECT 查詢語法。');
        }

        let targetTable = '';
        if (cleanedSql.includes('from users')) {
            targetTable = 'users';
        } else if (cleanedSql.includes('from products')) {
            targetTable = 'products';
        } else {
            throw new Error('找不到該資料表。在 Mock 模式下，僅可使用 users 或 products 表進行測試。');
        }

        let data = [...mockDb[targetTable]];

        // 簡單的 WHERE 篩選模擬 (例如 where id = 1)
        const idMatch = cleanedSql.match(/where\s+id\s*=\s*(\d+)/);
        if (idMatch) {
            const idValue = parseInt(idMatch[1]);
            data = data.filter(item => item.id === idValue);
        }

        // 簡單的 SELECT 欄位篩選模擬 (例如 select name, email from...)
        const columnsMatch = sql.trim().match(/select\s+(.+?)\s+from/i);
        let columns = [];
        if (columnsMatch && columnsMatch[1].trim() !== '*') {
            columns = columnsMatch[1].split(',').map(c => c.trim().toLowerCase());
            data = data.map(item => {
                const filtered = {};
                columns.forEach(col => {
                    const originalKey = Object.keys(item).find(key => key.toLowerCase() === col);
                    if (originalKey) {
                        filtered[originalKey] = item[originalKey];
                    }
                });
                return filtered;
            });
        }

        if (data.length === 0) {
            return {
                columns: mockDb[targetTable].length > 0 ? Object.keys(mockDb[targetTable][0]) : [],
                rows: []
            };
        }

        return {
            columns: Object.keys(data[0]),
            rows: data
        };
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

        if (mockMode) {
            // 延遲模擬，創造真實請求效果
            setTimeout(() => {
                try {
                    const mockResult = runMockSql(sqlQuery);
                    setResult(mockResult);
                } catch (err) {
                    setError(err.message);
                } finally {
                    setIsLoading(false);
                }
            }, 600);
        } else {
            try {
                const response = await fetch('/api/sql-test', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...dbConfig,
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
                    setError(data.error || '連線或查詢失敗。');
                }
            } catch (err) {
                console.error(err);
                setError('無法連線至 API 伺服器，請檢查您的網路或後端服務是否正常。');
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="sqltest-container">
            <header className="sqltest-header">
                <h1>簡易資料庫測試工具</h1>
                <p>輸入您的資料庫連線資訊，進行即時 SQL 查詢測試。</p>
            </header>

            <div className="sqltest-grid">
                {/* 左側：連線設定卡片 */}
                <aside className="sqltest-card sqltest-sidebar">
                    <div className="sidebar-header">
                        <h2>資料庫設定</h2>
                        <div className="mock-toggle-wrapper">
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={mockMode}
                                    onChange={(e) => setMockMode(e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                            <span className="toggle-label">模擬 (Mock) 模式</span>
                        </div>
                    </div>

                    <form className="sqltest-form">
                        <div className="form-group">
                            <label>資料庫類型</label>
                            <select
                                name="dbType"
                                value={dbConfig.dbType}
                                onChange={handleInputChange}
                                disabled={mockMode}
                            >
                                <option value="mysql">MySQL / MariaDB</option>
                                <option value="postgres">PostgreSQL</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>主機位址 (Host)</label>
                            <input
                                type="text"
                                name="host"
                                value={dbConfig.host}
                                onChange={handleInputChange}
                                placeholder="e.g. localhost"
                                disabled={mockMode}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>連接埠 (Port)</label>
                                <input
                                    type="text"
                                    name="port"
                                    value={dbConfig.port}
                                    onChange={handleInputChange}
                                    placeholder={dbConfig.dbType === 'mysql' ? '3306' : '5432'}
                                    disabled={mockMode}
                                />
                            </div>

                            <div className="form-group">
                                <label>資料庫名稱</label>
                                <input
                                    type="text"
                                    name="database"
                                    value={dbConfig.database}
                                    onChange={handleInputChange}
                                    placeholder="Database"
                                    disabled={mockMode}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>帳號 (Username)</label>
                            <input
                                type="text"
                                name="user"
                                value={dbConfig.user}
                                onChange={handleInputChange}
                                placeholder="Username"
                                disabled={mockMode}
                            />
                        </div>

                        <div className="form-group">
                            <label>密碼 (Password)</label>
                            <input
                                type="password"
                                name="password"
                                value={dbConfig.password}
                                onChange={handleInputChange}
                                placeholder="Password"
                                disabled={mockMode}
                            />
                        </div>

                        {mockMode && (
                            <div className="mock-badge-alert">
                                💡 目前已啟用 <strong>Mock 模式</strong>，您不需要輸入真實的資料庫資訊。
                            </div>
                        )}
                    </form>
                </aside>

                {/* 右側：主操作區與查詢結果 */}
                <main className="sqltest-main">
                    {/* SQL 編輯卡片 */}
                    <section className="sqltest-card editor-card">
                        <div className="card-tabs">
                            <button
                                className={`tab-btn ${activeTab === 'query' ? 'active' : ''}`}
                                onClick={() => setActiveTab('query')}
                            >
                                SQL 查詢編輯器
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
                                onClick={() => setActiveTab('schema')}
                            >
                                資料表結構 (Schema)
                            </button>
                        </div>

                        {activeTab === 'query' ? (
                            <div className="tab-content">
                                <div className="sql-templates">
                                    <span className="templates-label">常用範本:</span>
                                    <button
                                        type="button"
                                        onClick={() => applySqlTemplate('SELECT * FROM users;')}
                                        className="template-badge"
                                    >
                                        查詢所有使用者
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applySqlTemplate('SELECT * FROM products;')}
                                        className="template-badge"
                                    >
                                        查詢所有商品
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applySqlTemplate('SELECT name, email FROM users WHERE id = 1;')}
                                        className="template-badge"
                                    >
                                        依 ID 查詢使用者欄位
                                    </button>
                                </div>

                                <form onSubmit={handleExecuteQuery}>
                                    <div className="textarea-wrapper">
                                        <textarea
                                            value={sqlQuery}
                                            onChange={(e) => setSqlQuery(e.target.value)}
                                            placeholder="請輸入 SQL 語法，例如：SELECT * FROM users;"
                                            rows="6"
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
                                                    執行查詢中...
                                                </>
                                            ) : (
                                                '🚀 執行 SQL 查詢'
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="tab-content schema-content">
                                <h3>可用的模擬資料表資訊 (Mock Mode Only)</h3>
                                <div className="schema-table-info">
                                    <h4>👥 users 資料表</h4>
                                    <ul>
                                        <li><code>id</code> (int) - 主鍵 ID</li>
                                        <li><code>name</code> (varchar) - 姓名</li>
                                        <li><code>email</code> (varchar) - 電子郵件</li>
                                        <li><code>role</code> (varchar) - 角色 (admin / staff / user)</li>
                                        <li><code>created_at</code> (date) - 建立時間</li>
                                    </ul>
                                </div>
                                <div className="schema-table-info">
                                    <h4>🛍️ products 資料表</h4>
                                    <ul>
                                        <li><code>id</code> (int) - 主鍵 ID</li>
                                        <li><code>name</code> (varchar) - 商品名稱</li>
                                        <li><code>price</code> (int) - 商品價格</li>
                                        <li><code>stock</code> (int) - 庫存量</li>
                                        <li><code>category</code> (varchar) - 分類</li>
                                    </ul>
                                </div>
                            </div>
                        )}
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
                                    <p>正在連線資料庫並執行查詢，請稍候...</p>
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
