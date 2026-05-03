import React, { useState } from 'react';
import * as api from '../services/api';

/**
 * LoginPage — Authenticates users against the backend.
 * Supports any seeded user (admin@leadbridge.com, agent1@leadbridge.com, etc.)
 */
export default function LoginPage({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await api.login(email, password);
            if (data.success && data.user) {
                onLogin(data.user);
            } else {
                setError('Login failed. Please check your credentials.');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Server error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-gray-900 px-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md animate-slide-up">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur rounded-2xl mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white font-display">LeadBridge</h1>
                    <p className="text-primary-200 mt-1 text-sm">Lead Management Dashboard</p>
                </div>

                <div className="bg-white rounded-2xl shadow-modal p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg animate-fade-in">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@leadbridge.com"
                                className="input-field"
                                required
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="input-field"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-2.5 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                                    <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                </svg>
                            ) : null}
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-400">
                            Demo: <span className="font-mono text-gray-500">admin@leadbridge.com</span> / <span className="font-mono text-gray-500">admin123</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
