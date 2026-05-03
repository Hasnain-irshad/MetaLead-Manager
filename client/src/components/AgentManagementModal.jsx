import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

/**
 * AgentManagementModal — Modal for adding or editing an agent.
 * Lead types are picked as toggleable chips from known leadTypes (forms +
 * form configs) so admins can confidently assign multiple types per agent
 * (e.g. ["CA", "ACCA"]).
 */
export default function AgentManagementModal({ agent, onClose, onSave }) {
    const [name, setName] = useState(agent?.name || '');
    const [email, setEmail] = useState(agent?.email || '');
    const [password, setPassword] = useState('');
    const [active, setActive] = useState(agent ? agent.active : true);
    const [leadTypes, setLeadTypes] = useState(agent?.leadTypes ? [...agent.leadTypes] : []);
    const [knownTypes, setKnownTypes] = useState([]);
    const [customType, setCustomType] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const isEdit = !!agent;

    // Pull known lead_types from forms + form configs so admin can pick from
    // a real list rather than guessing strings.
    useEffect(() => {
        (async () => {
            try {
                const [formsRes, configsRes] = await Promise.all([
                    api.fetchForms(),
                    api.fetchFormConfigs()
                ]);
                const fromForms = (formsRes.forms || []).map(f => f.lead_type).filter(Boolean);
                const fromConfigs = (configsRes.configs || []).map(c => c.lead_type).filter(Boolean);
                const merged = Array.from(new Set([...fromForms, ...fromConfigs, ...leadTypes])).sort();
                setKnownTypes(merged);
            } catch (err) {
                console.error('Failed to load lead types:', err);
            }
        })();
    }, []);

    function toggleType(t) {
        if (leadTypes.includes(t)) {
            setLeadTypes(leadTypes.filter(x => x !== t));
        } else {
            setLeadTypes([...leadTypes, t]);
        }
    }

    function addCustomType() {
        const t = customType.trim();
        if (!t) return;
        if (!leadTypes.includes(t)) setLeadTypes([...leadTypes, t]);
        if (!knownTypes.includes(t)) setKnownTypes([...knownTypes, t].sort());
        setCustomType('');
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setSaving(true);

        const agentData = { name, email, active, leadTypes };
        if (password) agentData.password = password;

        try {
            await onSave(agentData);
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Operation failed');
        } finally {
            setSaving(false);
        }
    }

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) onClose();
    }

    return (
        <div
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
        >
            <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEdit ? 'Edit Agent' : 'Add New Agent'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit}>
                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100 animate-fade-in">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter agent's name"
                                className="input-field"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="agent@example.com"
                                className="input-field"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                                {isEdit ? 'New Password (Optional)' : 'Password'}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={isEdit ? 'Leave blank to keep current' : 'Enter password'}
                                className="input-field"
                                required={!isEdit}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Lead Types (Specialization)</label>
                            <p className="text-xs text-gray-500 mb-2">Pick one or more types. Agent will receive matching leads.</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {knownTypes.length === 0 ? (
                                    <span className="text-xs text-gray-400 italic">No lead types known yet. Add one below.</span>
                                ) : knownTypes.map(t => (
                                    <button
                                        type="button"
                                        key={t}
                                        onClick={() => toggleType(t)}
                                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                                            leadTypes.includes(t)
                                                ? 'bg-primary-600 text-white border-primary-600 shadow'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        {leadTypes.includes(t) ? '✓ ' : ''}{t}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={customType}
                                    onChange={(e) => setCustomType(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomType(); } }}
                                    placeholder="Add custom type"
                                    className="input-field flex-1 text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={addCustomType}
                                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-all"
                                >
                                    + Add
                                </button>
                            </div>
                        </div>

                        {isEdit && (
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="active"
                                    checked={active}
                                    onChange={(e) => setActive(e.target.checked)}
                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <label htmlFor="active" className="text-sm font-medium text-gray-700">Account Active</label>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="btn-primary min-w-[100px]"
                        >
                            {saving ? 'Saving...' : (isEdit ? 'Update Details' : 'Create Agent')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
