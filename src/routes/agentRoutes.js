const express = require('express');
const router = express.Router();
const {
    getMyLeads,
    updateLeadStatus,
    addComment,
    exportLeads,
    patchExtraFields
} = require('../controllers/agentController');

/**
 * Temporary auth middleware — reads agent identity from the
 * `x-user-id` header and sets `req.user.id`.
 *
 * Replace this with proper JWT authentication in production.
 */
function tempAuth(req, res, next) {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!userId) {
        return res.status(401).json({ error: 'x-user-id header or userId query param required' });
    }
    req.user = { id: userId };
    next();
}

// Apply temp auth to all agent routes
router.use(tempAuth);

// GET /api/agent/leads — leads assigned to this agent
router.get('/leads', getMyLeads);

// GET /api/agent/leads/export — export agent's leads
router.get('/leads/export', exportLeads);

// PUT /api/agent/leads/:id/status — update lead status
router.put('/leads/:id/status', updateLeadStatus);

// POST /api/agent/leads/:id/comment — add a comment
router.post('/leads/:id/comment', addComment);

// PATCH /api/agent/leads/:id/extra-fields — patch dynamic fields on own lead
router.patch('/leads/:id/extra-fields', patchExtraFields);

module.exports = router;
