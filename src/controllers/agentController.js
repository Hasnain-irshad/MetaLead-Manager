const Lead = require('../models/Lead');
const { sanitizeExtraFieldUpdates, applyExtraFieldUpdates } = require('../utils/extraFields');

/**
 * GET /api/agent/leads
 * Return only leads assigned to the requesting agent.
 *
 * The agent is identified via `req.user.id` (set by auth middleware or
 * the temporary x-user-id header).
 *
 * Query params:
 *  - page   (default 1)
 *  - limit  (default 20)
 *  - status — optional status filter
 */
async function getMyLeads(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) {
            return res.status(401).json({ error: 'Agent identification required' });
        }

        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const skip = (page - 1) * limit;

        const filter = { assigned_agent: agentId };
        if (req.query.status) {
            filter.status = req.query.status;
        }

        const [leads, total] = await Promise.all([
            Lead.find(filter)
                .populate('assigned_agent', 'name email')
                .populate('comments.added_by', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Lead.countDocuments(filter)
        ]);

        res.json({
            leads,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('[agentController][getMyLeads] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
}

/**
 * PUT /api/agent/leads/:id/status
 * Agent updates the status of one of their assigned leads.
 *
 * Body: { status: "contacted" }
 */
async function updateLeadStatus(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) {
            return res.status(401).json({ error: 'Agent identification required' });
        }

        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'status is required' });
        }

        const validStatuses = ['new', 'contacted', 'interested', 'not_interested', 'follow_up', 'admission_done'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const lead = await Lead.findOneAndUpdate(
            { _id: req.params.id, assigned_agent: agentId },
            { status },
            { new: true }
        ).populate('assigned_agent', 'name email');

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found or not assigned to you' });
        }

        console.info(`[agentController][updateLeadStatus] Lead ${lead._id} -> ${status}`);
        res.json(lead);
    } catch (err) {
        console.error('[agentController][updateLeadStatus] Error:', err.message);
        res.status(500).json({ error: 'Failed to update status' });
    }
}

/**
 * POST /api/agent/leads/:id/comment
 * Agent adds a comment to one of their assigned leads.
 *
 * Body: { text: "Called the applicant..." }
 */
async function addComment(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) {
            return res.status(401).json({ error: 'Agent identification required' });
        }

        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const lead = await Lead.findOne({ _id: req.params.id, assigned_agent: agentId });
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found or not assigned to you' });
        }

        lead.comments.push({
            text,
            added_by: agentId,
            created_at: new Date()
        });

        await lead.save();
        console.info(`[agentController][addComment] Comment added to lead ${lead._id}`);

        // Re-populate for response
        await lead.populate('comments.added_by', 'name email');
        res.json(lead);
    } catch (err) {
        console.error('[agentController][addComment] Error:', err.message);
        res.status(500).json({ error: 'Failed to add comment' });
    }
}

/**
 * GET /api/agent/:userId/leads/export
 * Export agent's assigned leads to CSV.
 */
async function exportLeads(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) {
            return res.status(401).json({ error: 'Agent identification required' });
        }

        const leads = await Lead.find({ assigned_agent: agentId })
            .sort({ createdAt: -1 });

        let csv = 'Lead ID,Full Name,Email,Phone,Status,Form Name,Lead Type,Created At\n';

        leads.forEach(l => {
            const row = [
                `"${l.leadId || ''}"`,
                `"${l.full_name || ''}"`,
                `"${l.email || ''}"`,
                `"${l.phone_number || ''}"`,
                `"${l.status || ''}"`,
                `"${l.form_name || ''}"`,
                `"${l.lead_type || ''}"`,
                `"${l.createdAt ? l.createdAt.toISOString() : ''}"`
            ];
            csv += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=my_leads.csv`);
        res.status(200).send(csv);
    } catch (err) {
        console.error('[agentController][exportLeads] Error:', err.message);
        res.status(500).json({ error: 'Failed to export leads' });
    }
}

/**
 * PATCH /api/agent/leads/:id/extra-fields
 * Body: { updates: { ... } }
 * Agent can patch extra_fields only on their own assigned leads.
 */
async function patchExtraFields(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) {
            return res.status(401).json({ error: 'Agent identification required' });
        }

        const updates = sanitizeExtraFieldUpdates(req.body && req.body.updates);
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'updates object is required and must contain at least one editable key' });
        }

        const lead = await Lead.findOne({ _id: req.params.id, assigned_agent: agentId });
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found or not assigned to you' });
        }

        applyExtraFieldUpdates(lead, updates);
        await lead.save();
        await lead.populate('assigned_agent', 'name email');
        await lead.populate('comments.added_by', 'name email');

        console.info(`[agentController][patchExtraFields] Lead ${lead._id} updated keys: ${Object.keys(updates).join(', ')}`);
        res.json(lead);
    } catch (err) {
        console.error('[agentController][patchExtraFields] Error:', err.message);
        res.status(500).json({ error: 'Failed to update extra fields' });
    }
}

module.exports = { getMyLeads, updateLeadStatus, addComment, exportLeads, patchExtraFields };
