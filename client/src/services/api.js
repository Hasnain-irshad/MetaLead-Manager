import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:4000';

// --- Auth ---
export async function login(email, password) {
  const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password });
  return res.data;
}

// --- Admin APIs ---
export async function fetchAdminStats() {
  const res = await axios.get(`${API_BASE}/api/admin/stats`);
  return res.data;
}

export async function fetchAdminLeads(params = {}) {
  const res = await axios.get(`${API_BASE}/api/admin/leads`, { params });
  return res.data;
}

export async function fetchAdminLeadIds(params = {}) {
  const res = await axios.get(`${API_BASE}/api/admin/leads/ids`, { params });
  return res.data;
}

export async function fetchAdminAgents() {
  const res = await axios.get(`${API_BASE}/api/admin/agents`);
  return res.data;
}

// --- Forms APIs ---
export async function syncForms() {
  const res = await axios.get(`${API_BASE}/api/forms/sync`);
  return res.data;
}

export async function fetchForms() {
  const res = await axios.get(`${API_BASE}/api/forms`);
  return res.data;
}

export async function updateForm(formId, data) {
  const res = await axios.put(`${API_BASE}/api/forms/${formId}`, data);
  return res.data;
}

export async function patchAdminLeadExtraFields(leadId, updates) {
  const res = await axios.patch(`${API_BASE}/api/admin/leads/${leadId}/extra-fields`, { updates });
  return res.data;
}

export async function reassignLead(leadId, agentId) {
  const res = await axios.put(`${API_BASE}/api/admin/leads/${leadId}/assign`, { agent_id: agentId });
  return res.data;
}

export async function updateAdminLeadStatus(leadId, status) {
  const res = await axios.put(`${API_BASE}/api/admin/leads/${leadId}/status`, { status });
  return res.data;
}

export async function importLeads(rows, filename, leadTypeOverride) {
  const res = await axios.post(`${API_BASE}/api/admin/leads/import`, {
    rows,
    filename,
    leadTypeOverride: leadTypeOverride || ''
  });
  return res.data;
}

export async function fetchImportBatches() {
  const res = await axios.get(`${API_BASE}/api/admin/import-batches`);
  return res.data;
}

export async function deleteImportBatch(batchId) {
  const res = await axios.delete(`${API_BASE}/api/admin/import-batches/${batchId}`);
  return res.data;
}

export async function bulkAssignUnassigned() {
  const res = await axios.post(`${API_BASE}/api/admin/leads/bulk-assign`);
  return res.data;
}

export async function deleteLead(leadId) {
  const res = await axios.delete(`${API_BASE}/api/admin/leads/${leadId}`);
  return res.data;
}

export async function bulkDeleteLeads(leadIds) {
  const res = await axios.post(`${API_BASE}/api/admin/leads/bulk-delete`, { leadIds });
  return res.data;
}

export async function bulkReassignLeads(leadIds) {
  const res = await axios.post(`${API_BASE}/api/admin/leads/bulk-reassign`, { leadIds });
  return res.data;
}

export async function bulkAssignLeadsToAgent(leadIds, agentId) {
  const res = await axios.post(`${API_BASE}/api/admin/leads/bulk-assign-to-agent`, { leadIds, agentId });
  return res.data;
}

export async function createAgent(agentData) {
  const res = await axios.post(`${API_BASE}/api/admin/agents`, agentData);
  return res.data;
}

export async function updateAgent(agentId, agentData) {
  const res = await axios.put(`${API_BASE}/api/admin/agents/${agentId}`, agentData);
  return res.data;
}

export async function deleteAgent(agentId) {
  const res = await axios.delete(`${API_BASE}/api/admin/agents/${agentId}`);
  return res.data;
}

export function downloadLeadsExport(role, userId) {
  const url = role === 'admin'
    ? `${API_BASE}/api/admin/leads/export`
    : `${API_BASE}/api/agent/leads/export?userId=${userId}`;
  window.open(url, '_blank');
}

