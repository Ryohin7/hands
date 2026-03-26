import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import {
    collection,
    query,
    getDocs,
    where,
    orderBy,
    limit,
    startAt,
    endAt,
    Timestamp
} from 'firebase/firestore';

function formatDate(date) {
    if (!date) return '-';
    const d = date instanceof Date ? date : date.toDate();
    const Y = d.getFullYear();
    const M = (d.getMonth() + 1).toString().padStart(2, '0');
    const D = d.getDate().toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${Y}/${M}/${D} ${h}:${m}`;
}

function ReportPage() {
    const [reportType, setReportType] = useState('coupon'); // coupon, member
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedStore, setSelectedStore] = useState('all');
    const [searchName, setSearchName] = useState('');
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);

    useEffect(() => {
        const fetchStores = async () => {
            const querySnapshot = await getDocs(query(collection(db, 'stores'), orderBy('name', 'asc')));
            setStores(querySnapshot.docs.map(doc => doc.data().name));
        };
        fetchStores();
    }, []);

    const handleSearch = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);

        try {
            const collectionName = reportType === 'coupon' ? 'coupon_requests' : 'member_actions';
            const storeField = reportType === 'coupon' ? 'storeName' : 'submittedByStore';
            const nameField = reportType === 'coupon' ? 'userName' : 'submittedByName';

            let q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));

            if (selectedStore !== 'all') {
                q = query(q, where(storeField, '==', selectedStore));
            }

            const querySnapshot = await getDocs(q);
            let results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 程式端過濾日期與名稱 (Firestore 複合查詢限制多)
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                results = results.filter(item => item.createdAt?.toDate() >= start);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                results = results.filter(item => item.createdAt?.toDate() <= end);
            }
            if (searchName.trim()) {
                const name = searchName.trim().toLowerCase();
                results = results.filter(item =>
                    (item[nameField] || '').toLowerCase().includes(name)
                );
            }

            setData(results);
        } catch (err) {
            console.error(err);
            alert('查詢失敗');
        } finally {
            setLoading(false);
        }
    };

    const formatType = (type) => {
        const types = {
            'points': '補登點數',
            'edit_phone': '手機修改',
            'edit_birthday': '生日修改',
            'delete_member': '刪除會員'
        };
        return types[type] || type;
    };

    return (
        <div className="admin-page-content">
            <div className="admin-content-header">
                <h2 className="admin-content-title">資料報表</h2>
            </div>

            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                    <button
                        className={`btn ${reportType === 'coupon' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => { setReportType('coupon'); setData([]); }}
                        style={{ flex: 1 }}
                    >
                        電子券申請
                    </button>
                    <button
                        className={`btn ${reportType === 'member' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => { setReportType('member'); setData([]); }}
                        style={{ flex: 1 }}
                    >
                        會員資料異動
                    </button>
                </div>

                <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                        <label>門市篩選</label>
                        <select className="form-control" value={selectedStore} onChange={(e) => setSelectedStore(e.target.value)}>
                            <option value="all">全部門市</option>
                            {stores.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>開始日期</label>
                        <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>結束日期</label>
                        <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>員工姓名搜尋</label>
                        <input
                            type="text"
                            className="form-control"
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            placeholder="輸入關鍵字"
                        />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '42px' }} disabled={loading}>
                            {loading ? '搜尋中...' : '執行查詢'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="card">
                <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>查詢結果 ({data.length})</h3>
                </div>
                <div className="table-responsive">
                    <table className="admin-table">
                        <thead>
                            {reportType === 'coupon' ? (
                                <tr>
                                    <th>單號</th>
                                    <th>日期</th>
                                    <th>門市</th>
                                    <th>員工</th>
                                    <th>張數</th>
                                    <th>原因</th>
                                    <th>狀態</th>
                                    <th>審核者</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th>日期</th>
                                    <th>門市</th>
                                    <th>員工</th>
                                    <th>異動類型</th>
                                    <th>會員ID</th>
                                    <th>詳細內容</th>
                                    <th>狀態</th>
                                    <th>審核者</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={reportType === 'coupon' ? 8 : 8} style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                                        無符合條件之資料
                                    </td>
                                </tr>
                            ) : (
                                data.map(item => (
                                    <tr key={item.id}>
                                        {reportType === 'coupon' ? (
                                            <>
                                                <td style={{ fontWeight: '600' }}>{item.displayId || '-'}</td>
                                                <td>{formatDate(item.createdAt)}</td>
                                                <td style={{ fontWeight: 500 }}>{item.storeName || '未設定'}</td>
                                                <td>{item.userName}</td>
                                                <td>{item.quantityRequested}</td>
                                                <td>{item.reason || '-'}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{formatDate(item.createdAt)}</td>
                                                <td style={{ fontWeight: 500 }}>{item.submittedByStore || '未設定'}</td>
                                                <td>{item.submittedByName}</td>
                                                <td>{formatType(item.type)}</td>
                                                <td>{item.memberId}</td>
                                                <td>{item.detail}</td>
                                            </>
                                        )}
                                        <td>
                                            <span className={`tag tag-${item.status}`}>
                                                {item.status === 'pending' ? '待審核' : item.status === 'approved' ? '已核准' : '已駁回'}
                                            </span>
                                        </td>
                                        <td>
                                            {item.status !== 'pending' ? (item.reviewedByName || item.approvedByName || item.rejectedByName || '管理員') : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default ReportPage;
