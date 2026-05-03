const Lead = require('../models/Lead');
const User = require('../models/User');
const Form = require('../models/Form');
const FieldMapping = require('../models/FieldMapping');
const GlobalSettings = require('../models/GlobalSettings');
const ImportBatch = require('../models/ImportBatch');
const { assignLead } = require('../services/assignmentService');
const { sanitizeExtraFieldUpdates, applyExtraFieldUpdates } = require('../utils/extraFields');
const crypto = require('crypto');

/**
 * Maps CSV header variants → canonical core lead field. Lowercased keys.
 * Anything not in this map ends up in `extra_fields`.
 */
const CORE_HEADER_MAP = {
    'id': 'leadId', 'lead_id': 'leadId', 'leadid': 'leadId',
    'full_name': 'full_name', 'name': 'full_name', 'fullname': 'full_name',
    'email': 'email', 'email_address': 'email',
    'phone': 'phone_number', 'phone_number': 'phone_number', 'phonenumber': 'phone_number',
    'form_id': 'form_id', 'formid': 'form_id',
    'form_name': 'form_name', 'formname': 'form_name',
    'created_time': 'created_time', 'created_at': 'created_time', 'created': 'created_time',
    'lead_type': 'lead_type', 'leadtype': 'lead_type'
};

/**
 * Per-field prefix to strip when reading FB Lead Center exports
 * (e.g. "f:1183..." → "1183...", "p:+9230..." → "+9230...").
 */
const PREFIX_BY_CORE = {
    leadId: 'l:',
    form_id: 'f:',
    phone_number: 'p:'
};

function stripPrefix(value, prefix) {
    if (typeof value !== 'string' || !prefix) return value;
    return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value.trim();
}

/**
 * Walk a CSV row and split it into:
 *   - core: { leadId, full_name, email, phone_number, form_id, form_name, created_time, lead_type }
 *   - extras: { <raw_header>: <value>, ... }  (everything else)
 *
 * Header lookup is case-insensitive. Empty values are skipped.
 */
function classifyRow(row) {
    const core = {};
    const extras = {};
    for (const rawKey of Object.keys(row || {})) {
        const value = row[rawKey];
        if (value === null || value === undefined || value === '') continue;
        const lc = String(rawKey).toLowerCase().trim();
        const coreField = CORE_HEADER_MAP[lc];
        if (coreField) {
            const prefix = PREFIX_BY_CORE[coreField];
            const cleaned = typeof value === 'string'
                ? (prefix ? stripPrefix(value, prefix) : value.trim())
                : value;
            core[coreField] = cleaned;
        } else {
            extras[rawKey] = typeof value === 'string' ? value.trim() : value;
        }
    }
    return { core, extras };
}

// Generate unique leadId
function generateLeadId() {
    return 'lead_' + crypto.randomBytes(12).toString('hex') + '_' + Date.now();
}

/**
 * GET /api/admin/stats
 * Dashboard statistics with lead counts by status.
 */
