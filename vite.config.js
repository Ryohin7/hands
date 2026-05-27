import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/sql-test' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { sql } = JSON.parse(body);
              const mssqlModule = await import('mssql');
              const mssql = mssqlModule.default;
              
              const config = {
                user: 'sa',
                password: '5/4gj65p',
                server: '192.168.180.21',
                port: 1433,
                database: 'brms_erp',
                options: {
                  encrypt: true,
                  trustServerCertificate: true, // 允許自簽署憑證
                  connectTimeout: 8000
                }
              };

              const pool = await mssql.connect(config);
              const result = await pool.request().query(sql);
              await pool.close();

              const recordset = result.recordset || [];
              const columns = result.recordset && result.recordset.columns
                ? Object.keys(result.recordset.columns)
                : (recordset.length > 0 ? Object.keys(recordset[0]) : []);

              res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ success: true, columns, rows: recordset }));
            } catch (err) {
              console.error('Vite local SQL test error:', err);
              res.writeHead(500, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    },
    proxy: {
      '/api': {
        target: 'https://handstw.vercel.app',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
