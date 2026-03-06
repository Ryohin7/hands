import React from 'react';
import { Link } from 'react-router-dom';

function NotFoundPage() {
    return (
        <div className="page-container" style={{ 
            textAlign: 'center', 
            padding: '100px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh'
        }}>
            <h1 style={{ 
                fontSize: '6rem', 
                color: '#007130', 
                marginBottom: '1rem',
                fontWeight: '800'
            }}>404</h1>
            <h2 style={{ 
                fontSize: '1.5rem', 
                marginBottom: '2rem',
                color: '#333'
            }}>抱歉，找不到您要尋找的頁面</h2>
            <p style={{ 
                color: '#666', 
                marginBottom: '2.5rem',
                maxWidth: '400px',
                lineHeight: '1.6'
            }}>
                您輸入的網址可能有誤，或者該頁面已經被移動或刪除。
            </p>
            <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>
                回到首頁
            </Link>
        </div>
    );
}

export default NotFoundPage;
