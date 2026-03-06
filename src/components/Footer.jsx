import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

function Footer() {
    const [socialLinks, setSocialLinks] = useState({
        fb: '',
        ig: '',
        threads: ''
    });

    useEffect(() => {
        const fetchSocial = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'settings', 'social'));
                if (docSnap.exists()) {
                    setSocialLinks(docSnap.data());
                }
            } catch (err) {
                console.error('Fetch social links failed:', err);
            }
        };
        fetchSocial();
    }, []);

    return (
        <footer className="footer">
            <div className="footer-inner">
                <div className="footer-copyright">
                    Copyright © Tailung Inc. All rights reserved.
                </div>
                <div className="footer-social">
                    {socialLinks.fb && (
                        <a href={socialLinks.fb} target="_blank" rel="noopener noreferrer" className="social-icon" title="Facebook">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                            </svg>
                        </a>
                    )}
                    {socialLinks.ig && (
                        <a href={socialLinks.ig} target="_blank" rel="noopener noreferrer" className="social-icon" title="Instagram">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                            </svg>
                        </a>
                    )}
                    {socialLinks.threads && (
                        <a href={socialLinks.threads} target="_blank" rel="noopener noreferrer" className="social-icon" title="Threads">
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
