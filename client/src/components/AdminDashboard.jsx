import React, { useEffect, useState, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import * as api from '../services/api';
import LeadsTable from './LeadsTable';
import LeadModal from './LeadModal';
import AgentManagementModal from './AgentManagementModal';
import AdminSettings from './AdminSettings';
import FormManagement from './FormManagement';
import FieldMappingAdmin from './FieldMappingAdmin';
import FormBuilder from './FormBuilder';
import ImportHistory from './ImportHistory';
import ImportLeadsModal from './ImportLeadsModal';

const STATUS_COLORS = {
    new: '#3b82f6',          // primary-500
    contacted: '#6366f1',    // indigo-500
    interested: '#10b981',   // success
    not_interested: '#ef4444', // secondary-500
    follow_up: '#f59e0b',    // warning
    admission_done: '#8b5cf6', // purple-500
    other: '#9ca3af',          // gray-400
    not_connected: '#9ca3af'
};

export default function AdminDashboard({ user, onLogout }) {
    const [leads, setLeads] = useState([]);
    const [agents, setAgents] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
    const [agentToEdit, setAgentToEdit] = useState(null);
    const [showAgentModal, setShowAgentModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showForms, setShowForms] = useState(false);
    const [showFieldMapping, setShowFieldMapping] = useState(false);
    const [showFormBuilder, setShowFormBuilder] = useState(false);
    const [showImportHistory, setShowImportHistory] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [bulkAssignLoading, setBulkAssignLoading] = useState(false);
    const [notification, setNotification] = useState('');

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [formFilter, setFormFilter] = useState('');
    const [leadTypeFilter, setLeadTypeFilter] = useState('');
    // Primary scope: '' = all, 'unassigned', 'assigned'.
    // Sits above the secondary filters as the dashboard's main "lens".
    const [assignmentScope, setAssignmentScope] = useState('');

    // Known lead types (for filter dropdown), pulled from forms + form configs.
    const [knownLeadTypes, setKnownLeadTypes] = useState([]);
    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

    // Agent picker for "Assign Selected To Agent"
    const [pickAgentId, setPickAgentId] = useState('');

    const loadData = useCallback(async (opts = {}) => {
        const { silent = false } = opts;
        if (!silent) setLoading(true);
        try {
            const [leadsRes, statsRes, agentsRes] = await Promise.all([
                api.fetchAdminLeads({
                    search,
                    status: statusFilter,
                    form_id: formFilter,
                    lead_type: leadTypeFilter,
                    assignment: assignmentScope,
                    page,
                    limit
                }),
                api.fetchAdminStats(),
                api.fetchAdminAgents()
            ]);
            setLeads(leadsRes.leads || []);
            setPagination(leadsRes.pagination || { total: 0, page: 1, limit, totalPages: 0 });
            setStats(statsRes || {});
            setAgents(agentsRes.agents || []);
            // Only clear selections on explicit refresh — a silent poll
            // mid-bulk-action would yank the admin's checkboxes away.
            if (!silent) setSelectedLeadIds(new Set());
        } catch (err) {
            console.error('Admin data load failed:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [search, statusFilter, formFilter, leadTypeFilter, assignmentScope, page, limit]);

    // Reload when page or limit change
    useEffect(() => {
        loadData();
    }, [page, limit]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Live updates — silent poll every 15s. Open modals are unaffected
    // because their state is local; only the table & stats refresh.
    useEffect(() => {
        const id = setInterval(() => { loadData({ silent: true }); }, 15000);
        return () => clearInterval(id);
    }, [loadData]);

    // Load known lead types once on mount.
    useEffect(() => {
        (async () => {
            try {
                const [formsRes, configsRes] = await Promise.all([
                    api.fetchForms(),
                    api.fetchFormConfigs()
                ]);
                const fromForms = (formsRes.forms || []).map(f => f.lead_type).filter(Boolean);
                const fromConfigs = (configsRes.configs || []).map(c => c.lead_type).filter(Boolean);
                const merged = Array.from(new Set([...fromForms, ...fromConfigs])).sort();
                setKnownLeadTypes(merged);
            } catch (err) {
                console.error('Failed to load lead types:', err);
            }
        })();
    }, []);

    async function handleSave({ status, comment }) {
        if (!selected) return;
        try {
            if (status && status !== selected.status) {
                // Use admin endpoint to update lead status
                await api.updateAdminLeadStatus(selected._id, status);
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

    async function handleReassign(leadId, agentId) {
        try {
            await api.reassignLead(leadId, agentId);
            loadData();
        } catch (err) {
            console.error('Reassignment failed:', err);
        }
    }

    async function handleUpdateExtraFields(leadId, updates) {
        try {
            const updated = await api.patchAdminLeadExtraFields(leadId, updates);
            // Refresh the open modal with the saved lead
            setSelected(updated);
            loadData();
        } catch (err) {
            console.error('Extra-fields save failed:', err);
            throw err;
        }
    }

    async function handleAgentSave(agentData) {
        try {
            if (agentToEdit) {
                await api.updateAgent(agentToEdit._id, agentData);
            } else {
                await api.createAgent(agentData);
            }
            loadData();
            setShowAgentModal(false);
            setAgentToEdit(null);
        } catch (err) {
            throw err; // pass to modal for error display
        }
    }

    async function handleDeleteAgent(agentId, agentName) {
        if (!window.confirm(`Are you sure you want to delete agent "${agentName}"? This will unassign all their leads.`)) return;
        try {
            await api.deleteAgent(agentId);
            loadData();
        } catch (err) {
            console.error('Deletion failed:', err);
            alert('Failed to delete agent');
        }
    }

    async function handleBulkAssign() {
        if (!window.confirm('Assign all unassigned leads according to the selected strategy?')) return;

        setBulkAssignLoading(true);
        try {
            const result = await api.bulkAssignUnassigned();
            setNotification(`✓ ${result.assignedCount} leads assigned${result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}`);
            loadData();
            setTimeout(() => setNotification(''), 4000);
        } catch (err) {
            setNotification(`✗ Error: ${err.message}`);
            setTimeout(() => setNotification(''), 4000);
        } finally {
            setBulkAssignLoading(false);
        }
    }

    async function handleDeleteLead(leadId, leadName) {
        if (!window.confirm(`Are you sure you want to delete the lead "${leadName}"?`)) return;
        try {
            await api.deleteLead(leadId);
            setNotification(`✓ Lead "${leadName}" deleted successfully`);
            loadData();
            setTimeout(() => setNotification(''), 4000);
        } catch (err) {
            setNotification(`✗ Error: Failed to delete lead`);
            setTimeout(() => setNotification(''), 4000);
            console.error('Delete failed:', err);
        }
    }

    function handleSelectLead(leadId, isSelected) {
        const newSelected = new Set(selectedLeadIds);
        if (isSelected) {
            newSelected.add(leadId);
        } else {
            newSelected.delete(leadId);
        }
        setSelectedLeadIds(newSelected);
    }

    async function handleBulkDeleteSelected() {
        if (selectedLeadIds.size === 0) {
            setNotification('No leads selected');
            setTimeout(() => setNotification(''), 3000);
            return;
        }

        if (!window.confirm(`Delete ${selectedLeadIds.size} selected leads? This cannot be undone.`)) return;

        setBulkAssignLoading(true);
        try {
            const result = await api.bulkDeleteLeads(Array.from(selectedLeadIds));
            setNotification(`✓ ${result.deletedCount} leads deleted`);
            setSelectedLeadIds(new Set());
            loadData();
            setTimeout(() => setNotification(''), 4000);
        } catch (err) {
            setNotification(`✗ Error: Failed to delete leads`);
            setTimeout(() => setNotification(''), 4000);
            console.error('Bulk delete failed:', err);
        } finally {
            setBulkAssignLoading(false);
        }
    }

    async function handleSelectAllMatching() {
        try {
            const res = await api.fetchAdminLeadIds({
                search,
                status: statusFilter,
                form_id: formFilter,
                lead_type: leadTypeFilter,
                assignment: assignmentScope
            });
            const ids = res.ids || [];
            setSelectedLeadIds(new Set(ids));
            setNotification(`✓ Selected ${ids.length} leads matching current filters`);
            setTimeout(() => setNotification(''), 4000);
        } catch (err) {
            console.error('Select all matching failed:', err);
            setNotification('✗ Error: Failed to select all');
            setTimeout(() => setNotification(''), 4000);
        }
    }

    async function handleAssignSelectedToAgent() {
        if (selectedLeadIds.size === 0) {
            setNotification('No leads selected');
            setTimeout(() => setNotification(''), 3000);
            return;
        }
        if (!pickAgentId) {
            setNotification('Pick an agent first');
            setTimeout(() => setNotification(''), 3000);
            return;
        }
        const targetAgent = agents.find(a => a._id === pickAgentId);
        const agentLabel = targetAgent ? targetAgent.name : 'selected agent';
        if (!window.confirm(`Assign ${selectedLeadIds.size} selected leads to ${agentLabel}?`)) return;

        setBulkAssignLoading(true);
        try {
            const result = await api.bulkAssignLeadsToAgent(Array.from(selectedLeadIds), pickAgentId);
            setNotification(`✓ ${result.assignedCount} leads assigned to ${result.agent.name}`);
            setSelectedLeadIds(new Set());
            setPickAgentId('');
            loadData();
            setTimeout(() => setNotification(''), 4000);
        } catch (err) {
            console.error('Assign-to-agent failed:', err);
            setNotification(`✗ Error: ${err.response?.data?.error || 'Failed to assign'}`);
            setTimeout(() => setNotification(''), 4000);
        } finally {
            setBulkAssignLoading(false);
        }
    }

    async function handleBulkReassignSelected() {
        if (selectedLeadIds.size === 0) {
            setNotification('No leads selected');
            setTimeout(() => setNotification(''), 3000);
            return;
        }

        if (!window.confirm(`Reassign ${selectedLeadIds.size} selected leads according to the strategy?`)) return;

        setBulkAssignLoading(true);
        try {
            const result = await api.bulkReassignLeads(Array.from(selectedLeadIds));
            setNotification(`✓ ${result.reassignedCount} leads reassigned${result.failedCount > 0 ? `, ${result.failedCount} failed` : ''}`);
            setSelectedLeadIds(new Set());
            loadData();
            setTimeout(() => setNotification(''), 4000);
        } catch (err) {
            setNotification(`✗ Error: Failed to reassign leads`);
            setTimeout(() => setNotification(''), 4000);
            console.error('Bulk reassign failed:', err);
        } finally {
            setBulkAssignLoading(false);
        }
    }

    const chartData = [
        { name: 'New', value: stats.new_leads || 0, color: STATUS_COLORS.new },
        { name: 'Contacted', value: stats.contacted_leads || 0, color: STATUS_COLORS.contacted },
        { name: 'Interested', value: stats.interested_leads || 0, color: STATUS_COLORS.interested },
        { name: 'Not Interested', value: stats.not_interested_leads || 0, color: STATUS_COLORS.not_interested },
        { name: 'Follow Up', value: stats.follow_up_leads || 0, color: STATUS_COLORS.follow_up },
        { name: 'Done', value: stats.admission_done || 0, color: STATUS_COLORS.admission_done },
        { name: 'Other', value: stats.other_leads || 0, color: STATUS_COLORS.other },
            { name: 'Not Connected', value: stats.not_connected_leads || 0, color: STATUS_COLORS.not_connected },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Admin<span className="text-primary-600">Bridge</span></h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-500 hidden sm:inline">Hello, {user.name}</span>
                        <button
                            onClick={() => { setShowForms(!showForms); setShowSettings(false); setShowFieldMapping(false); setShowFormBuilder(false); setShowImportHistory(false); }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showForms ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            title="Form Management"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { setShowFieldMapping(!showFieldMapping); setShowForms(false); setShowSettings(false); setShowFormBuilder(false); setShowImportHistory(false); }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showFieldMapping ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            title="Field Mapping"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { setShowFormBuilder(!showFormBuilder); setShowForms(false); setShowSettings(false); setShowFieldMapping(false); setShowImportHistory(false); }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showFormBuilder ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            title="Form Builder"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm4 4h8m-8 4h5" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { setShowImportHistory(!showImportHistory); setShowForms(false); setShowSettings(false); setShowFieldMapping(false); setShowFormBuilder(false); }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showImportHistory ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            title="Import History"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2a4 4 0 014-4h6m-3-3l3 3-3 3M9 5H5a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-4" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { setShowSettings(!showSettings); setShowForms(false); setShowFieldMapping(false); setShowFormBuilder(false); setShowImportHistory(false); }}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${showSettings ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            title="Settings"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button onClick={onLogout} className="px-3 py-1.5 text-xs font-bold text-secondary-600 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Logout</button>
                    </div>
                </div>
            </nav>

            {showSettings ? (
                <AdminSettings user={user} onBack={() => setShowSettings(false)} />
            ) : showForms ? (
                <FormManagement onBack={() => setShowForms(false)} />
            ) : showFieldMapping ? (
                <FieldMappingAdmin onBack={() => setShowFieldMapping(false)} />
            ) : showFormBuilder ? (
                <FormBuilder onBack={() => setShowFormBuilder(false)} />
            ) : showImportHistory ? (
                <ImportHistory onBack={() => setShowImportHistory(false)} onChange={loadData} />
            ) : (
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
                {/* Stats Tiles */}
                <section>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
                        <StatCard label="Total Leads" value={stats.total_leads} icon="leads" />
                        <StatCard label="New Leads" value={stats.new_leads} icon="new" color="text-primary-600" />
                        <StatCard label="Interested" value={stats.interested_leads} icon="interested" color="text-success" />
                        <StatCard label="Admissions" value={stats.admission_done} icon="done" color="text-purple-600" />
                    </div>
                </section>

                {/* Chart & Summary */}
                <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-gray-100 p-6">
                        <h2 className="text-sm font-bold text-gray-900 mb-6 uppercase tracking-wider">Conversion Pipeline</h2>
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
                    <div className="bg-primary-600 rounded-2xl p-6 text-white flex flex-col justify-between shadow-xl shadow-primary-500/20">
                        <div>
                            <h3 className="text-lg font-bold mb-2">Agent Performance</h3>
                            <p className="text-primary-100 text-sm leading-relaxed">Manage your {agents.length || 0} active agents and monitor lead distribution across {stats.total_leads || 0} leads.</p>
                        </div>
                        <div className="space-y-3 mt-8 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                            {agents.map(a => (
                                <div key={a._id} className="flex items-center justify-between text-xs bg-white/10 p-2 rounded-lg">
                                    <span className="font-semibold truncate max-w-[120px]">{a.name}</span>
                                    <span className={`px-2 py-0.5 rounded uppercase font-bold ${a.active ? 'bg-white/20' : 'bg-red-500/40 text-red-100'}`}>
                                        {a.active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Agent Management Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Agent Management</h2>
                        <button
                            onClick={() => { setAgentToEdit(null); setShowAgentModal(true); }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-xs font-bold hover:bg-primary-700 transition-all shadow-md shadow-primary-500/10"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            Add New Agent
                        </button>
                    </div>
                    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden overflow-x-auto">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                            <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                                Live availability — refreshes when you reload data
                            </span>
                            <button
                                onClick={loadData}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-gray-500 rounded-lg text-[10px] font-bold hover:text-gray-700 border border-gray-200"
                                title="Refresh agent list"
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </button>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Lead Types</th>
                                    <th>Account</th>
                                    <th>Availability</th>
                                    <th className="text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agents.map(a => {
                                    const ws = a.workStatus || 'AVAILABLE';
                                    const wsBadge =
                                        ws === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        ws === 'BUSY' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-gray-100 text-gray-500 border-gray-200';
                                    const wsDot =
                                        ws === 'AVAILABLE' ? 'bg-emerald-500' :
                                        ws === 'BUSY' ? 'bg-amber-500' :
                                        'bg-gray-400';
                                    return (
                                        <tr key={a._id}>
                                            <td className="font-medium text-gray-900">{a.name}</td>
                                            <td>{a.email}</td>
                                            <td className="text-gray-500 text-xs font-mono max-w-[150px] truncate" title={a.leadTypes?.join(', ')}>
                                                {a.leadTypes?.length > 0 ? a.leadTypes.join(', ') : 'Any (All)'}
                                            </td>
                                            <td>
                                                <span className={`badge ${a.active ? 'badge-interested' : 'badge-not-interested'}`}>
                                                    {a.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${wsBadge}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${wsDot}`} />
                                                    {ws}
                                                </span>
                                            </td>
                                            <td className="text-right flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => { setAgentToEdit(a); setShowAgentModal(true); }}
                                                    className="text-primary-600 hover:text-primary-800 text-xs font-bold"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAgent(a._id, a.name)}
                                                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Lead Inventory Section */}
                <section className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Lead Inventory</h2>
                            {selectedLeadIds.size > 0 && (
                                <span className="text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full">
                                    {selectedLeadIds.size} selected
                                </span>
                            )}
                        </div>

                        {/* Primary scope — segmented control. Status / Lead Type / Search are
                            secondary refinements that operate within the chosen scope. */}
                        <div className="inline-flex bg-gray-100 p-1 rounded-xl">
                            {[
                                { value: '',           label: 'All',        count: stats.total_leads,      tone: 'text-gray-900' },
                                { value: 'unassigned', label: 'Unassigned', count: stats.unassigned_leads, tone: 'text-amber-700',  alert: (stats.unassigned_leads || 0) > 0 },
                                { value: 'assigned',   label: 'Assigned',   count: stats.assigned_leads,   tone: 'text-emerald-700' }
                            ].map(seg => {
                                const isActive = assignmentScope === seg.value;
                                return (
                                    <button
                                        key={seg.value || 'all'}
                                        onClick={() => setAssignmentScope(seg.value)}
                                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                            isActive
                                                ? `bg-white shadow-sm ${seg.tone}`
                                                : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                    >
                                        {seg.label}
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isActive ? 'bg-gray-100 text-gray-700' : 'bg-white/60 text-gray-400'
                                        } ${seg.alert ? 'ring-2 ring-amber-300' : ''}`}>
                                            {seg.count ?? 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Main toolbar */}
                        <div className="flex flex-wrap gap-3 items-center">
                            <button
                                onClick={() => api.downloadLeadsExport('admin')}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-md"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download CSV
                            </button>
                                <button
                                    onClick={() => {
                                        // Download only the currently visible leads (current page + filters)
                                        try {
                                            const rows = leads || [];
                                            let csv = 'Lead ID,Full Name,Email,Phone,Status,Form Name,Lead Type,Assigned Agent,Created At\n';
                                            rows.forEach(l => {
                                                const row = [
                                                    `"${l.leadId || ''}"`,
                                                    `"${l.full_name || ''}"`,
                                                    `"${l.email || ''}"`,
                                                    `"${l.phone_number || ''}"`,
                                                    `"${l.status || ''}"`,
                                                    `"${l.form_name || ''}"`,
                                                    `"${l.lead_type || ''}"`,
                                                    `"${l.assigned_agent ? l.assigned_agent.name : 'UNASSIGNED'}"`,
                                                    `"${l.createdAt ? new Date(l.createdAt).toISOString() : ''}"`
                                                ];
                                                csv += row.join(',') + '\n';
                                            });
                                            const blob = new Blob([csv], { type: 'text/csv' });
                                            const urlObj = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = urlObj;
                                            a.setAttribute('download', `leads_page_${page}.csv`);
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                            window.URL.revokeObjectURL(urlObj);
                                        } catch (err) {
                                            console.error('Download visible leads failed:', err);
                                            alert('Failed to download visible leads');
                                        }
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all shadow-sm"
                                >
                                    Download Visible
                                </button>
                            <button
                                onClick={() => setShowImportModal(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Import Leads
                            </button>
                            <button
                                onClick={handleBulkAssign}
                                disabled={bulkAssignLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                {bulkAssignLoading ? 'Assigning...' : 'Bulk Assign All'}
                            </button>

                            {notification && (
                                <div className={`px-4 py-2 rounded-xl text-xs font-medium text-white ${notification.startsWith('✓') ? 'bg-green-500' : 'bg-red-500'}`}>
                                    {notification}
                                </div>
                            )}
                        </div>

                        {/* Bulk selected operations */}
                        {selectedLeadIds.size > 0 && (
                            <div className="flex flex-col gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex flex-wrap gap-3 items-center">
                                    <span className="text-xs font-semibold text-blue-700">Selected operations:</span>
                                    <button
                                        onClick={handleBulkReassignSelected}
                                        disabled={bulkAssignLoading}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all disabled:bg-gray-400"
                                        title="Reassign according to the configured assignment strategy"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Auto-Reassign Selected
                                    </button>
                                    <button
                                        onClick={handleBulkDeleteSelected}
                                        disabled={bulkAssignLoading}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all disabled:bg-gray-400"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete Selected
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-blue-200">
                                    <span className="text-xs font-semibold text-blue-700">Or assign all selected to a specific agent:</span>
                                    <select
                                        value={pickAgentId}
                                        onChange={(e) => setPickAgentId(e.target.value)}
                                        className="input-field w-auto min-w-[180px] text-xs"
                                    >
                                        <option value="">Pick an agent…</option>
                                        {agents.filter(a => a.active).map(a => (
                                            <option key={a._id} value={a._id}>
                                                {a.name}{a.leadTypes?.length ? ` (${a.leadTypes.join(', ')})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAssignSelectedToAgent}
                                        disabled={bulkAssignLoading || !pickAgentId}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        Assign To Agent
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Filters */}
                        <div className="flex flex-wrap gap-3 items-center">
                            <div className="relative min-w-[200px]">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                <input type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
                            </div>
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field w-auto min-w-[140px]">
                                <option value="">All Status</option>
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="interested">Interested</option>
                                <option value="not_interested">Not Interested</option>
                                <option value="follow_up">Follow Up</option>
                                <option value="admission_done">Done</option>
                                <option value="other">Other</option>
                                <option value="not_connected">Not Connected</option>
                            </select>
                            <select value={leadTypeFilter} onChange={e => setLeadTypeFilter(e.target.value)} className="input-field w-auto min-w-[140px]">
                                <option value="">All Lead Types</option>
                                {knownLeadTypes.map(lt => (
                                    <option key={lt} value={lt}>{lt}</option>
                                ))}
                            </select>
                            {(search || statusFilter || leadTypeFilter || formFilter || assignmentScope) && (
                                <button
                                    onClick={() => { setSearch(''); setStatusFilter(''); setLeadTypeFilter(''); setFormFilter(''); setAssignmentScope(''); }}
                                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                                >
                                    Clear filters
                                </button>
                            )}
                            <button
                                onClick={handleSelectAllMatching}
                                disabled={loading || leads.length === 0}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all border border-gray-200 disabled:opacity-50"
                                title="Select every lead that matches the current filters, across all pages"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                Select All Matching
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                        {loading ? (
                            <div className="p-20 text-center text-gray-400">Loading leads...</div>
                        ) : (
                            <LeadsTable 
                                leads={leads} 
                                onOpen={setSelected} 
                                onDelete={handleDeleteLead}
                                onSelect={handleSelectLead}
                                selectedIds={selectedLeadIds}
                                showAgent={true}
                                startIndex={(page - 1) * limit}
                            />
                        )}
                    </div>
                    {/* Pagination controls */}
                    <div className="flex items-center justify-between mt-3">
                        <div className="text-sm text-gray-600">
                            {pagination && pagination.total ? (
                                (() => {
                                    const start = (page - 1) * limit + 1;
                                    const end = start + (leads.length || 0) - 1;
                                    return `Showing ${start}-${end} of ${pagination.total} leads`;
                                })()
                            ) : (
                                `Showing ${leads.length} leads`
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1 bg-white border rounded disabled:opacity-50"
                            >Prev</button>
                            <span className="text-sm text-gray-600 px-2">Page {page}{pagination.totalPages ? ` / ${pagination.totalPages}` : ''}</span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages || p + 1, p + 1))}
                                disabled={pagination.totalPages ? page >= pagination.totalPages : leads.length < limit}
                                className="px-3 py-1 bg-white border rounded disabled:opacity-50"
                            >Next</button>
                            <select value={limit} onChange={e => { setLimit(parseInt(e.target.value, 10)); setPage(1); }} className="input-field text-sm">
                                <option value={10}>10 / page</option>
                                <option value={20}>20 / page</option>
                                <option value={50}>50 / page</option>
                                <option value={100}>100 / page</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Modals */}
                {selected && (
                    <LeadModal
                        lead={selected}
                        onClose={() => setSelected(null)}
                        onSave={handleSave}
                        isAdmin={true}
                        agents={agents}
                        onReassign={handleReassign}
                        onUpdateExtraFields={handleUpdateExtraFields}
                    />
                )}

                {showAgentModal && (
                    <AgentManagementModal
                        agent={agentToEdit}
                        onClose={() => { setShowAgentModal(false); setAgentToEdit(null); }}
                        onSave={handleAgentSave}
                    />
                )}

                {showImportModal && (
                    <ImportLeadsModal
                        onClose={() => setShowImportModal(false)}
                        onSuccess={loadData}
                    />
                )}
            </main>
            )}
        </div>
    );
}

function StatCard({ label, value, color = "text-gray-900", icon }) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-card border border-gray-100 hover:shadow-card-hover transition-all group">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 group-hover:text-primary-500 transition-colors">{label}</p>
            <p className={`text-3xl font-black ${color}`}>{value || 0}</p>
        </div>
    );
}
