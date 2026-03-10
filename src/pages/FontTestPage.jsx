import React from 'react';

function FontTestPage() {
  const testText = "東急手創館極為重視能創造出嶄新生活文化的「雙手之力」。在這裡，充滿了許多能讓每一天都變得更為愉快、更添豐富色彩的靈感與實用工具。請透過這個字體，親自感受繁體漢字所蘊含的美感與細膩線條。0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ.";

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
            原新字體測試：Hiragino Sans (W3 + W6 混合測試)
          </h2>
          <div style={{ fontSize: '1.5rem', lineHeight: '1.8', fontFamily: "'Hiragino Sans', sans-serif" }}>
            <p style={{ fontWeight: 400 }}>標準字重 (Weight 400)：{testText}</p>
            <p style={{ fontWeight: 700 }}>粗體字重 (Weight 700)：{testText}</p>
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed #ccc', fontSize: '1.2rem' }}>
              這是一段混合句子：<span style={{ fontWeight: 400 }}>這是 W3 標準細線</span>，而這部分是 <strong>W6 粗體效果</strong>（自動切換檔案）。
            </div>
          </div>
        </section>

        {/* Apple 蘋方字體 (PingFang TC) */}
        <section>
          <h2 style={{ fontSize: '1rem', color: '#2980b9', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
            Apple 蘋方測試：PingFang TC (Regular, Medium, Semibold)
          </h2>
          <div style={{ fontSize: '1.5rem', lineHeight: '1.8', fontFamily: "'PingFang TC', sans-serif" }}>
            <p style={{ fontWeight: 400 }}>標準字重 (Regular 400)：{testText}</p>
            <p style={{ fontWeight: 500 }}>中黑字重 (Medium 500)：{testText}</p>
            <p style={{ fontWeight: 600 }}>半黑字重 (Semibold 600)：{testText}</p>
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed #ccc', fontSize: '1.2rem' }}>
              這是一段混合句子：<span style={{ fontWeight: 400 }}>這是 400 標準細線</span>，搭配 <span style={{ fontWeight: 500 }}>500 中黑效果</span>，而這部分是 <span style={{ fontWeight: 600 }}>600 半黑粗體</span>。
            </div>
          </div>
        </section>

        {/* 對比區域 */}
        <section style={{ background: '#f8f9fb', padding: '2rem', borderRadius: '8px' }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>綜合對比測試 (大字體標題)</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <span style={{ color: '#999', fontSize: '0.8rem' }}>系統預設 (思源黑體)：</span>
              <p style={{ fontSize: '1.75rem', fontWeight: 600 }}>讓每天變得更快樂的靈感與工具</p>
            </div>
            <div>
              <span style={{ color: '#007130', fontSize: '0.8rem' }}>Hiragino (W6)：</span>
              <p style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: "'Hiragino Sans', sans-serif" }}>讓每天變得更快樂的靈感與工具</p>
            </div>
            <div>
              <span style={{ color: '#2980b9', fontSize: '0.8rem' }}>PingFang TC (Semibold)：</span>
              <p style={{ fontSize: '1.75rem', fontWeight: 600, fontFamily: "'PingFang TC', sans-serif" }}>讓每天變得更快樂的靈感與工具</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default FontTestPage;
