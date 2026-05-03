const Form = require('../models/Form');
const Lead = require('../models/Lead');
const { fetchAndStoreForms } = require('../services/facebookFormService');

/**
 * Trigger background sync with Facebook to fetch and update all lead forms.
 */
async function syncForms(req, res, next) {
    try {
        const pageId = process.env.PAGE_ID;
        if (!pageId) {
            return res.status(400).json({ error: 'PAGE_ID not configured in environment' });
        }
        
        await fetchAndStoreForms(pageId);
        
        const forms = await Form.find().sort({ created_at: -1 });
        return res.status(200).json({ message: 'Forms synced successfully', forms });
    } catch (err) {
        console.error('[formController][syncForms] Error syncing forms:', err.message);
        next(err);
    }
}

/**
 * Fetch all forms from DB.
 */
async function getForms(req, res, next) {
    try {
        const forms = await Form.find().sort({ created_at: -1 });
        return res.status(200).json({ forms });
    } catch (err) {
        next(err);
    }
}

/**
 * Update form lead_type and cascade to existing leads.
 *
 * When admin changes `lead_type` on a Form, every Lead that came from that
 * form (matched by form_id) gets its denormalized `lead_type` and `form_name`
 * fields re-synced. This does NOT touch agent assignment — admin can use the
 * dashboard's bulk-reassign / assign-to-agent flow if they want past leads
 * re-routed to a matching agent.
 */
async function updateForm(req, res, next) {
    try {
        const { id } = req.params;
        const { lead_type } = req.body;

        const form = await Form.findById(id);
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }

        const prevLeadType = form.lead_type;
        if (lead_type !== undefined) {
            form.lead_type = lead_type;
        }

        await form.save();

        let leadsUpdated = 0;
        if (lead_type !== undefined && lead_type !== prevLeadType && form.form_id) {
            const result = await Lead.updateMany(
                { form_id: form.form_id },
                { $set: { lead_type: form.lead_type, form_name: form.form_name } }
            );
            leadsUpdated = result.modifiedCount || 0;
            console.info(`[formController][updateForm] Cascaded lead_type "${prevLeadType}" → "${form.lead_type}" to ${leadsUpdated} existing leads (form_id: ${form.form_id})`);
        }

        return res.status(200).json({ form, leadsUpdated });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    syncForms,
    getForms,
    updateForm
};
