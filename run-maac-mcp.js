import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 獲取 __dirname (ESM 環境)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 手動解析 .env (避免依賴 dotenv)
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return {};
    
    const env = {};
    const content = fs.readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            // 移除可能的外層引號
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            env[key] = val;
        }
    }
    return env;
}

const envVars = loadEnv();
const apiKey = envVars.MAACGO_API_KEY || process.env.MAACGO_API_KEY;

if (!apiKey) {
    console.error('\x1b[31m%s\x1b[0m', '【錯誤】未能在 .env 檔案中找到 MAACGO_API_KEY。');
    console.error('請先在專案根目錄的 .env 中配置：MAACGO_API_KEY=您的金鑰');
    process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', '🚀 正在啟動 MAAC Go MCP Server...');
console.log(`金鑰載入成功: ${apiKey.slice(0, 10)}... (Live Key)`);

// 根據作業系統決定 npx 指令
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const child = spawn(npxCmd, ['-y', '@maacgo/mcp'], {
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        MAACGO_API_KEY: apiKey
    }
});

child.on('error', (err) => {
    console.error('\x1b[31m%s\x1b[0m', '啟動 MCP 伺服器時發生錯誤:', err.message);
});

child.on('close', (code) => {
    console.log(`MAAC Go MCP Server 已關閉，退出代碼: ${code}`);
    process.exit(code);
});
