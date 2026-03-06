/**
 * 共用工具函式
 */

/**
 * 格式化日期：2025.03.05
 */
export function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}

/**
 * 格式化日期時間：2025.03.05 14:30
 */
export function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${d} ${h}:${min}`;
}

/**
 * 取得月份字串 (補零)：03
 */
export function getMonth(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return String(date.getMonth() + 1).padStart(2, '0');
}

/**
 * 取得年月字串：2025-03
 */
export function getYearMonth(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 將文章依月份分組
 */
export function groupByMonth(posts) {
    const groups = [];
    let currentYM = null;

    posts.forEach((post) => {
        const ym = getYearMonth(post.createdAt);
        if (ym !== currentYM) {
            currentYM = ym;
            groups.push({
                yearMonth: ym,
                month: getMonth(post.createdAt),
                posts: [post],
            });
        } else {
            groups[groups.length - 1].posts.push(post);
        }
    });

    return groups;
}

/**
 * 從 HTML 字串中擷取純文字摘要
 */
export function extractTextFromHtml(html, maxLength = 80) {
    if (!html) return '';
    const div = document.createElement('div');
    div.innerHTML = html;
    const text = div.textContent || div.innerText || '';
    return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}
