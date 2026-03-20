import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils';

function EventAdminPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedPostId, setExpandedPostId] = useState(null);
    const [registrations, setRegistrations] = useState({});
    const [loadingRegistrations, setLoadingRegistrations] = useState({});

    useEffect(() => {
        fetchEventPosts();
    }, []);

    async function fetchEventPosts() {
        setLoading(true);
        try {
            let q = query(
                collection(db, 'posts'),
                where('category', '==', '實體活動'),
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
                    .filter(p => p.category === '實體活動');
                setPosts(data);
            }
        } catch (err) {
            console.error('取得活動列表失敗', err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchRegistrations(postId) {
        if (registrations[postId]) return;

        setLoadingRegistrations(prev => ({ ...prev, [postId]: true }));
        try {
            const q = query(
                collection(db, 'event_registrations'),
                where('postId', '==', postId),
                orderBy('submittedAt', 'asc')
            );
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRegistrations(prev => ({ ...prev, [postId]: data }));
        } catch (err) {
            console.error('取得報名名單失敗:', err);
            try {
                const q2 = query(collection(db, 'event_registrations'), where('postId', '==', postId));
                const snap2 = await getDocs(q2);
                const data = snap2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRegistrations(prev => ({ ...prev, [postId]: data }));
            } catch (e2) {
                console.error(e2);
            }
        } finally {
            setLoadingRegistrations(prev => ({ ...prev, [postId]: false }));
        }
    }

    const toggleExpand = (postId) => {
        if (expandedPostId === postId) {
            setExpandedPostId(null);
        } else {
            setExpandedPostId(postId);
            fetchRegistrations(postId);
        }
    };

    const handleUpdateStatus = async (postId, regId, newStatus) => {
        try {
            await updateDoc(doc(db, 'event_registrations', regId), {
                status: newStatus
            });
            // 更新本地狀態
            setRegistrations(prev => ({
                ...prev,
                [postId]: prev[postId].map(reg => reg.id === regId ? { ...reg, status: newStatus } : reg)
            }));
        } catch (err) {
            console.error('更新狀態失敗:', err);
            alert('更新狀態失敗');
        }
    };

    const handleDeleteRegistration = async (postId, regId, name) => {
        if (!window.confirm(`確定要刪除 ${name} 的報名資料嗎？此動作無法復原。`)) return;

        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'event_registrations', regId));
            
            // 更新本地狀態
            setRegistrations(prev => ({
                ...prev,
                [postId]: prev[postId].filter(reg => reg.id !== regId)
            }));
        } catch (err) {
            console.error('刪除失敗:', err);
            alert('刪除失敗，請重試');
        }
    };

    const handleExportPDF = async (postId, postTitle) => {
        const dataList = registrations[postId];
        if (!dataList || dataList.length === 0) {
            alert('名單為空，無法匯出');
            return;
        }

        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

        // 建立一個臨時隱藏的容器來渲染表格
        const printContainer = document.createElement('div');
        printContainer.style.position = 'fixed';
        printContainer.style.left = '-9999px';
        printContainer.style.top = '0';
        printContainer.style.width = '1000px'; // 固定寬度以獲得更好品質
        printContainer.style.padding = '40px';
        printContainer.style.background = '#fff';
        
        // 標題與內容
        printContainer.innerHTML = `
            <div style="font-family: 'PingFang TC', 'Microsoft JhengHei', sans-serif; color: #333;">
                <h2 style="text-align: center; color: #007130; margin-bottom: 20px;">${postTitle} - 報名名單</h2>
                <p style="font-size: 14px; margin-bottom: 20px; color: #666;">匯出時間：${new Date().toLocaleString()}</p>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                        <tr style="background: #f8f9fb; border-bottom: 2px solid #007130;">
                            <th style="padding: 12px 8px; text-align: left; border: 1px solid #eee;">姓名</th>
                            <th style="padding: 12px 8px; text-align: left; border: 1px solid #eee;">性別</th>
                            <th style="padding: 12px 8px; text-align: left; border: 1px solid #eee;">電話</th>
                            <th style="padding: 12px 8px; text-align: left; border: 1px solid #eee;">E-mail</th>
                            <th style="padding: 12px 8px; text-align: left; border: 1px solid #eee;">會員級別</th>
                            <th style="padding: 12px 8px; text-align: center; border: 1px solid #eee;">狀態</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dataList.map(reg => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 10px 8px; border: 1px solid #eee;">${reg.name}</td>
                                <td style="padding: 10px 8px; border: 1px solid #eee;">${reg.gender}</td>
                                <td style="padding: 10px 8px; border: 1px solid #eee;">${reg.phone}</td>
                                <td style="padding: 10px 8px; border: 1px solid #eee;">${reg.email || '-'}</td>
                                <td style="padding: 10px 8px; border: 1px solid #eee;">${reg.membershipLevel}</td>
                                <td style="padding: 10px 8px; border: 1px solid #eee; text-align: center;">${reg.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 30px; text-align: right; font-size: 12px; color: #999;">
                    總計：${dataList.length} 筆資料
                </div>
            </div>
        `;
        
        document.body.appendChild(printContainer);

        try {
            const canvas = await html2canvas(printContainer, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pageWidth - 20; // 邊距
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            // 如果一頁放不下，這裡簡化處理（實體活動通常不會上千人）
            pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
            pdf.save(`報名名單_${postTitle}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('PDF 匯出失敗:', err);
            alert('匯出失敗，請重試');
        } finally {
            document.body.removeChild(printContainer);
        }
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
                <h2 className="admin-content-title">活動報名管理</h2>
            </div>

            <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>這裡列出了所有「實體活動」的報名情形，您可以查看參加者資料並手動調整狀態。</p>

            <div className="admin-table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>活動名稱</th>
                            <th>報名人數 / 限制</th>
                            <th>截止時間</th>
                            <th style={{ textAlign: 'right' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>目前沒有實體活動</td>
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
                                        <td>
                                            {registrations[post.id]?.length || 0} / {post.registrationLimit || '無限制'}
                                        </td>
                                        <td>
                                            {post.formDeadline
                                                ? (post.formDeadline.toDate ? post.formDeadline.toDate().toLocaleString() : new Date(post.formDeadline).toLocaleString())
                                                : '未設定'}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={(e) => { e.stopPropagation(); toggleExpand(post.id); }}
                                            >
                                                {expandedPostId === post.id ? '收合' : '查看報名'}
                                            </button>
                                        </td>
                                    </tr>

                                    {expandedPostId === post.id && (
                                        <tr>
                                            <td colSpan="4" style={{ padding: 0, borderBottom: '2px solid #ddd' }}>
                                                <div style={{ background: '#fafafa', padding: '1.5rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                        <h4 style={{ margin: 0, color: '#007130' }}>詳細名單 ({registrations[post.id]?.length || 0} 筆)</h4>
                                                        {registrations[post.id] && registrations[post.id].length > 0 && (
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                onClick={() => handleExportPDF(post.id, post.title)}
                                                            >
                                                                匯出 PDF
                                                            </button>
                                                        )}
                                                    </div>

                                                    {loadingRegistrations[post.id] ? (
                                                        <p>資料載入中...</p>
                                                    ) : registrations[post.id] && registrations[post.id].length > 0 ? (
                                                        <div style={{ overflowX: 'auto' }}>
                                                            <table className="admin-table" style={{ background: '#fff', fontSize: '0.9rem' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>姓名</th>
                                                                        <th>性別</th>
                                                                        <th>手機</th>
                                                                        <th>E-mail</th>
                                                                        <th>級別</th>
                                                                        <th>狀態</th>
                                                                        <th>操作</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {registrations[post.id].map(reg => (
                                                                        <tr key={reg.id}>
                                                                            <td>{reg.name}</td>
                                                                            <td>{reg.gender}</td>
                                                                            <td>{reg.phone}</td>
                                                                            <td style={{ fontSize: '0.8rem' }}>{reg.email}</td>
                                                                            <td>{reg.membershipLevel}</td>
                                                                            <td>
                                                                                <span style={{ 
                                                                                    padding: '2px 8px', 
                                                                                    borderRadius: '4px', 
                                                                                    fontSize: '0.8rem',
                                                                                    background: reg.status === '報名成功' ? '#e8f5e9' : (reg.status === '候補' ? '#fff3e0' : '#f5f5f5'),
                                                                                    color: reg.status === '報名成功' ? '#2e7d32' : (reg.status === '候補' ? '#ef6c00' : '#666')
                                                                                }}>
                                                                                    {reg.status}
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                                <select 
                                                                                    value={reg.status} 
                                                                                    onChange={(e) => handleUpdateStatus(post.id, reg.id, e.target.value)}
                                                                                    style={{ fontSize: '0.8rem', padding: '2px' }}
                                                                                >
                                                                                    <option value="報名確認中">報名確認中</option>
                                                                                    <option value="報名成功">報名成功</option>
                                                                                    <option value="候補">候補</option>
                                                                                </select>
                                                                                <button 
                                                                                    className="btn btn-sm btn-ghost" 
                                                                                    onClick={() => handleDeleteRegistration(post.id, reg.id, reg.name)}
                                                                                    style={{ color: '#d32f2f', padding: '2px 4px' }}
                                                                                    title="刪除員資料"
                                                                                >
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    ) : (
                                                        <div className="empty-state" style={{ padding: '1rem', background: '#fff' }}>
                                                            尚無人報名
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
        </div>
    );
}

export default EventAdminPage;
