import React, { useEffect, useState } from 'react';
import * as api from '../services/api';

export default function TokenExpiryBanner({ onBannerHeight }) {
    const [tokenStatus, setTokenStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        checkTokenStatus();
        // Check every hour
        const interval = setInterval(checkTokenStatus, 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    async function checkTokenStatus() {
        try {
            const status = await api.fetchTokenStatus();
            setTokenStatus(status);
        } catch (err) {
            console.error('Failed to check token status:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading || !tokenStatus || dismissed) {
        if (onBannerHeight) onBannerHeight(0);
        return null;
    }

    if (!tokenStatus.isExpiringSoon && !tokenStatus.isExpired) {
        if (onBannerHeight) onBannerHeight(0);
        return null;
    }

    const isExpired = tokenStatus.isExpired;
    const daysRemaining = tokenStatus.daysRemaining || 0;

    return (
        <div
            className={`px-4 py-3 flex items-center justify-between gap-3 text-sm font-medium ${
                isExpired
                    ? 'bg-red-50 text-red-700 border-b border-red-200'
                    : 'bg-amber-50 text-amber-700 border-b border-amber-200'
            }`}
            ref={(el) => {
                if (el && onBannerHeight) {
                    onBannerHeight(el.offsetHeight);
                }
            }}
        >
            <div className="flex items-center gap-2">
                {isExpired ? (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                )}
                <span>
                    {isExpired
                        ? 'Facebook token has expired. Please renew it immediately.'
                        : `Facebook token will expire in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Please renew it soon.`}
                </span>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="text-current hover:opacity-70 transition-opacity flex-shrink-0"
                title="Dismiss"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
        </div>
    );
}
