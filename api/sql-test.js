// Vercel Serverless Function: SQL Connection & Query Test API
// Path: api/sql-test.js

import mysql from 'mysql2/promise';
import pg from 'pg';

export default async function handler(req, res) {
    // 僅允許 POST 請求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { dbType, host, port, database, user, password, sql } = req.body;

    // 基本欄位驗證
    if (!dbType || !host || !database || !user || !sql) {
        return res.status(400).json({ error: '缺少必要的連線資訊或 SQL 查詢語句。' });
    }

    const targetDbType = dbType.toLowerCase();

    if (targetDbType === 'mysql') {
        let connection = null;
        try {
            // 建立 MySQL 連線
            connection = await mysql.createConnection({
                host: host,
                port: Number(port) || 3306,
                database: database,
                user: user,
                password: password || '',
                connectTimeout: 5000 // 5 秒連線超時
            });

            // 執行 SQL 查詢
            const [rows, fields] = await connection.query(sql);

            // 關閉連線
            await connection.end();

            // 解析欄位名稱
            const columns = fields ? fields.map(f => f.name) : (rows.length > 0 ? Object.keys(rows[0]) : []);

            return res.status(200).json({
                success: true,
                message: 'MySQL 查詢執行成功',
                columns: columns,
                rows: Array.isArray(rows) ? rows : [rows] // 確保是陣列 (UPDATE/INSERT 等可能回傳物件)
            });
        } catch (err) {
            if (connection) {
                try { await connection.end(); } catch (_) {}
            }
            console.error('MySQL Test Error:', err);
            return res.status(500).json({
                success: false,
                error: `MySQL 連線或執行失敗: ${err.message}`
            });
        }
    } else if (targetDbType === 'postgres' || targetDbType === 'postgresql') {
        let client = null;
        try {
            // 建立 PostgreSQL 連線
            client = new pg.Client({
                host: host,
                port: Number(port) || 5432,
                database: database,
                user: user,
                password: password || '',
                connectionTimeoutMillis: 5000 // 5 秒連線超時
            });

            await client.connect();

            // 執行 SQL 查詢
            const result = await client.query(sql);

            // 關閉連線
            await client.end();

            // 解析欄位與結果
            const columns = result.fields ? result.fields.map(f => f.name) : [];
            const rows = result.rows || [];

            return res.status(200).json({
                success: true,
                message: 'PostgreSQL 查詢執行成功',
                columns: columns,
                rows: rows
            });
        } catch (err) {
            if (client) {
                try { await client.end(); } catch (_) {}
            }
            console.error('PostgreSQL Test Error:', err);
            return res.status(500).json({
                success: false,
                error: `PostgreSQL 連線或執行失敗: ${err.message}`
            });
        }
    } else {
        return res.status(400).json({ error: '不支援的資料庫類型，目前僅支援 MySQL 與 PostgreSQL。' });
    }
}
