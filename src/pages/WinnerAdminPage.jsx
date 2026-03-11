import { useState, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

function WinnerAdminPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedPostId, setExpandedPostId] = useState(null);
    const [submissions, setSubmissions] = useState({});
    const [loadingSubmissions, setLoadingSubmissions] = useState({});
    const [exporting, setExporting] = useState(false);

    // 用於隱藏渲染 PDF 名條的 DOM refs
    const printAreaRef = useRef(null);
    const [printData, setPrintData] = useState([]);

    useEffect(() => {
        fetchWinnerPosts();
    }, []);

    async function fetchWinnerPosts() {
        setLoading(true);
        try {
            // 注意：如果有複合索引問題，這裡可能會報錯
            // 所以加上 fallback 邏輯
            let q = query(
                collection(db, 'posts'),
                where('category', '==', '中獎名單公告'),
                orderBy('createdAt', 'desc')
            );

            try {
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPosts(data);
            } catch (idxErr) {
                console.warn('索引錯誤，改用 fallback 查詢:', idxErr);
                const fallbackQ = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(fallbackQ);
                const data = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(p => p.category === '中獎名單公告');
                setPosts(data);
            }
        } catch (err) {
            console.error('取得中獎名單活動失敗', err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchSubmissions(postId) {
        if (submissions[postId]) return; // 已載入過

        setLoadingSubmissions(prev => ({ ...prev, [postId]: true }));
        try {
            const q = query(
                collection(db, 'winner_submissions'),
                where('postId', '==', postId),
                orderBy('submittedAt', 'asc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubmissions(prev => ({ ...prev, [postId]: data }));
        } catch (err) {
            console.error('取得報名名單失敗:', err);
            // 處理可能有 submissionAt 索引缺失的問題
            try {
                const q2 = query(collection(db, 'winner_submissions'), where('postId', '==', postId));
                const snap2 = await getDocs(q2);
                const data = snap2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setSubmissions(prev => ({ ...prev, [postId]: data }));
            } catch (e2) {
                console.error(e2);
            }
        } finally {
            setLoadingSubmissions(prev => ({ ...prev, [postId]: false }));
        }
    }

    const toggleExpand = (postId) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
        } else {
            setExpandedPostId(postId);
            fetchSubmissions(postId);
        }
    };

    const handleExportPDF = async (postId, postTitle) => {
        const dataList = submissions[postId];
        if (!dataList || dataList.length === 0) {
            alert('目前沒有名單可匯出！');
            return;
        }

        const confirmExport = window.confirm(`將匯出 ${dataList.length} 筆名單的 A5 郵寄名條，這可能需要一點時間。確定匯出？`);
        if (!confirmExport) return;

        setExporting(true);
        // 設定要列印的資料讓隱藏 DOM 渲染
        setPrintData(dataList);

        // 等待 React 渲染 DOM (利用 setTimeout 確保 DOM 已經更新到畫面上)
        setTimeout(async () => {
            try {
                // A5 Portrait 尺寸 (mm): 148 x 210 (直式，剛好適合放兩個橫式的名條)
                // 每個名條約為 148 x 105 mm (A6 左右大小，上下疊加剛好是 A5 直式)
                // 或者維持 A5 橫式 (210 x 148)，上下各佔半頁 (210 x 74)
                // 這裡我們採用 A5 橫式 (210 x 148)，上下兩個名條，每個高度 74mm

                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a5' // 210 x 148
                });

                const nodes = printAreaRef.current.querySelectorAll('.print-label');

                // 每頁顯示兩個名條
                for (let i = 0; i < nodes.length; i += 2) {
                    const node1 = nodes[i];
                    const node2 = i + 1 < nodes.length ? nodes[i + 1] : null;

                    const canvas1 = await html2canvas(node1, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                    const imgData1 = canvas1.toDataURL('image/png');
                    pdf.addImage(imgData1, 'PNG', 0, 0, 210, 74); // 放置在上班部

                    if (node2) {
                        const canvas2 = await html2canvas(node2, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
                        const imgData2 = canvas2.toDataURL('image/png');
                        pdf.addImage(imgData2, 'PNG', 0, 74, 210, 74); // 放置在下半部
                    }

                    // 確保分隔線畫在圖片上方不被蓋住
                    if (typeof pdf.setLineDashPattern === 'function') {
                        pdf.setDrawColor(150, 150, 150);
                        pdf.setLineDashPattern([2, 2], 0);
                        pdf.line(0, 74, 210, 74);
                        pdf.setLineDashPattern([], 0); // 取消虛線設定
                    } else {
                        // 相容沒這個方法的版本
                        pdf.setDrawColor(150, 150, 150);
                        pdf.line(0, 74, 210, 74);
                    }

                    // 如果還有下一組資料才增加新頁
                    if (i + 2 < nodes.length) {
                        pdf.addPage();
                    }
                }

                pdf.save(`中獎名條_${postTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);

            } catch (error) {
                console.error('匯出 PDF 失敗:', error);
                alert('匯出 PDF 失敗，請重試！');
            } finally {
                setExporting(false);
                setPrintData([]); // 清空列印區域
            }
        }, 1000);
    };

    if (loading) {
        return (
            <div className="admin-page-content">
                <div className="loading-container">
                    <div className="loading-spinner" />
                    <p>載入中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">中獎表單查詢</h2>
            </div>

            <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>這裡列出了所有分類為「中獎名單公告」的活動，您可以點擊展開查看得獎者填寫的寄送資料，並匯出郵寄用的 A5 名條。</p>

            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>活動名稱 (公告標題)</th>
                            <th>發布日期</th>
                            <th>表單截止時間</th>
                            <th style={{ textAlign: 'right' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>目前沒有中獎活動</td>
                            </tr>
                        ) : (
                            posts.map((post) => (
                                <React.Fragment key={post.id}>
                                    <tr
                                        style={{ cursor: 'pointer', background: expandedPostId === post.id ? '#f5f5f5' : 'transparent' }}
                                        onClick={() => toggleExpand(post.id)}
                                    >
                                        <td style={{ fontWeight: 'bold' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', verticalAlign: 'middle', transform: expandedPostId === post.id ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                                <polyline points="9 18 15 12 9 6" />
                                            </svg>
                                            {post.title}
                                        </td>
                                        <td>{formatDate(post.createdAt)}</td>
                                        <td>
                                            {post.formDeadline
                                                ? (post.formDeadline.toDate ? post.formDeadline.toDate().toLocaleString() : new Date(post.formDeadline).toLocaleString())
                                                : '未設定截止'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(post.id); }}
                                            >
                                                {expandedPostId === post.id ? '收合名單' : '查看名單'}
                                            </button>
                                        </td>
                                    </tr>

                                    {expandedPostId === post.id && (
                                        <tr>
                                            <td colSpan="4" style={{ padding: 0, borderBottom: '2px solid #ddd' }}>
                                                <div style={{ background: '#fafafa', padding: '1.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: 0, color: '#007130' }}>填寫名單資料 ({submissions[post.id]?.length || 0} 筆)</h4>
                                                        {submissions[post.id] && submissions[post.id].length > 0 && (
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                onClick={() => handleExportPDF(post.id, post.title)}
                                                                disabled={exporting}
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                </svg>
                                                                {exporting ? '名條匯出中...' : '匯出名條 (A5 PDF)'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    {loadingSubmissions[post.id] ? (
                                                        <p>資料載入中...</p>
                                                    ) : submissions[post.id] && submissions[post.id].length > 0 ? (
                                                        <div style={{ overflowX: 'auto' }}>
                                                            <table className="admin-table" style={{ background: '#fff', fontSize: '0.9rem' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>社群名稱</th>
                                                                        <th>收件者</th>
                                                                        <th>電話</th>
                                                                        <th>地址</th>
                                                                        <th>填寫時間</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {submissions[post.id].map(sub => (
                                                                        <tr key={sub.id}>
                                                                            <td>{sub.communityName}</td>
                                                                            <td>{sub.recipientName}</td>
                                                                            <td>{sub.recipientPhone}</td>
                                                                            <td>{sub.zipCode} {sub.county}{sub.district}{sub.addressDetail}</td>
                                                                            <td>{formatDate(sub.submittedAt)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="empty-state" style={{ padding: '1rem', background: '#fff' }}>
                                                            尚無人填寫此表單
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* 用於匯出 PDF 的隱藏區域 (置於畫面外) */}
            <div
                ref={printAreaRef}
                style={{
                    position: 'absolute',
                    top: '-9999px',
                    left: '-9999px',
                    width: '210mm',
                }}
            >
                {printData.map((data, idx) => (
                    <div
                        key={idx}
                        className="print-label"
                        style={{
                            width: '210mm',
                            height: '74mm', // 原本148mm，現在變成一半高度
                            backgroundColor: 'white',
                            padding: '5mm 20mm', // 減小上下間距避免超出
                            boxSizing: 'border-box',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontFamily: 'sans-serif',
                            color: 'black',
                            border: '1px solid white' // 確保沒有外框
                        }}
                    >
                        {/* 第一行：寄件人資訊 */}
                        <div style={{ fontSize: '5mm', marginBottom: '8mm', width: '100%', textAlign: 'left' }}>
                            台北市松江路261號6樓 社群小編陳騏濬 02-25035508
                        </div>

                        {/* 第二行：收件地址 */}
                        <div style={{ fontSize: '8mm', marginBottom: '8mm', width: '100%', textAlign: 'left', lineHeight: '1.4' }}>
                            {data.zipCode} {data.county}{data.district}{data.addressDetail}
                        </div>

                        {/* 第三行：收件人資訊置中 */}
                        <div style={{ fontSize: '12mm', fontWeight: 'bold', width: '100%', textAlign: 'center', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '5mm' }}>
                            <span>{data.recipientName} 先生/女士 收</span>
                            <span style={{ fontSize: '5mm' }}>{data.recipientPhone}</span>
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
}

import React from 'react'; // 因為使用了 React.Fragment
export default WinnerAdminPage;
