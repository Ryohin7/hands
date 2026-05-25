// Vercel Serverless Function: SQL Server Dedicated Query Test API
// Path: api/sql-test.js

import sqlserver from 'mssql';

// 固定的 SQL Server 測試連線資訊
const DEFAULT_CONFIG = {
    user: 'sa',
    password: '5/4gj65p',
    server: '192.168.180.21',
    port: 1433,
    database: 'brms_erp',
    options: {
        encrypt: true,
        trustServerCertificate: true, // 本地測試防止憑證錯誤
        connectTimeout: 8000 // 8 秒連線超時
    }
};

export default async function handler(req, res) {
    // 僅允許 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { sql } = req.body;

    // 欄位驗證
    if (!sql) {
        return res.status(400).json({ error: '缺少必要的 SQL 查詢語句。' });
    }

    let pool = null;
    try {
        // 建立與資料庫的連線池
        pool = await sqlserver.connect(DEFAULT_CONFIG);

        // 執行 SQL 查詢
        const result = await pool.request().query(sql);

        // 關閉連線
        await pool.close();

        // 解析結果
        const recordset = result.recordset || [];
        const columns = result.recordset && result.recordset.columns
            ? Object.keys(result.recordset.columns)
            : (recordset.length > 0 ? Object.keys(recordset[0]) : []);

        return res.status(200).json({
            success: true,
            message: 'SQL Server 查詢執行成功',
            columns: columns,
            rows: recordset
        });
    } catch (err) {
        if (pool) {
            try { await pool.close(); } catch (_) {}
        }
        console.error('SQL Server Test Error:', err);
        return res.status(500).json({
            success: false,
            error: `SQL Server 連線或執行失敗: ${err.message}`
        });
    }
}