async function getStats(req, res) {
    try {
        const [
            total_leads,
            new_leads,
            contacted_leads,
            interested_leads,
            not_interested_leads,
            follow_up_leads,
            admission_done,
            other_leads,
            unassigned_leads
        ] = await Promise.all([
            Lead.countDocuments(),
            Lead.countDocuments({ status: 'new' }),
            Lead.countDocuments({ status: 'contacted' }),
            Lead.countDocuments({ status: 'interested' }),
            Lead.countDocuments({ status: 'not_interested' }),
            Lead.countDocuments({ status: 'follow_up' }),
            Lead.countDocuments({ status: 'admission_done' }),
            Lead.countDocuments({ status: 'other' }),
            Lead.countDocuments({ $or: [{ assigned_agent: null }, { assigned_agent: { $exists: false } }] })
        ]);
        const assigned_leads = total_leads - unassigned_leads;

        res.json({
            total_leads,
            new_leads,
            contacted_leads,
            interested_leads,
            not_interested_leads,
            follow_up_leads,
            admission_done,
            other_leads,
            unassigned_leads,
            assigned_leads
        });
    } catch (err) {
        console.error('[adminController][getStats] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}

/**
 * Translates the `assignment` query param into a Mongo filter clause.
 * - 'unassigned' → no assigned_agent
 * - 'assigned'   → has an assigned_agent
 * - anything else / missing → no clause (matches all)
 */
function assignmentFilterClause(assignment) {
    if (assignment === 'unassigned') {
        return { $or: [{ assigned_agent: null }, { assigned_agent: { $exists: false } }] };
    }
    if (assignment === 'assigned') {
        return { assigned_agent: { $ne: null } };
    }
    return null;
}

/**
 * GET /api/admin/leads
 * Paginated lead listing with optional filters.
 *
 * Query params:
 *  - page       (default 1)
 *  - limit      (default 20)
 *  - form_id    — filter by form
 *  - status     — filter by lead status
 *  - search     — search by full_name or email (case-insensitive)
 */
async function getAllLeads(req, res) {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
        const skip = (page - 1) * limit;

        // Build dynamic filter
        const filter = {};

        if (req.query.form_id) {
            filter.form_id = req.query.form_id;
        }
        if (req.query.status) {
            filter.status = req.query.status;
        }
        if (req.query.lead_type) {
            filter.lead_type = req.query.lead_type;
        }
        const assignmentClause = assignmentFilterClause(req.query.assignment);
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            // Combine search OR-clause with assignment clause via $and so
            // both constraints apply (otherwise Mongo replaces $or with the
            // assignment $or for unassigned).
            const searchClause = { $or: [{ full_name: searchRegex }, { email: searchRegex }] };
            filter.$and = assignmentClause ? [searchClause, assignmentClause] : [searchClause];
        } else if (assignmentClause) {
            Object.assign(filter, assignmentClause);
        }

        const [leads, total] = await Promise.all([
            Lead.find(filter)
                .populate('assigned_agent', 'name email')
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
        console.error('[adminController][getAllLeads] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch leads' });
    }
}

/**
 * GET /api/admin/agents
 * Return all agents.
 */
async function getAllAgents(req, res) {
    try {
        const agents = await User.find({ role: 'agent' })
            .select('-password')
            .sort({ created_at: -1 });

        res.json({ agents });
    } catch (err) {
        console.error('[adminController][getAllAgents] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
}

/**
 * PUT /api/admin/leads/:id/assign
 * Manually reassign a lead to a different agent.
 *
 * Body: { agent_id: "<ObjectId>" }
 */
async function reassignLead(req, res) {
    try {
        const { agent_id } = req.body;
        if (!agent_id) {
            return res.status(400).json({ error: 'agent_id is required' });
        }

        // Verify the target agent exists and is active
        const agent = await User.findOne({ _id: agent_id, role: 'agent', active: true });
        if (!agent) {
            return res.status(404).json({ error: 'Active agent not found' });
        }

        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { assigned_agent: agent._id },
            { new: true }
        ).populate('assigned_agent', 'name email');

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        console.info(`[adminController][reassignLead] Lead ${lead._id} reassigned to ${agent.name}`);
        res.json(lead);
    } catch (err) {
        console.error('[adminController][reassignLead] Error:', err.message);
        res.status(500).json({ error: 'Failed to reassign lead' });
    }
}

/**
 * POST /api/admin/agents
 * Create a new agent.
 */
async function createAgent(req, res) {
    try {
        const { name, email, password, leadTypes } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const newUser = new User({
            name,
            email,
            password,
            role: 'agent',
            active: true,
            leadTypes: Array.isArray(leadTypes) ? leadTypes : []
        });

        await newUser.save();

        const userResponse = newUser.toObject();
        delete userResponse.password;

        console.info(`[adminController][createAgent] New agent created: ${name} (${email})`);
        res.status(201).json(userResponse);
    } catch (err) {
        console.error('[adminController][createAgent] Error:', err.message);
        res.status(500).json({ error: 'Failed to create agent' });
    }
}

/**
 * PUT /api/admin/agents/:id
 * Update an existing agent's details.
 */
async function updateAgent(req, res) {
    try {
        const { name, email, password, active, leadTypes } = req.body;
        const updates = {};

        if (name) updates.name = name;
        if (email) updates.email = email;
        if (password) updates.password = password;
        if (active !== undefined) updates.active = active;
        if (leadTypes !== undefined) updates.leadTypes = Array.isArray(leadTypes) ? leadTypes : [];

        const updatedUser = await User.findOneAndUpdate(
            { _id: req.params.id, role: 'agent' },
            updates,
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // If agent was deactivated, redistribute their leads
        if (active === false) {
            let settings = await GlobalSettings.findOne();
            if (!settings) settings = await GlobalSettings.create({});

            if (settings.autoReassign) {
                const agentLeads = await Lead.find({ assigned_agent: req.params.id });
                let reassigned = 0;
                for (const lead of agentLeads) {
                    const newAgent = await assignLead(lead.lead_type);
                    if (newAgent && newAgent._id.toString() !== req.params.id) {
                        lead.assigned_agent = newAgent._id;
                        await lead.save();
                        reassigned++;
                    }
                }
                console.info(`[adminController][updateAgent] Auto-reassigned ${reassigned} leads from deactivated agent ${updatedUser.name}`);
            }
        }

        console.info(`[adminController][updateAgent] Agent updated: ${updatedUser.name} (${updatedUser.email})`);
        res.json(updatedUser);
    } catch (err) {
        console.error('[adminController][updateAgent] Error:', err.message);
        res.status(500).json({ error: 'Failed to update agent' });
    }
}

/**
 * GET /api/admin/leads/export
 * Export all leads to CSV.
 */
async function exportLeads(req, res) {
    try {
        const leads = await Lead.find({})
            .populate('assigned_agent', 'name email')
            .sort({ createdAt: -1 });

        let csv = 'Lead ID,Full Name,Email,Phone,Status,Form Name,Lead Type,Assigned Agent,Created At\n';

        leads.forEach(l => {
            const row = [
                `"${l.leadId || ''}"`,
                `"${l.full_name || ''}"`,
                `"${l.email || ''}"`,
                `"${l.phone_number || ''}"`,
                `"${l.status || ''}"`,
                `"${l.form_name || ''}"`,
                `"${l.lead_type || ''}"`,
                `"${l.assigned_agent ? l.assigned_agent.name : 'UNASSIGNED'}"`,
                `"${l.createdAt ? l.createdAt.toISOString() : ''}"`
            ];
            csv += row.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=all_leads.csv');
        res.status(200).send(csv);
    } catch (err) {
        console.error('[adminController][exportLeads] Error:', err.message);
        res.status(500).json({ error: 'Failed to export leads' });
    }
}

/**
 * DELETE /api/admin/agents/:id
 * Delete an agent and unassign their leads.
 */
async function deleteAgent(req, res) {
    try {
        const agentId = req.params.id;

        const agent = await User.findOne({ _id: agentId, role: 'agent' });
        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Unassign leads from this agent
        await Lead.updateMany({ assigned_agent: agentId }, { $set: { assigned_agent: null } });

        await User.findByIdAndDelete(agentId);

        console.info(`[adminController][deleteAgent] Agent deleted: ${agent.name} (${agent.email})`);
        res.json({ message: 'Agent deleted successfully' });
    } catch (err) {
        console.error('[adminController][deleteAgent] Error:', err.message);
        res.status(500).json({ error: 'Failed to delete agent' });
    }
}

/**
 * PUT /api/admin/leads/:id/status
 * Admin: Update lead status
 */
async function updateLeadStatus(req, res) {
    try {
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const lead = await Lead.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('assigned_agent', 'name email');

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        console.info(`[adminController][updateLeadStatus] Updated lead ${lead._id} status to: ${status}`);
        res.json(lead);
    } catch (err) {
        console.error('[adminController][updateLeadStatus] Error:', err.message);
        res.status(500).json({ error: 'Failed to update lead status' });
    }
}

/**
 * POST /api/admin/leads/import
 * Bulk import leads from CSV/Excel with auto-assignment
 * 
 * Body: {
 *   leads: [
 *     { full_name, email, phone_number, lead_type, form_id }
 *   ]
 * }
 */
async function importLeads(req, res) {
    try {
        // Accept new shape `rows` (full raw CSV rows) or legacy `leads` (pre-mapped).
        const incoming = Array.isArray(req.body.rows) ? req.body.rows : req.body.leads;
        const filename = req.body.filename;
        // Optional override applied to every row, regardless of CSV/form lookup.
        // Useful when the CSV came from a source that doesn't map to a Facebook form.
        const leadTypeOverride = typeof req.body.leadTypeOverride === 'string'
            ? req.body.leadTypeOverride.trim()
            : '';
        if (!Array.isArray(incoming) || incoming.length === 0) {
            return res.status(400).json({ error: 'No rows provided' });
        }

        const batch = await ImportBatch.create({
            filename: (filename && String(filename).trim()) || 'unknown.csv',
            count: 0,
            failed_count: 0
        });

        console.log(`[adminController][importLeads] Importing ${incoming.length} rows (batch ${batch._id}, file "${batch.filename}")`);

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const row of incoming) {
            const { core, extras } = classifyRow(row);
            try {
                if (!core.email) {
                    throw new Error('Email is required');
                }
                if (!core.full_name) {
                    throw new Error('Full name is required');
                }

                // Resolve form → lead_type & form_name. The CSV's form_name
                // is a fallback if no Form record exists yet.
                let resolvedLeadType = core.lead_type || null;
                let resolvedFormName = core.form_name || null;
                if (core.form_id) {
                    const form = await Form.findOne({ form_id: core.form_id });
                    if (form) {
                        resolvedLeadType = form.lead_type || resolvedLeadType;
                        resolvedFormName = form.form_name || resolvedFormName;
                    }
                }
                // Admin's per-import override always wins.
                if (leadTypeOverride) {
                    resolvedLeadType = leadTypeOverride;
                }

                // Build extra_fields. If a FieldMapping exists for this
                // lead_type and a CSV column, store the value under the
                // normalized key; otherwise keep the raw column name and
                // record the column as unmapped.
                const extraFields = {};
                const unmappedFields = [];
                const extraKeys = Object.keys(extras);
                if (extraKeys.length > 0) {
                    const mappings = resolvedLeadType
                        ? await FieldMapping.find({
                              lead_type: resolvedLeadType,
                              facebook_field: { $in: extraKeys }
                          }).lean()
                        : [];
                    const byFb = new Map(mappings.map(m => [m.facebook_field, m]));
                    for (const k of extraKeys) {
                        const m = byFb.get(k);
                        if (m) {
                            extraFields[m.normalized_key] = extras[k];
                        } else {
                            extraFields[k] = extras[k];
                            unmappedFields.push(k);
                        }
                    }
                }

                // De-dupe on leadId. If the CSV row carries a Facebook lead
                // ID and we already have it, follow GlobalSettings duplicate
                // policy. Otherwise generate a fresh internal id.
                const candidateLeadId = core.leadId || generateLeadId();
                const settings = await GlobalSettings.findOne();
                const dupePolicy = (settings && settings.duplicateHandling) || 'ALLOW';
                let existing = null;
                if (core.leadId) {
                    existing = await Lead.findOne({ leadId: candidateLeadId });
                    if (existing && dupePolicy === 'BLOCK') {
                        throw new Error(`Already exists (leadId ${candidateLeadId})`);
                    }
                }

                if (existing && dupePolicy === 'MERGE') {
                    existing.full_name = core.full_name || existing.full_name;
                    existing.email = core.email || existing.email;
                    existing.phone_number = core.phone_number || existing.phone_number;
                    existing.form_id = core.form_id || existing.form_id;
                    existing.form_name = resolvedFormName || existing.form_name;
                    existing.lead_type = resolvedLeadType || existing.lead_type;
                    if (Object.keys(extraFields).length > 0) {
                        const merged = existing.extra_fields ? Object.fromEntries(existing.extra_fields) : {};
                        Object.assign(merged, extraFields);
                        existing.extra_fields = merged;
                    }
                    if (unmappedFields.length > 0) {
                        const set = new Set([...(existing.unmapped_fields || []), ...unmappedFields]);
                        existing.unmapped_fields = Array.from(set);
                    }
                    existing.import_batch = batch._id;
                    await existing.save();
                    successCount++;
                    console.log(`  ↻ Lead merged: ${existing.full_name} (${existing.email})`);
                    continue;
                }
                if (existing && dupePolicy === 'ALLOW') {
                    // Skip silently — preserves the original.
                    console.log(`  ◦ Skipped existing lead: ${existing.full_name} (${existing.email})`);
                    continue;
                }

                const lead = new Lead({
                    leadId: candidateLeadId,
                    full_name: core.full_name,
                    email: core.email,
                    phone_number: core.phone_number || '',
                    form_id: core.form_id || '',
                    form_name: resolvedFormName || '',
                    lead_type: resolvedLeadType || '',
                    created_time: core.created_time ? new Date(core.created_time) : new Date(),
                    status: 'new',
                    import_batch: batch._id,
                    extra_fields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
                    unmapped_fields: unmappedFields
                });

                if (lead.lead_type) {
                    const agent = await assignLead(lead.lead_type);
                    if (agent) {
                        lead.assigned_agent = agent._id;
                        // Seed home_agent so this lead snaps back to the
                        // initial agent if they ever go away & come back.
                        lead.home_agent = agent._id;
                    }
                }

                await lead.save();
                successCount++;
                console.log(`  ✓ Lead imported: ${lead.full_name} (${lead.email}) | type=${lead.lead_type || '-'} | extras=${Object.keys(extraFields).length}`);
            } catch (err) {
                errorCount++;
                const errorMsg = err.message || 'Unknown error';
                errors.push(`${core.full_name || row.full_name || row['Full Name'] || 'Unknown'}: ${errorMsg}`);
                console.error(`  ❌ Failed to import: ${errorMsg}`);
            }
        }

        // Persist final counts on the batch record.
        batch.count = successCount;
        batch.failed_count = errorCount;
        await batch.save();

        // If nothing landed, drop the empty batch — no point keeping a row
        // the admin can't usefully act on.
        if (successCount === 0) {
            await ImportBatch.findByIdAndDelete(batch._id);
        }

        console.log(`[adminController][importLeads] Completed: ${successCount} imported, ${errorCount} failed`);

        res.json({
            message: 'Import completed',
            successCount,
            errorCount,
            batchId: successCount > 0 ? String(batch._id) : null,
            filename: batch.filename,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        console.error('[adminController][importLeads] Error:', err.message);
        res.status(500).json({ error: 'Failed to import leads' });
    }
}

/**
 * GET /api/admin/import-batches
 * List every import batch (most recent first), with the live lead count.
 * Live count comes from a Lead aggregation rather than the batch's stored
 * `count` so it stays accurate after admin deletes individual leads.
 */
async function listImportBatches(req, res) {
    try {
        const batches = await ImportBatch.find().sort({ createdAt: -1 }).lean();

        // Count how many leads currently reference each batch.
        const liveCounts = await Lead.aggregate([
            { $match: { import_batch: { $ne: null } } },
            { $group: { _id: '$import_batch', count: { $sum: 1 } } }
        ]);
        const liveCountMap = new Map(liveCounts.map(c => [String(c._id), c.count]));

        const enriched = batches.map(b => ({
            ...b,
            live_count: liveCountMap.get(String(b._id)) || 0
        }));

        res.json({ batches: enriched });
    } catch (err) {
        console.error('[adminController][listImportBatches] Error:', err.message);
        res.status(500).json({ error: 'Failed to list import batches' });
    }
}

/**
 * DELETE /api/admin/import-batches/:id
 * Removes the import batch and every lead that references it. Facebook-
 * sourced leads (which have `import_batch: null`) are untouched.
 */
/**
 * PATCH /api/admin/leads/:id/extra-fields
 * Body: { updates: { key1: value1, key2: value2, ... } }
 *
 * Patches `extra_fields` on a lead. Top-level columns (status, assigned_agent,
 * etc.) have dedicated endpoints; sanitizer drops them silently here.
 */
async function patchExtraFields(req, res) {
    try {
        const updates = sanitizeExtraFieldUpdates(req.body && req.body.updates);
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'updates object is required and must contain at least one editable key' });
        }

        const lead = await Lead.findById(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        applyExtraFieldUpdates(lead, updates);

        await lead.save();
        await lead.populate('assigned_agent', 'name email');
        await lead.populate('comments.added_by', 'name email');

        console.info(`[adminController][patchExtraFields] Lead ${lead._id} updated keys: ${Object.keys(updates).join(', ')}`);
        res.json(lead);
    } catch (err) {
        console.error('[adminController][patchExtraFields] Error:', err.message);
        res.status(500).json({ error: 'Failed to update extra fields' });
    }
}

async function deleteImportBatch(req, res) {
    try {
        const { id } = req.params;
        const batch = await ImportBatch.findById(id);
        if (!batch) {
            return res.status(404).json({ error: 'Import batch not found' });
        }

        const result = await Lead.deleteMany({ import_batch: batch._id });
        await ImportBatch.findByIdAndDelete(id);

        console.info(`[adminController][deleteImportBatch] Removed batch ${batch._id} ("${batch.filename}") and ${result.deletedCount} leads`);
        res.json({
            message: 'Import batch removed',
            filename: batch.filename,
            deletedLeads: result.deletedCount
        });
    } catch (err) {
        console.error('[adminController][deleteImportBatch] Error:', err.message);
        res.status(500).json({ error: 'Failed to delete import batch' });
    }
}

/**
 * POST /api/admin/leads/bulk-assign
 * Bulk assign all unassigned leads according to settings strategy
 */
async function bulkAssignUnassigned(req, res) {
    try {
        // Find all unassigned leads
        const unassignedLeads = await Lead.find({
            $or: [
                { assigned_agent: null },
                { assigned_agent: { $exists: false } }
            ]
        }).lean();

        console.log(`[adminController][bulkAssignUnassigned] Found ${unassignedLeads.length} unassigned leads`);

        if (unassignedLeads.length === 0) {
            return res.json({
                message: 'No unassigned leads found',
                assignedCount: 0,
                failedCount: 0
            });
        }

        let assignedCount = 0;
        let failedCount = 0;
        const failed = [];

        for (const lead of unassignedLeads) {
            try {
                const agent = await assignLead(lead.lead_type);
                if (agent) {
                    await Lead.findByIdAndUpdate(lead._id, { assigned_agent: agent._id });
                    assignedCount++;
                    console.log(`  ✓ Assigned: ${lead.full_name} → ${agent.name}`);
                } else {
                    failedCount++;
                    failed.push(`${lead.full_name}: No matching agent for type "${lead.lead_type}"`);
                    console.log(`  ❌ No agent found for: ${lead.full_name} (${lead.lead_type})`);
                }
            } catch (err) {
                failedCount++;
                failed.push(`${lead.full_name}: ${err.message}`);
                console.error(`  ❌ Assignment failed: ${err.message}`);
            }
        }

        console.log(`[adminController][bulkAssignUnassigned] Completed: ${assignedCount} assigned, ${failedCount} failed`);

        res.json({
            message: 'Bulk assignment completed',
            assignedCount,
            failedCount,
            failed: failed.length > 0 ? failed : undefined
        });
    } catch (err) {
        console.error('[adminController][bulkAssignUnassigned] Error:', err.message);
        res.status(500).json({ error: 'Failed to bulk assign leads' });
    }
}

/**
 * DELETE /api/admin/leads/:id
 * Delete a lead from the database
 */
async function deleteLead(req, res) {
    try {
        const { id } = req.params;

        const lead = await Lead.findByIdAndDelete(id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        console.log(`[adminController][deleteLead] Deleted lead: ${lead.full_name} (${lead.email})`);

        res.json({
            message: 'Lead deleted successfully',
            lead
        });
    } catch (err) {
        console.error('[adminController][deleteLead] Error:', err.message);
        res.status(500).json({ error: 'Failed to delete lead' });
    }
}

/**
 * POST /api/admin/leads/bulk-delete
 * Delete multiple selected leads
 */
async function bulkDeleteLeads(req, res) {
    try {
        const { leadIds } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'leadIds array is required' });
        }

        console.log(`[adminController][bulkDeleteLeads] Deleting ${leadIds.length} leads...`);

        const result = await Lead.deleteMany({ _id: { $in: leadIds } });

        console.log(`[adminController][bulkDeleteLeads] Deleted ${result.deletedCount} leads`);

        res.json({
            message: 'Leads deleted successfully',
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error('[adminController][bulkDeleteLeads] Error:', err.message);
        res.status(500).json({ error: 'Failed to delete leads' });
    }
}

/**
 * POST /api/admin/leads/bulk-reassign
 * Reassign multiple selected leads based on assignment strategy
 */
async function bulkReassignLeads(req, res) {
    try {
        const { leadIds } = req.body;

        if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'leadIds array is required' });
        }

        console.log(`[adminController][bulkReassignLeads] Reassigning ${leadIds.length} leads...`);

        // Find all leads with given IDs
        const leads = await Lead.find({ _id: { $in: leadIds } });

        if (leads.length === 0) {
            return res.json({
                message: 'No leads found',
                reassignedCount: 0,
                failedCount: 0
            });
        }

        let reassignedCount = 0;
        let failedCount = 0;
        const failed = [];

        for (const lead of leads) {
            try {
                const agent = await assignLead(lead.lead_type);
                if (agent) {
                    await Lead.findByIdAndUpdate(lead._id, { assigned_agent: agent._id });
                    reassignedCount++;
                    console.log(`  ✓ Reassigned: ${lead.full_name} → ${agent.name}`);
                } else {
                    failedCount++;
                    failed.push(`${lead.full_name}: No matching agent for type "${lead.lead_type}"`);
                    console.log(`  ❌ No agent found for: ${lead.full_name} (${lead.lead_type})`);
                }
            } catch (err) {
                failedCount++;
                failed.push(`${lead.full_name}: ${err.message}`);
                console.error(`  ❌ Reassignment failed: ${err.message}`);
            }
        }

        console.log(`[adminController][bulkReassignLeads] Completed: ${reassignedCount} reassigned, ${failedCount} failed`);

        res.json({
            message: 'Bulk reassignment completed',
            reassignedCount,
            failedCount,
            failed: failed.length > 0 ? failed : undefined
        });
    } catch (err) {
        console.error('[adminController][bulkReassignLeads] Error:', err.message);
        res.status(500).json({ error: 'Failed to reassign leads' });
    }
}

/**
 * GET /api/admin/leads/ids
 * Returns just the _id list of every lead matching the same filters as
 * GET /api/admin/leads. Used by the dashboard to "select all matching filter"
 * across pagination.
 */
async function getAllLeadIds(req, res) {
    try {
        const filter = {};
        if (req.query.form_id) filter.form_id = req.query.form_id;
        if (req.query.status) filter.status = req.query.status;
        if (req.query.lead_type) filter.lead_type = req.query.lead_type;
        const assignmentClause = assignmentFilterClause(req.query.assignment);
        if (req.query.search) {
            const searchRegex = new RegExp(req.query.search, 'i');
            const searchClause = { $or: [{ full_name: searchRegex }, { email: searchRegex }] };
            filter.$and = assignmentClause ? [searchClause, assignmentClause] : [searchClause];
        } else if (assignmentClause) {
            Object.assign(filter, assignmentClause);
        }
        const ids = await Lead.find(filter, { _id: 1 }).lean();
        res.json({ ids: ids.map(d => String(d._id)) });
    } catch (err) {
        console.error('[adminController][getAllLeadIds] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch lead ids' });
    }
}

/**
 * POST /api/admin/leads/bulk-assign-to-agent
 * Body: { leadIds: [..], agentId: "<id>" }
 *
 * Force-assigns every lead in `leadIds` to the given agent, regardless of
 * lead_type or assignment strategy. Useful when admin wants to pin a batch
 * of leads to a specific person.
 */
async function bulkAssignToAgent(req, res) {
    try {
        const { leadIds, agentId } = req.body;
        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({ error: 'leadIds array is required' });
        }
        if (!agentId) {
            return res.status(400).json({ error: 'agentId is required' });
        }

        const agent = await User.findOne({ _id: agentId, role: 'agent', active: true });
        if (!agent) {
            return res.status(404).json({ error: 'Active agent not found' });
        }

        const result = await Lead.updateMany(
            { _id: { $in: leadIds } },
            { $set: { assigned_agent: agent._id } }
        );

        console.info(`[adminController][bulkAssignToAgent] Assigned ${result.modifiedCount} leads to ${agent.name}`);
        res.json({
            message: 'Bulk assignment to agent completed',
            assignedCount: result.modifiedCount,
            agent: { _id: agent._id, name: agent.name }
        });
    } catch (err) {
        console.error('[adminController][bulkAssignToAgent] Error:', err.message);
        res.status(500).json({ error: 'Failed to assign leads to agent' });
    }
}

module.exports = {
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
};
