import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import PasswordInput from './PasswordInput';

const TABS = ['Lead Settings', 'Agent Settings', 'Security', 'System', 'Facebook'];

export default function AdminSettings({ user, onBack }) {
    const [activeTab, setActiveTab] = useState(0);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ text: '', type: '' });

    // Security tab state
    const [oldPw, setOldPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [displayName, setDisplayName] = useState('');

    // Facebook tab state
    const [tokenDate, setTokenDate] = useState('');
    const [tokenStatus, setTokenStatus] = useState(null);
    const [checkingToken, setCheckingToken] = useState(false);

    useEffect(() => {
        loadSettings();
        checkTokenStatus();
        // Prefill editable fields with current user values
        if (user) {
            setNewEmail(user.email || '');
            setDisplayName(user.name || '');
        }
    }, []);

    async function loadSettings() {
        setLoading(true);
        try {
            const data = await api.fetchGlobalSettings();
            setSettings(data);
            if (data.token_created_at) {
                const date = new Date(data.token_created_at).toISOString().split('T')[0];
                setTokenDate(date);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    }

    async function checkTokenStatus() {
        setCheckingToken(true);
        try {
            const status = await api.fetchTokenStatus();
            setTokenStatus(status);
        } catch (err) {
            console.error('Failed to check token status:', err);
        } finally {
            setCheckingToken(false);
        }
    }

    async function handleSetTokenCreatedAt() {
        setSaving(true);
        setMsg({ text: '', type: '' });
        try {
            const date = tokenDate ? new Date(tokenDate) : new Date();
            await api.setTokenCreatedAt(date.toISOString());
            setMsg({ text: 'Token creation date updated!', type: 'success' });
            await checkTokenStatus();
        } catch (err) {
            setMsg({ text: err.response?.data?.error || 'Failed to update token date', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMsg({ text: '', type: '' }), 3000);
        }
    }

    function updateField(key, value) {
        setSettings(prev => ({ ...prev, [key]: value }));
    }

    async function handleSaveSettings() {
        setSaving(true);
        setMsg({ text: '', type: '' });
        try {
            const updated = await api.updateGlobalSettings(settings);
            setSettings(updated);
            setMsg({ text: 'Settings saved successfully!', type: 'success' });
        } catch (err) {
            setMsg({ text: err.response?.data?.error || 'Failed to save settings', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMsg({ text: '', type: '' }), 3000);
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
            const res = await api.changeAdminPassword(user.email, oldPw, newPw, newEmail, displayName);
            if (res && res.user) {
                // Persist updated user and refresh app so header reflects new name/email
                try {
                    localStorage.setItem('leadbridge_user_v2', JSON.stringify(res.user));
                } catch (e) {}
                setMsg({ text: 'Password and profile updated successfully!', type: 'success' });
                // reload to propagate user change to parent App component
                setTimeout(() => window.location.reload(), 700);
            } else {
                setMsg({ text: res?.message || 'Password changed successfully!', type: 'success' });
            }
            setOldPw(''); setNewPw(''); setConfirmPw('');
        } catch (err) {
            setMsg({ text: err.response?.data?.error || 'Failed to change password', type: 'error' });
        } finally {
            setSaving(false);
            setTimeout(() => setMsg({ text: '', type: '' }), 3000);
        }
    }

    if (loading || !settings) {
        return (
            <div className="p-20 text-center text-gray-400">Loading settings...</div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900">Settings</h1>
                        <p className="text-sm text-gray-400">Manage your system configuration</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8">
                {TABS.map((tab, i) => (
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

            {/* ── Tab 0: Lead Settings ── */}
            {activeTab === 0 && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-6">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Lead Assignment</h2>

                    {/* Auto Assign Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-semibold text-gray-900 text-sm">Auto Assign Leads</p>
                            <p className="text-xs text-gray-400 mt-0.5">When OFF, new leads are saved as unassigned</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoAssign}
                                onChange={(e) => updateField('autoAssign', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                        </label>
                    </div>

                    {/* Assignment Strategy */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Assignment Strategy</label>
                        <select
                            value={settings.assignmentStrategy}
                            onChange={(e) => updateField('assignmentStrategy', e.target.value)}
                            className="input-field w-full"
                        >
                            <option value="ROUND_ROBIN">Round Robin — All agents equally</option>
                            <option value="TYPE_BASED">Type Based — Strict lead type matching</option>
                            <option value="HYBRID">Hybrid — Type match with fallback</option>
                        </select>
                    </div>

                    {/* Duplicate Handling */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Duplicate Lead Handling</label>
                        <select
                            value={settings.duplicateHandling}
                            onChange={(e) => updateField('duplicateHandling', e.target.value)}
                            className="input-field w-full"
                        >
                            <option value="ALLOW">Allow — Skip duplicate silently</option>
                            <option value="BLOCK">Block — Reject duplicate leads</option>
                            <option value="MERGE">Merge — Update existing with new data</option>
                        </select>
                    </div>

                    <button onClick={handleSaveSettings} disabled={saving} className="btn-primary w-full">
                        {saving ? 'Saving...' : 'Save Lead Settings'}
                    </button>
                </div>
            )}

            {/* ── Tab 1: Agent Settings ── */}
            {activeTab === 1 && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-6">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Agent Management</h2>

                    {/* Max Leads Per Agent */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Max Leads Per Agent</label>
                        <input
                            type="number"
                            min="0"
                            value={settings.maxLeadsPerAgent}
                            onChange={(e) => updateField('maxLeadsPerAgent', parseInt(e.target.value, 10) || 0)}
                            className="input-field w-full"
                            placeholder="0 = unlimited"
                        />
                        <p className="mt-1 text-xs text-gray-400">Set to 0 for unlimited. Agents at the cap won't receive new leads.</p>
                    </div>

                    {/* Auto Reassign Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <p className="font-semibold text-gray-900 text-sm">Auto Reassign</p>
                            <p className="text-xs text-gray-400 mt-0.5">Redistribute leads when agent goes unavailable or is deactivated</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.autoReassign}
                                onChange={(e) => updateField('autoReassign', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
                        </label>
                    </div>

                    <button onClick={handleSaveSettings} disabled={saving} className="btn-primary w-full">
                        {saving ? 'Saving...' : 'Save Agent Settings'}
                    </button>
                </div>
            )}

            {/* ── Tab 2: Security ── */}
            {activeTab === 2 && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-6">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Change Admin Password</h2>

                    <PasswordInput
                        value={oldPw}
                        onChange={(e) => setOldPw(e.target.value)}
                        placeholder="Enter current password"
                        label="Current Password"
                        disabled={saving}
                    />
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Display Name</label>
                        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Admin name to display" className="input-field w-full" disabled={saving} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Change Email (optional)</label>
                        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@yourdomain.com" className="input-field w-full" disabled={saving} />
                    </div>
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

            {/* ── Tab 3: System ── */}
            {activeTab === 3 && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-6">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">System Preferences</h2>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Timezone</label>
                        <select value={settings.timezone} onChange={(e) => updateField('timezone', e.target.value)} className="input-field w-full">
                            <option value="Asia/Karachi">Asia/Karachi (PKT)</option>
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                            <option value="Europe/London">Europe/London (GMT)</option>
                            <option value="America/New_York">America/New_York (EST)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                            <option value="UTC">UTC</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Date Format</label>
                        <select value={settings.dateFormat} onChange={(e) => updateField('dateFormat', e.target.value)} className="input-field w-full">
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                        </select>
                    </div>

                    <button onClick={handleSaveSettings} disabled={saving} className="btn-primary w-full">
                        {saving ? 'Saving...' : 'Save System Settings'}
                    </button>
                </div>
            )}

            {/* ── Tab 4: Facebook Integration ── */}
            {activeTab === 4 && (
                <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 space-y-6">
                    <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Facebook Token Management</h2>
                    <p className="text-sm text-gray-600">Facebook PAGE_ACCESS_TOKEN expires after approximately 60 days. Track when your token was created to know when renewal is needed.</p>

                    {/* Token Status Display */}
                    {tokenStatus && (
                        <div className={`p-4 rounded-xl border ${
                            tokenStatus.isExpired
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : tokenStatus.isExpiringSoon
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-green-50 border-green-200 text-green-700'
                        }`}>
                            <p className="font-semibold text-sm mb-1">
                                {tokenStatus.isExpired
                                    ? 'Token Expired'
                                    : tokenStatus.isExpiringSoon
                                    ? `Token Expiring Soon: ${tokenStatus.daysRemaining} day${tokenStatus.daysRemaining === 1 ? '' : 's'} remaining`
                                    : `Token Active: ${tokenStatus.daysRemaining} day${tokenStatus.daysRemaining === 1 ? '' : 's'} remaining`}
                            </p>
                            {tokenStatus.tokenCreatedAt && (
                                <p className="text-xs opacity-80">Created: {new Date(tokenStatus.tokenCreatedAt).toLocaleDateString()}</p>
                            )}
                        </div>
                    )}

                    {/* Token Date Input */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Token Creation Date</label>
                        <input
                            type="date"
                            value={tokenDate}
                            onChange={(e) => setTokenDate(e.target.value)}
                            className="input-field w-full"
                            disabled={saving || checkingToken}
                        />
                        <p className="text-xs text-gray-400 mt-1">Enter the date when the Facebook token was created. Leave empty to set to today.</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSetTokenCreatedAt}
                            disabled={saving || checkingToken}
                            className="flex-1 btn-primary"
                        >
                            {saving ? 'Updating...' : 'Update Token Date'}
                        </button>
                        <button
                            onClick={checkTokenStatus}
                            disabled={checkingToken}
                            className="flex-1 btn-secondary"
                        >
                            {checkingToken ? 'Checking...' : 'Check Status'}
                        </button>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">How to renew your token:</h3>
                        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                            <li>Go to Facebook Developers dashboard</li>
                            <li>Navigate to your App Settings</li>
                            <li>Find the PAGE_ACCESS_TOKEN in Messenger Platform settings</li>
                            <li>Generate a new token if needed</li>
                            <li>Update your PAGE_ACCESS_TOKEN in environment variables</li>
                            <li>Update the token creation date above to today's date</li>
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
}