// --- Agent APIs ---
export async function fetchAgentLeads(userId, params = {}) {
  const res = await axios.get(`${API_BASE}/api/agent/leads`, {
    headers: { 'x-user-id': userId },
    params
  });
  return res.data;
}

export async function updateAgentLeadStatus(userId, leadId, status) {
  const res = await axios.put(`${API_BASE}/api/agent/leads/${leadId}/status`,
    { status },
    { headers: { 'x-user-id': userId } }
  );
  return res.data;
}

export async function patchAgentLeadExtraFields(userId, leadId, updates) {
  const res = await axios.patch(`${API_BASE}/api/agent/leads/${leadId}/extra-fields`,
    { updates },
    { headers: { 'x-user-id': userId } }
  );
  return res.data;
}

export async function addAgentComment(userId, leadId, text) {
  const res = await axios.post(`${API_BASE}/api/agent/leads/${leadId}/comment`,
    { text },
    { headers: { 'x-user-id': userId } }
  );
  return res.data;
}

// --- Generic/Legacy (if needed by other components) ---
export async function fetchLeads() {
  const res = await axios.get(`${API_BASE}/api/leads`);
  return res.data;
}

export async function fetchStats() {
  const res = await axios.get(`${API_BASE}/api/leads/stats`);
  return res.data;
}

// --- Field Mappings ---
export async function fetchFieldMappings(leadType) {
  const res = await axios.get(`${API_BASE}/api/field-mappings`, {
    params: leadType ? { lead_type: leadType } : {}
  });
  return res.data;
}

export async function createFieldMapping(data) {
  const res = await axios.post(`${API_BASE}/api/field-mappings`, data);
  return res.data;
}

export async function updateFieldMapping(id, data) {
  const res = await axios.put(`${API_BASE}/api/field-mappings/${id}`, data);
  return res.data;
}

export async function deleteFieldMapping(id) {
  const res = await axios.delete(`${API_BASE}/api/field-mappings/${id}`);
  return res.data;
}

export async function fetchUnmappedFields(leadType) {
  const res = await axios.get(`${API_BASE}/api/field-mappings/unmapped/${encodeURIComponent(leadType)}`);
  return res.data;
}

// --- Form Configs ---
export async function fetchFormConfigs() {
  const res = await axios.get(`${API_BASE}/api/form-configs`);
  return res.data;
}

export async function fetchFormConfig(leadType) {
  const res = await axios.get(`${API_BASE}/api/form-configs/${encodeURIComponent(leadType)}`);
  return res.data;
}

export async function saveFormConfig(leadType, fields) {
  const res = await axios.put(`${API_BASE}/api/form-configs/${encodeURIComponent(leadType)}`, { fields });
  return res.data;
}

export async function deleteFormConfig(leadType) {
  const res = await axios.delete(`${API_BASE}/api/form-configs/${encodeURIComponent(leadType)}`);
  return res.data;
}

// --- Admin Settings ---
export async function fetchGlobalSettings() {
  const res = await axios.get(`${API_BASE}/api/settings`);
  return res.data;
}

export async function updateGlobalSettings(data) {
  const res = await axios.put(`${API_BASE}/api/settings`, data);
  return res.data;
}

export async function changeAdminPassword(email, oldPassword, newPassword) {
  const res = await axios.put(`${API_BASE}/api/settings/password`, { email, oldPassword, newPassword });
  return res.data;
}

// --- Agent Settings ---
export async function fetchAgentSettings(userId) {
  const res = await axios.get(`${API_BASE}/api/settings/agent`, {
    headers: { 'x-user-id': userId }
  });
  return res.data;
}

export async function updateAgentSettings(userId, data) {
  const res = await axios.put(`${API_BASE}/api/settings/agent`, data, {
    headers: { 'x-user-id': userId }
  });
  return res.data;
}

export async function changeAgentPassword(userId, oldPassword, newPassword) {
  const res = await axios.put(`${API_BASE}/api/settings/agent/password`, { oldPassword, newPassword }, {
    headers: { 'x-user-id': userId }
  });
  return res.data;
}
