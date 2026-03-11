import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { formatDate } from '../utils';
import { autoSpace } from '../utils/textUtils';
import DOMPurify from 'dompurify';
import WinnerForm from '../components/WinnerForm';

function PostDetailPage() {
    const { id } = useParams();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchPost() {
            try {
                const docRef = doc(db, 'posts', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setPost({ id: docSnap.id, ...docSnap.data() });
                }
            } catch (err) {
                console.error('取得公告詳情失敗:', err);
            } finally {
                setLoading(false);
            }
        }
        fetchPost();
    }, [id]);

    // 動態更新頁面標題與 meta description（SEO）
    useEffect(() => {
        if (post) {
            document.title = `${post.title} — 台隆手創館公告`;
            // 更新 meta description
            let metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                // 從 HTML 內容擷取純文字摘要
                const div = document.createElement('div');
                div.innerHTML = post.content || '';
                const text = (div.textContent || div.innerText || '').slice(0, 150);
                metaDesc.setAttribute('content', text);
            }
        }
        return () => {
            document.title = '台隆手創館公告';
            const metaDesc = document.querySelector('meta[name="description"]');
            if (metaDesc) {
                metaDesc.setAttribute('content', '公告系統 - 最新消息與通知');
            }
        };
    }, [post]);

    /**
     * 使用 DOMPurify 清理 HTML，允許安全的標籤與屬性
     */
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

    if (loading) {
        return (
            <div className="page-container">
                <div className="skeleton-back-link" />
                <article className="post-detail">
                    <div className="post-detail-header">
                        <div className="skeleton skeleton-tag" />
                        <div className="skeleton skeleton-title-lg" />
                        <div className="skeleton skeleton-date" />
                    </div>
                    <div className="skeleton-content">
                        <div className="skeleton skeleton-line" />
                        <div className="skeleton skeleton-line" style={{ width: '90%' }} />
                        <div className="skeleton skeleton-line" style={{ width: '75%' }} />
                        <div className="skeleton skeleton-line" />
                        <div className="skeleton skeleton-line" style={{ width: '60%' }} />
                        <div className="skeleton skeleton-line" />
                        <div className="skeleton skeleton-line" style={{ width: '85%' }} />
                    </div>
                </article>
            </div>
        );
    }

    if (!post) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <p>找不到此公告</p>
                    <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        返回首頁
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <Link to="/" className="back-link">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                返回公告列表
            </Link>

            <article className="post-detail">
                <div className="post-detail-header">
                    {post.category && (
                        <span className="post-detail-category">{post.category}</span>
                    )}
                    <h1 className="post-detail-title">{autoSpace(post.title)}</h1>
                    {post.subtitle && (
                        <h2 className="post-detail-subtitle">{autoSpace(post.subtitle)}</h2>
                    )}
                    <time className="post-detail-date">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {formatDate(post.createdAt)}
                    </time>
                </div>
                <div
                    className="post-detail-content ql-editor"
                    dangerouslySetInnerHTML={{ __html: autoSpace(sanitizeHtml(post.content)) }}
                />

                {post.category === '中獎名單公告' && <WinnerForm post={post} />}
            </article>
        </div>
    );
}

export default PostDetailPage;
