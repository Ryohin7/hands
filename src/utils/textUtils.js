/**
 * 自動在中文與英文/數字之間增加微小間距 (Hair Space)
 * 參考 pangu.js 的基本邏輯，但為了效能採用輕量化正則
 */
export const autoSpace = (html) => {
  if (!html || typeof html !== 'string') return html;

  // HTML 標籤過濾：避免在 <a href="..."> 或 <img src="..."> 標籤內部插入空格
  // 將 HTML 依標籤切開，僅處理非標籤部分的內容
  const parts = html.split(/(<[^>]+>)/g);
  const thinSpace = '\u2009'; // Thin Space (1/5 em)，比極細的 Hair Space 更明顯一些，視覺上更清晰

  return parts.map(part => {
    // 如果是 HTML 標籤，直接返回不處理
    if (part.startsWith('<')) return part;

    // 處理純文字部分：中西文字元間隙
    return part
      .replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, `$1${thinSpace}$2`)
      .replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, `$1${thinSpace}$2`);
  }).join('');
};
