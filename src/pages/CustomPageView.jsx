import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { autoSpace } from '../utils/textUtils';
import DOMPurify from 'dompurify';

function CustomPageView() {
    const { id } = useParams();
    const [page, setPage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPage() {
            try {
                const docRef = doc(db, 'custom_pages', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().status === 'published') {
                    setPage({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (err) {
                console.error('取得頁面詳情失敗:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchPage();
    }, [id]);

    function sanitizeHtml(html) {
        if (!html) return '';
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'br', 'hr',
                'strong', 'b', 'em', 'i', 'u', 's', 'strike',
                'ul', 'ol', 'li',
                'a', 'img',
                'blockquote', 'pre', 'code', 'mark',
                'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'span', 'div', 'sub', 'sup',
            ],
            ALLOWED_ATTR: [
                'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
                'style', 'class', 'colspan', 'rowspan',
            ],
            ALLOW_DATA_ATTR: false,
        });
    }

    if (loading) return <div className="page-container">載入中...</div>;

    if (!page) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <p>找不到此頁面或已下檔</p>
                    <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        返回首頁
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <article className="post-detail">
                <div className="post-detail-header">
                    <h1 className="post-detail-title">{autoSpace(page.title)}</h1>
                </div>
                <div
                    className="post-detail-content ql-editor"
                    dangerouslySetInnerHTML={{ __html: autoSpace(sanitizeHtml(page.content)) }}
                />
            </article>
        </div>
    );
}

export default CustomPageView;
