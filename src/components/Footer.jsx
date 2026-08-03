import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function Footer() {
    const location = useLocation();
    const [settings, setSettings] = useState({
        fb: '',
        ig: '',
        threads: '',
        footerCopyright: 'Copyright © Tailung Capital Inc. All rights reserved.'
    });
    const [isKatsuyaMode, setIsKatsuyaMode] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'site'));
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (err) {
                console.error('Fetch footer settings failed:', err);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        if (location.pathname === '/katsuya') {
            setIsKatsuyaMode(true);
        } else if (!location.pathname.startsWith('/post/')) {
            setIsKatsuyaMode(false);
        }
    }, [location.pathname]);

    useEffect(() => {
        const handleKatsuyaEvent = (e) => {
            setIsKatsuyaMode(!!e.detail);
        };
        window.addEventListener('katsuyaModeChange', handleKatsuyaEvent);
        return () => window.removeEventListener('katsuyaModeChange', handleKatsuyaEvent);
    }, []);

    return (
        <footer className="footer" style={isKatsuyaMode ? { backgroundColor: '#e47f21' } : undefined}>
            <div className="footer-inner">
                <div className="footer-copyright">
                    {settings.footerCopyright}
                </div>
                <div className="footer-social">
                    {settings.fb && (
                        <a href={settings.fb} target="_blank" rel="noopener noreferrer" className="social-icon" title="Facebook">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                            </svg>
                        </a>
                    )}
                    {settings.ig && (
                        <a href={settings.ig} target="_blank" rel="noopener noreferrer" className="social-icon" title="Instagram">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                            </svg>
                        </a>
                    )}
                    {settings.threads && (
                        <a href={settings.threads} target="_blank" rel="noopener noreferrer" className="social-icon" title="Threads">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="4" />
                                <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
                            </svg>
                        </a>
                    )}
                </div>
            </div>
        </footer>
    );
}

export default Footer;
