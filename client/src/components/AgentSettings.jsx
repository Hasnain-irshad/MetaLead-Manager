import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import PasswordInput from './PasswordInput';

export default function AgentSettings({ user, onBack }) {
    const [profile, setProfile] = useState({ name: '', email: '', workStatus: 'AVAILABLE' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ text: '', type: '' });
    const [activeTab, setActiveTab] = useState(0);

    // Password state
    const [oldPw, setOldPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        setLoading(true);
        try {
            const data = await api.fetchAgentSettings(user.id);
            setProfile({ name: data.name, email: data.email, workStatus: data.workStatus || 'AVAILABLE' });
        } catch (err) {
            console.error('Failed to load agent settings:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveProfile() {
        setSaving(true);
        setMsg({ text: '', type: '' });
        try {
            const updated = await api.updateAgentSettings(user.id, profile);
            setProfile({ name: updated.name, email: updated.email, workStatus: updated.workStatus || 'AVAILABLE' });

            const c = updated.cascade;
            if (c && c.kind === 'unassign' && c.unassignedCount > 0) {
                const tail = c.reassignedCount > 0
                    ? `${c.reassignedCount} were re-routed automatically.`
                    : 'They are now in the unassigned pool — admin will redistribute.';
                setMsg({ text: `You're offline. ${c.unassignedCount} lead(s) unassigned. ${tail}`, type: 'success' });
            } else if (c && c.kind === 'restore' && c.restoredCount > 0) {
                setMsg({ text: `Welcome back! ${c.restoredCount} of your lead(s) have been restored to you.`, type: 'success' });
            } else if (profile.workStatus === 'BUSY') {
                setMsg({ text: 'Status set to Busy. You\'ll stop receiving new leads but keep your current ones.', type: 'success' });
            } else {
                setMsg({ text: 'Profile updated successfully!', type: 'success' });
            }
        } catch (err) {
            setMsg({ text: err.response?.data?.error || 'Failed to update profile', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMsg({ text: '', type: '' }), 5000);
        }
    }

    async function handleChangePassword() {
        if (newPw !== confirmPw) {
            setMsg({ text: 'New passwords do not match', type: 'error' });
            return;
        }
        if (newPw.length < 4) {
            setMsg({ text: 'Password must be at least 4 characters', type: 'error' });
            return;
        }
        setSaving(true);
        setMsg({ text: '', type: '' });
        try {
            await api.changeAgentPassword(user.id, oldPw, newPw);
            setMsg({ text: 'Password changed successfully!', type: 'success' });
            setOldPw(''); setNewPw(''); setConfirmPw('');
        } catch (err) {
            setMsg({ text: err.response?.data?.error || 'Failed to change password', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMsg({ text: '', type: '' }), 3000);
        }
    }

    const STATUS_STYLES = {
        AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        BUSY: 'bg-amber-50 text-amber-700 border-amber-200',
        OFFLINE: 'bg-gray-100 text-gray-500 border-gray-200',
    };

    if (loading) {
        return <div className="p-20 text-center text-gray-400">Loading settings...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">My Settings</h1>
                        <p className="text-sm text-gray-400">Update your profile and preferences</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8">
                {['Profile & Status', 'Security'].map((tab, i) => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(i); setMsg({ text: '', type: '' }); }}
                        className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeTab === i
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Messages */}
            {msg.text && (
                <div className={`mb-6 p-3 rounded-xl text-sm font-medium animate-fade-in ${msg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                    {msg.text}
                </div>
            )}

            {/* ── Tab 0: Profile & Work Status ── */}
            {activeTab === 0 && (
                <div className="space-y-6">
                    {/* Profile Card */}
                    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-5">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Profile Information</h2>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Full Name</label>
                            <input
                                type="text"
                                value={profile.name}
                                onChange={(e) => setProfile(p => ({ ...p, name: e.target.value }))}
                                className="input-field w-full"
                                placeholder="Your name"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Email Address</label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={(e) => setProfile(p => ({ ...p, email: e.target.value }))}
                                className="input-field w-full"
                                placeholder="Your email"
                            />
                        </div>
                    </div>

                    {/* Work Status Card */}
                    <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-5">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Work Status</h2>
                        <p className="text-xs text-gray-400">Pick the state that matches what you're doing right now.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { key: 'AVAILABLE', icon: '🟢', label: 'Available', hint: 'Receive new leads. Restored leads return here.' },
                                { key: 'BUSY',      icon: '🟡', label: 'Busy',      hint: 'No new leads, but keep current ones. Use for short breaks / meetings.' },
                                { key: 'OFFLINE',   icon: '⚫', label: 'Offline',   hint: 'Going away (vacation / EOD). Your leads get unassigned for redistribution.' }
                            ].map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => setProfile(p => ({ ...p, workStatus: s.key }))}
                                    className={`p-4 rounded-xl border-2 text-left transition-all ${profile.workStatus === s.key
                                        ? STATUS_STYLES[s.key] + ' border-current ring-2 ring-offset-2 ' + (s.key === 'AVAILABLE' ? 'ring-emerald-300' : s.key === 'BUSY' ? 'ring-amber-300' : 'ring-gray-300')
                                        : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-lg">{s.icon}</span>
                                        <span className="text-xs font-bold uppercase">{s.label}</span>
                                    </div>
                                    <p className="text-[11px] leading-snug opacity-80">{s.hint}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button onClick={handleSaveProfile} disabled={saving} className="btn-primary w-full">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {/* ── Tab 1: Security ── */}
            {activeTab === 1 && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-6">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Change Password</h2>

                    <PasswordInput
                        value={oldPw}
                        onChange={(e) => setOldPw(e.target.value)}
                        placeholder="Enter current password"
                        label="Current Password"
                        disabled={saving}
                    />
                    <PasswordInput
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="Enter new password"
                        label="New Password"
                        disabled={saving}
                    />
                    <PasswordInput
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Re-enter new password"
                        label="Confirm New Password"
                        disabled={saving}
                    />

                    <button onClick={handleChangePassword} disabled={saving || !oldPw || !newPw} className="btn-primary w-full">
                        {saving ? 'Updating...' : 'Update Password'}
                    </button>
                </div>
            )}
        </div>
    );
}
