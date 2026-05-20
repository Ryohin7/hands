# MAAC Go MCP Server 配置指引

本專案已整合 **MAAC (Cresclab SMS)** 的 Model Context Protocol (MCP) 伺服器支援。這可以讓您的 AI 助手（例如 Cursor、Claude Desktop、Windsurf）直接具備發送簡訊、建立排程與查詢狀態的能力！

---

## 🛠️ 在 IDE / AI 工具中配置

請根據您使用的工具，將以下配置新增到對應的設定檔中。

### 1. Cursor 配置

在 Cursor 中，您可以直接在 **Settings -> Features -> MCP** 中新增一個 MCP 伺服器：

- **Name**: `maacgo`
- **Type**: `command`
- **Command**: `npx -y @maacgo/mcp`
- **Environment Variables**:
  - Key: `MAACGO_API_KEY`
  - Value: `sk_live_XoKjRX-LwSKS3gig0PmK7iO1MXod9UYH`

### 2. Claude Desktop 配置

編輯 Claude Desktop 的設定檔（通常位於 `%APPDATA%\Roaming\Claude\claude_desktop_config.json` 或 `~/Library/Application Support/Claude/claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "maacgo": {
      "command": "npx",
      "args": [
        "-y",
        "@maacgo/mcp"
      ],
      "env": {
        "MAACGO_API_KEY": "sk_live_XoKjRX-LwSKS3gig0PmK7iO1MXod9UYH"
      }
    }
  }
}
```

---

## 🚀 本地獨立啟動（用於測試或 stdio 互動）

本專案在 `package.json` 中加入了專門的啟動指令。在執行前，請確保根目錄的 `.env` 檔案中已設定 `MAACGO_API_KEY`。

在專案目錄下執行：

```bash
npm run maac-mcp
```

這將會跨平台啟動 MCP Server 並與系統的 `stdin` 和 `stdout` 綁定，供開發調試使用。
