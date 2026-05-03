import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function FormManagement({ onBack }) {
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState(null);
    // Per-row local edit state so we save on blur, not on every keystroke.
    const [drafts, setDrafts] = useState({});

    useEffect(() => {
        loadForms();
    }, []);

    function showMessage(type, text) {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    }

    async function loadForms() {
        setLoading(true);
        try {
            const res = await api.fetchForms();
            setForms(res.forms || []);
            setDrafts({});
        } catch (err) {
            console.error('Failed to load forms:', err);
            showMessage('error', 'Failed to load forms.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSync() {
        setSyncing(true);
        setMessage(null);
        try {
            const res = await api.syncForms();
            setForms(res.forms || []);
            setDrafts({});
            showMessage('success', 'Forms synced successfully!');
        } catch (err) {
            console.error('Failed to sync forms:', err);
            showMessage('error', 'Failed to sync forms.');
        } finally {
            setSyncing(false);
        }
    }

    async function handleSaveType(formId) {
        const original = forms.find(f => f._id === formId);
        const draft = drafts[formId];
        // No edit, or unchanged → nothing to do.
        if (draft === undefined || (original && draft === (original.lead_type || ''))) {
            return;
        }
        try {
            const res = await api.updateForm(formId, { lead_type: draft });
            setForms(forms.map(f => f._id === formId ? { ...f, lead_type: res.form?.lead_type ?? draft } : f));
            setDrafts(d => { const n = { ...d }; delete n[formId]; return n; });
            const cascade = res.leadsUpdated || 0;
            const formName = original?.form_name || 'Form';
            showMessage(
                'success',
                cascade > 0
                    ? `${formName}: lead type updated. ${cascade} existing lead${cascade === 1 ? '' : 's'} also updated.`
                    : `${formName}: lead type updated.`
            );
        } catch (err) {
            console.error('Failed to update form:', err);
            showMessage('error', 'Failed to update lead type.');
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 bg-white text-gray-500 rounded-xl hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all border border-gray-200"
                    title="Back to Dashboard"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Form Management</h2>
                    <p className="text-gray-500 text-sm mt-1">Map Facebook Lead Forms to lead types for automated routing.</p>
                </div>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 transition-all shadow-md shadow-primary-500/20 disabled:opacity-50"
                >
                    {syncing ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    )}
                    {syncing ? 'Syncing...' : 'Sync Forms'}
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading forms...</div>
                ) : forms.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        No forms found. Click "Sync Forms" to fetch from Facebook.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-bold">
                                    <th className="p-4 pl-6">Form Name</th>
                                    <th className="p-4">Form ID</th>
                                    <th className="p-4">Page ID</th>
                                    <th className="p-4 pr-6">Lead Type Mapping</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {forms.map(form => (
                                    <tr key={form._id} className="hover:bg-gray-50/50 transition-colors group text-sm">
                                        <td className="p-4 pl-6 font-semibold text-gray-900">{form.form_name}</td>
                                        <td className="p-4 text-gray-500 font-mono text-xs">{form.form_id}</td>
                                        <td className="p-4 text-gray-500 font-mono text-xs">{form.page_id || 'N/A'}</td>
                                        <td className="p-4 pr-6">
                                            <div className="relative max-w-xs">
                                                <input
                                                    type="text"
                                                    value={drafts[form._id] !== undefined ? drafts[form._id] : (form.lead_type || '')}
                                                    onChange={e => setDrafts({ ...drafts, [form._id]: e.target.value })}
                                                    onBlur={() => handleSaveType(form._id)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                                                        if (e.key === 'Escape') { setDrafts(d => { const n = { ...d }; delete n[form._id]; return n; }); e.target.blur(); }
                                                    }}
                                                    placeholder="e.g. CA, ACCA, Admission"
                                                    className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 block p-2.5 transition-all"
                                                    title="Type a lead_type and press Enter (or click outside) to save. Existing leads from this form will be re-synced."
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
