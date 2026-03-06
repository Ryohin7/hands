import React from 'react';

function FontTestPage() {
  const testText = "東急ハンズは、自ら新しい生活文化を創造する「手の力」を大切にしています。毎日を楽しく、豊かに彩るヒントや道具が、ここにはたくさんあります。あいうえお、カキクケコ、漢字の美しさをこのフォントでご確認ください。0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ.";

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">字體測試頁面</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        
        {/* 原本字體：思源黑體 */}
        <section>
          <h2 style={{ fontSize: '1rem', color: '#999', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
            目前使用的：Noto Sans TC (思源黑體) / 系統預設
          </h2>
          <div style={{ fontSize: '1.5rem', lineHeight: '1.8' }}>
            <p>{testText}</p>
            <p style={{ fontWeight: '800' }}><strong>加粗測試：{testText}</strong></p>
          </div>
        </section>

        {/* 新字體：Hiragino Sans */}
        <section>
          <h2 style={{ fontSize: '1rem', color: '#007130', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
            新字體家族測試：Hiragino Sans (W3 + W6 混合測試)
          </h2>
          <div style={{ fontSize: '1.5rem', lineHeight: '1.8', fontFamily: "'Hiragino Sans', sans-serif" }}>
            <p style={{ fontWeight: 400 }}>標準字重 (Weight 400)：{testText}</p>
            <p style={{ fontWeight: 700 }}>粗體字重 (Weight 700)：{testText}</p>
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed #ccc', fontSize: '1.2rem' }}>
              這是一段混合句子：<span style={{ fontWeight: 400 }}>這是 W3 標準細線</span>，而這部分是 <strong>W6 粗體效果</strong>（自動切換檔案）。
            </div>
          </div>
        </section>

        {/* 對比區域 */}
        <section style={{ background: '#f8f9fb', padding: '2rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>混合對比測試</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ color: '#999', fontSize: '0.8rem' }}>思源黑體：</span>
              <p style={{ fontSize: '1.25rem' }}>毎日を楽しく、豊かに彩るヒント</p>
            </div>
            <div>
              <span style={{ color: '#007130', fontSize: '0.8rem' }}>Hiragino：</span>
              <p style={{ fontSize: '1.25rem', fontFamily: "'Hiragino Sans', sans-serif" }}>毎日を楽しく、豊かに彩るヒント</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default FontTestPage;
