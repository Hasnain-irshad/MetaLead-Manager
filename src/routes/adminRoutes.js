const express = require('express');
const router = express.Router();
const {
    getStats,
    getAllLeads,
    getAllLeadIds,
    getAllAgents,
    reassignLead,
    createAgent,
    updateAgent,
    exportLeads,
    deleteAgent,
    updateLeadStatus,
    importLeads,
    patchExtraFields,
    listImportBatches,
    deleteImportBatch,
    bulkAssignUnassigned,
    bulkAssignToAgent,
    deleteLead,
    bulkDeleteLeads,
    bulkReassignLeads
} = require('../controllers/adminController');

// GET /api/admin/stats — dashboard statistics
router.get('/stats', getStats);

// GET /api/admin/leads/export — export all leads
router.get('/leads/export', exportLeads);

// GET /api/admin/leads/ids — every lead id matching the same filters (for select-all-matching)
router.get('/leads/ids', getAllLeadIds);

// GET /api/admin/leads — paginated, filterable lead listing
router.get('/leads', getAllLeads);

// GET /api/admin/agents — list all agents
router.get('/agents', getAllAgents);

// POST /api/admin/agents — create a new agent
router.post('/agents', createAgent);

// PUT /api/admin/agents/:id — update an agent
router.put('/agents/:id', updateAgent);

// DELETE /api/admin/agents/:id — delete an agent
router.delete('/agents/:id', deleteAgent);

// PUT /api/admin/leads/:id/assign — manually reassign a lead
router.put('/leads/:id/assign', reassignLead);

// PUT /api/admin/leads/:id/status — update lead status
router.put('/leads/:id/status', updateLeadStatus);

// PATCH /api/admin/leads/:id/extra-fields — patch dynamic fields
router.patch('/leads/:id/extra-fields', patchExtraFields);

// POST /api/admin/leads/import — bulk import leads from CSV/Excel
router.post('/leads/import', importLeads);

// GET /api/admin/import-batches — list all imports (with live lead counts)
router.get('/import-batches', listImportBatches);

// DELETE /api/admin/import-batches/:id — remove batch and cascade-delete its leads
router.delete('/import-batches/:id', deleteImportBatch);

// POST /api/admin/leads/bulk-assign — bulk assign all unassigned leads
router.post('/leads/bulk-assign', bulkAssignUnassigned);

// POST /api/admin/leads/bulk-assign-to-agent — assign selected leads to a specific agent
router.post('/leads/bulk-assign-to-agent', bulkAssignToAgent);

// DELETE /api/admin/leads/:id — delete a lead
router.delete('/leads/:id', deleteLead);

// POST /api/admin/leads/bulk-delete — delete multiple leads
router.post('/leads/bulk-delete', bulkDeleteLeads);

// POST /api/admin/leads/bulk-reassign — reassign multiple leads
router.post('/leads/bulk-reassign', bulkReassignLeads);

module.exports = router;
