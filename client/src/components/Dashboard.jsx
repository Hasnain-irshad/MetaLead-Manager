import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import * as api from '../services/api';
import LeadsTable from './LeadsTable';
import LeadModal from './LeadModal';
import TokenExpiryBanner from './TokenExpiryBanner';

/* =========================================================
   Dashboard — Main page showing stats, chart, filters, and
   a leads table with modal for editing/viewing lead details.
   ========================================================= */

// Color map for status badges and chart bars
const STATUS_COLORS = {
    Pending: '#f59e0b',
    Contacted: '#3b82f6',
    Interested: '#10b981',
    'Not Interested': '#ef4444',
};

export default function Dashboard({ onLogout }) {
    // ---- State ----
    const [leads, setLeads] = useState([]);
    const [stats, setStats] = useState({ total: 0, counts: {} });
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // ---- Data fetching ----
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [leadsData, statsData] = await Promise.all([
                api.fetchLeads(),
                api.fetchStats(),
            ]);
            setLeads(leadsData || []);
            setStats(statsData || { total: 0, counts: {} });
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ---- Save handler (called from modal) ----
    async function handleSave({ status, comment }) {
        if (!selected) return;
        try {
            if (status && status !== selected.status) {
                await api.updateLeadStatus(selected._id, status);
            }
            if (comment) {
                await api.addLeadComment(selected._id, comment);
            }
            // Refresh lead + stats
            const updatedLead = await api.fetchLead(selected._id);
            setLeads((prev) => prev.map((l) => (l._id === updatedLead._id ? updatedLead : l)));
            setSelected(updatedLead);
            // Refresh stats counts
            const newStats = await api.fetchStats();
            setStats(newStats);
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save changes');
        }
    }

    // ---- Derived data ----
    const today = new Date().toDateString();
    const leadsToday = leads.filter(
        (l) => new Date(l.created_time).toDateString() === today
    ).length;

    // Chart data from stats.counts
    const chartData = Object.entries(STATUS_COLORS).map(([name, color]) => ({
        name,
        value: stats.counts?.[name] || 0,
        color,
    }));

    // Filtered leads
    const filtered = leads.filter((lead) => {
        // Search filter
        if (search) {
            const q = search.toLowerCase();
            const nameMatch = (lead.full_name || '').toLowerCase().includes(q);
            const emailMatch = (lead.email || '').toLowerCase().includes(q);
            const phoneMatch = (lead.phone_number || '').toLowerCase().includes(q);
            if (!nameMatch && !emailMatch && !phoneMatch) return false;
        }
        // Status filter
        if (statusFilter !== 'All' && lead.status !== statusFilter) return false;
        // Date range filter
        if (dateFrom) {
            const from = new Date(dateFrom);
            if (new Date(lead.created_time) < from) return false;
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            if (new Date(lead.created_time) > to) return false;
        }
        return true;
    });

    // ---- Render ----
    return (
        <div className="min-h-screen bg-gray-50">
            {/* ===== Top Navigation ===== */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-lg font-bold text-gray-900 font-display">LeadBridge</h1>
                    </div>
                    <button onClick={onLogout} className="btn-secondary text-sm flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
                        </svg>
                        Logout
                    </button>
                </div>
            </nav>

            {/* ===== Token Expiry Banner ===== */}
            <TokenExpiryBanner />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* ===== Stats Header ===== */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                    {/* Total Leads */}
                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Leads</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
                            </div>
                            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Leads Today */}
                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Leads Today</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">{leadsToday}</p>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Interested */}
                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Interested</p>
                                <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.counts?.Interested || 0}</p>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Not Interested */}
                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Not Interested</p>
                                <p className="text-3xl font-bold text-secondary-500 mt-1">{stats.counts?.['Not Interested'] || 0}</p>
                            </div>
                            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ===== Chart Section ===== */}
                <div className="bg-white rounded-xl shadow-card border border-gray-100 p-6 animate-fade-in">
                    <h2 className="text-base font-semibold text-gray-900 mb-4">Leads by Status</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} barCategoryGap="25%">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: 'rgba(59,130,246,0.05)' }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={800}>
                                    {chartData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* ===== Filters Bar ===== */}
                <div className="bg-white rounded-xl shadow-card border border-gray-100 p-4 animate-fade-in">
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search by name, email, or phone…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="input-field pl-9"
                            />
                        </div>

                        {/* Status filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input-field sm:w-44"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Interested">Interested</option>
                            <option value="Not Interested">Not Interested</option>
                        </select>

                        {/* Date from */}
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="input-field sm:w-40"
                            title="From Date"
                        />

                        {/* Date to */}
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="input-field sm:w-40"
                            title="To Date"
                        />

                        {/* Clear filters */}
                        {(search || statusFilter !== 'All' || dateFrom || dateTo) && (
                            <button
                                onClick={() => { setSearch(''); setStatusFilter('All'); setDateFrom(''); setDateTo(''); }}
                                className="btn-secondary whitespace-nowrap"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* ===== Leads Table ===== */}
                <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden animate-fade-in">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 text-gray-400">
                            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                                <path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Loading leads…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <svg className="mx-auto h-12 w-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                            </svg>
                            <p className="text-sm font-medium">No leads found</p>
                            <p className="text-xs text-gray-300 mt-1">Try adjusting your filters</p>
                        </div>
                    ) : (
                        <LeadsTable leads={filtered} onOpen={(lead) => setSelected(lead)} />
                    )}
                </div>

                {/* ===== Lead Modal ===== */}
                {selected && (
                    <LeadModal
                        lead={selected}
                        onClose={() => setSelected(null)}
                        onSave={handleSave}
                    />
                )}
            </main>
        </div>
    );
}
