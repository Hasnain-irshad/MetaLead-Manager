import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import * as api from '../services/api';
import LeadsTable from './LeadsTable';
import LeadModal from './LeadModal';
import AgentSettings from './AgentSettings';

const STATUS_COLORS = {
    new: '#3b82f6',          // primary-500
    contacted: '#6366f1',    // indigo-500
    interested: '#10b981',   // success
    not_interested: '#ef4444', // secondary-500
    follow_up: '#f59e0b',    // warning
    admission_done: '#8b5cf6', // purple-500
    other: '#9ca3af',          // gray-400
};

const DISPLAY_LABEL = {
    new: 'New',
    contacted: 'Contacted',
    interested: 'Interested',
    not_interested: 'Not Interested',
    follow_up: 'Follow Up',
    admission_done: 'Done',
    other: 'Other',
    not_connected: 'Not Connected'
};

export default function AgentDashboard({ user, onLogout }) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    const loadData = useCallback(async (opts = {}) => {
        const { silent = false } = opts;
        if (!silent) setLoading(true);
        try {
            const res = await api.fetchAgentLeads(user.id, { status: statusFilter });
            setLeads(res.leads || []);
        } catch (err) {
            console.error('Agent data load failed:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [user.id, statusFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Live updates — silent poll every 15s.
    useEffect(() => {
        const id = setInterval(() => { loadData({ silent: true }); }, 15000);
        return () => clearInterval(id);
    }, [loadData]);

    async function handleSave({ status, comment }) {
        if (!selected) return;
        try {
            if (status && status !== selected.status) {
                await api.updateAgentLeadStatus(user.id, selected._id, status);
            }
            if (comment) {
                await api.addAgentComment(user.id, selected._id, comment);
            }
            loadData();
            setSelected(null);
        } catch (err) {
            console.error('Save failed:', err);
        }
    }

    async function handleUpdateExtraFields(leadId, updates) {
        try {
            const updated = await api.patchAgentLeadExtraFields(user.id, leadId, updates);
            setSelected(updated);
            loadData();
        } catch (err) {
            console.error('Extra-fields save failed:', err);
            throw err;
        }
    }

    const stats = {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        interested: leads.filter(l => l.status === 'interested').length,
        not_interested: leads.filter(l => l.status === 'not_interested').length,
        follow_up: leads.filter(l => l.status === 'follow_up').length,
        closed: leads.filter(l => l.status === 'admission_done').length,
        other: leads.filter(l => l.status === 'other').length,
    };

    const chartData = [
        { name: 'New', value: stats.new, color: STATUS_COLORS.new },
        { name: 'Contacted', value: stats.contacted, color: STATUS_COLORS.contacted },
        { name: 'Interested', value: stats.interested, color: STATUS_COLORS.interested },
        { name: 'Not Interested', value: stats.not_interested, color: STATUS_COLORS.not_interested },
        { name: 'Follow Up', value: stats.follow_up, color: STATUS_COLORS.follow_up },
        { name: 'Done', value: stats.closed, color: STATUS_COLORS.admission_done },
        { name: 'Other', value: stats.other, color: STATUS_COLORS.other },
        { name: 'Not Connected', value: stats.not_connected || 0, color: STATUS_COLORS.not_connected },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-secondary-600 rounded-xl flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Agent<span className="text-secondary-600">Portal</span></h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-gray-900">{user.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Active Agent</p>
                        </div>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showSettings ? 'bg-secondary-100 text-secondary-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            title="Settings"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button onClick={onLogout} className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all">Logout</button>
                    </div>
                </div>
            </nav>

            {showSettings ? (
                <AgentSettings user={user} onBack={() => setShowSettings(false)} />
            ) : (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Agent Welcome / Quick Stats */}
                <div className="bg-white rounded-2xl p-8 shadow-card border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-8 animate-fade-in">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">My Leads Dashboard</h2>
                        <p className="text-gray-500 max-w-md">Distributing your daily task list based on assigned leads. Focus on "New" and "Interested" follow-ups today.</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
                        <QuickStat label="Assigned" value={stats.total} />
                        <QuickStat label="New" value={stats.new} color="text-primary-600" />
                        <QuickStat label="Hot" value={stats.interested} color="text-success" />
                        <QuickStat label="Closed" value={stats.closed} color="text-purple-600" />
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6 animate-fade-in">
                    <h2 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">My Performance Flow</h2>
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Content Area */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Active Inventory</h3>
                            <button
                                onClick={() => api.downloadLeadsExport('agent', user.id)}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all border border-gray-200"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Export CSV
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {['', 'new', 'contacted', 'interested', 'not_interested', 'follow_up', 'admission_done', 'other', 'not_connected'].map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full transition-all border ${statusFilter === st ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'}`}
                                >
                                    {st ? (DISPLAY_LABEL?.[st] || st.replace(/_/g, ' ')) : 'All'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                        {loading ? (
                            <div className="p-20 text-center text-gray-400">Refreshing leads...</div>
                        ) : leads.length === 0 ? (
                            <div className="p-20 text-center">
                                <p className="text-gray-400 text-sm">No leads match your current filter.</p>
                            </div>
                        ) : (
                            <LeadsTable leads={leads} onOpen={setSelected} showAgent={false} startIndex={0} />
                        )}
                    </div>
                </div>

                {selected && (
                    <LeadModal
                        lead={selected}
                        onClose={() => setSelected(null)}
                        onSave={handleSave}
                        isAdmin={false}
                        onUpdateExtraFields={handleUpdateExtraFields}
                    />
                )}
            </main>
            )}
        </div>
    );
}

function QuickStat({ label, value, color = "text-gray-900" }) {
    return (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">{label}</span>
            <span className={`text-xl font-black ${color}`}>{value || 0}</span>
        </div>
    );
}
