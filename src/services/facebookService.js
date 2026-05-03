const axios = require('axios');
const Lead = require('../models/Lead');
const Form = require('../models/Form');
const FieldMapping = require('../models/FieldMapping');
const GlobalSettings = require('../models/GlobalSettings');
const { assignLead } = require('./assignmentService');
const { fetchAndStoreForms } = require('./facebookFormService');

/**
 * Fetch lead details from the Meta Graph API for a given lead id.
 * Returns the raw Graph API response.
 * Supports local `MOCK_FACEBOOK=true` for safe testing.
 */
async function fetchLeadDetails(leadId) {
  if (!leadId) throw new Error('leadId is required');

  // Mock mode for local testing without real Facebook credentials
  if (process.env.MOCK_FACEBOOK === 'true') {
    return {
      id: leadId,
      field_data: [
        { name: 'full_name', values: ['Local Test User'] },
        { name: 'email', values: ['local@example.com'] },
        { name: 'phone_number', values: ['+15551234567'] }
      ]
    };
  }

  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('PAGE_ACCESS_TOKEN not configured');

  const url = `https://graph.facebook.com/v25.0/${encodeURIComponent(leadId)}`;
  try {
    const res = await axios.get(url, {
      params: { access_token: token },
      timeout: 8000
    });
    return res.data;
  } catch (err) {
    const errMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Failed to fetch lead details: ${errMsg}`);
  }
}

/**
 * Get or create the singleton GlobalSettings.
 */
async function getSettings() {
  let s = await GlobalSettings.findOne();
  if (!s) s = await GlobalSettings.create({});
  return s;
}

/**
 * Persist a lead object (Graph API response) into MongoDB using the Lead model.
 *
 * Enhanced flow:
 *  1. Extract contact info from field_data
 *  2. Look up Form by form_id to get form_name & lead_type
 *  3. Check duplicateHandling setting
 *  4. Auto-assign an agent via round-robin (respects GlobalSettings)
 *  5. Save the enriched Lead document
 *
 * @param {Object}  graphData  — Graph API response
 * @param {String}  formId     — Facebook form_id from the webhook payload
 * @param {String}  pageId     — Facebook page_id from the webhook payload
 */
async function saveLeadToDB(graphData, formId, pageId) {
  if (!graphData || !graphData.id) throw new Error('Invalid graph data');

  const leadId = graphData.id;

  // Map graph fields to top-level Lead schema fields
  const createdTime = graphData.created_time || new Date();
  const resolvedFormId = formId || graphData.form_id || null;
  const resolvedPageId = pageId || graphData.page_id || process.env.PAGE_ID || null;
  const fieldData = Array.isArray(graphData.field_data) ? graphData.field_data : [];

  // Helper: extract a value from field_data by field name
  function extractField(name) {
    if (!name) return null;
    const searchName = name.toLowerCase().trim();
    const field = fieldData.find(
      (f) => f.name && f.name.toLowerCase().trim() === searchName
    );
    const value = field && Array.isArray(field.values) && field.values.length > 0
      ? field.values[0]
      : null;

    if (value) {
      console.debug(`[facebookService][extractField] Found "${name}":`, value);
    }
    return value;
  }

  // Extract human-readable fields from the Graph API field_data array
  const fullName = extractField('full_name') || extractField('name') || '';
  const email = extractField('email') || '';
  const phoneNumber =
    extractField('phone_number') || extractField('phone') || '';

  console.info(`[facebookService][saveLeadToDB] Extracted -> Name: ${fullName}, Email: ${email}, Phone: ${phoneNumber}`);

  // Capture every non-core field into a flat raw map. We keep the raw FB
  // names here and apply normalization later (after we know the lead_type).
  const CORE_FB_FIELDS = new Set(['full_name', 'name', 'email', 'phone_number', 'phone']);
  const rawExtras = {};
  for (const f of fieldData) {
    if (!f || !f.name) continue;
    const key = String(f.name).trim();
    if (!key || CORE_FB_FIELDS.has(key.toLowerCase())) continue;
    const value = Array.isArray(f.values) && f.values.length === 1
      ? f.values[0]
      : (Array.isArray(f.values) ? f.values : null);
    rawExtras[key] = value;
  }

  try {
    // ── Duplicate handling ──
    const settings = await getSettings();
    const existing = await Lead.findOne({ leadId });

    if (existing) {
      if (settings.duplicateHandling === 'BLOCK') {
        console.info('[facebookService][saveLeadToDB] BLOCK: Duplicate lead rejected:', leadId);
        return existing;
      }
      if (settings.duplicateHandling === 'MERGE') {
        // Update existing lead with fresh data
        existing.full_name = fullName || existing.full_name;
        existing.email = email || existing.email;
        existing.phone_number = phoneNumber || existing.phone_number;
        existing.rawData = graphData;
        await existing.save();
        console.info('[facebookService][saveLeadToDB] MERGE: Updated existing lead:', leadId);
        return existing;
      }
      // ALLOW (default) — skip silently
      console.info('[facebookService][saveLeadToDB] ALLOW: Lead already exists, skipping:', leadId);
      return existing;
    }

    // ----- Form lookup -----
    let formName = null;
    let leadType = null;
    if (resolvedFormId) {
      let form = await Form.findOne({ form_id: resolvedFormId });
      
      if (!form) {
        console.warn(`[facebookService][saveLeadToDB] Form not found for form_id: ${resolvedFormId}, initiating synchronous sync...`);
        try {
          if (resolvedPageId) {
            await fetchAndStoreForms(resolvedPageId);
            form = await Form.findOne({ form_id: resolvedFormId });
          } else {
            console.warn('[facebookService][saveLeadToDB] Cannot sync forms, missing resolvedPageId');
          }
        } catch (syncErr) {
          console.error('[facebookService][saveLeadToDB] Failed to sync forms during fallback:', syncErr.message);
        }
      }

      if (form) {
        formName = form.form_name;
        leadType = form.lead_type;
        console.info(`[facebookService][saveLeadToDB] Form matched: ${formName} (${leadType})`);
      } else {
        console.warn(`[facebookService][saveLeadToDB] No Form found and sync failed/fallback empty for form_id: ${resolvedFormId}`);
        formName = "Unknown Form";
        leadType = "Other";
      }
    }

    // ----- Field normalization via FieldMapping -----
    // For each raw FB field captured above, look up a mapping for this
    // lead_type. If found → store value under normalized_key. If not →
    // store under the raw key AND add the raw key to unmapped_fields so
    // an admin can review it in the Field Mapping UI.
    const extraFields = {};
    const unmappedFields = [];
    if (Object.keys(rawExtras).length > 0) {
      const rawKeys = Object.keys(rawExtras);
      const mappings = leadType
        ? await FieldMapping.find({ lead_type: leadType, facebook_field: { $in: rawKeys } }).lean()
        : [];
      const mapByFbField = new Map(mappings.map(m => [m.facebook_field, m]));

      for (const rawKey of rawKeys) {
        const m = mapByFbField.get(rawKey);
        if (m) {
          extraFields[m.normalized_key] = rawExtras[rawKey];
        } else {
          extraFields[rawKey] = rawExtras[rawKey];
          unmappedFields.push(rawKey);
        }
      }
      if (unmappedFields.length > 0) {
        console.info(`[facebookService][saveLeadToDB] ${unmappedFields.length} unmapped fields for lead_type "${leadType}":`, unmappedFields.join(', '));
      }
    }

    // ----- Agent assignment (round-robin) -----
    let assignedAgent = null;
    try {
      const agent = await assignLead(leadType);
      if (agent) {
        assignedAgent = agent._id;
        console.info(`[facebookService][saveLeadToDB] Assigned to agent: ${agent.name} (Lead Type: ${leadType || 'None'})`);
      }
    } catch (assignErr) {
      console.error('[facebookService][saveLeadToDB] Assignment failed (lead will be unassigned):', assignErr.message);
    }

    const lead = new Lead({
      leadId,
      full_name: fullName,
      email,
      phone_number: phoneNumber,
      form_id: resolvedFormId,
      form_name: formName,
      lead_type: leadType,
      page_id: resolvedPageId,
      created_time: createdTime,
      assigned_agent: assignedAgent,
      // Initial assignment also seeds the long-term owner. Subsequent
      // temporary reroutes (offline cascade, manual admin reassign) only
      // change `assigned_agent`, so this lead returns to `home_agent` when
      // they come back AVAILABLE.
      home_agent: assignedAgent,
      status: 'new',
      extra_fields: Object.keys(extraFields).length > 0 ? extraFields : undefined,
      unmapped_fields: unmappedFields,
      rawData: graphData
    });

    const saved = await lead.save();
    console.info('[facebookService][saveLeadToDB] Lead saved:', saved._id.toString());
    return saved;
  } catch (err) {
    console.error('[facebookService][saveLeadToDB] Error saving lead:', err.message);
    throw err;
  }
}

/**
 * fetchLeadData — public function to fetch lead data from Meta Graph API,
 * log the full response, and persist it to MongoDB via `saveLeadToDB`.
 *
 * @param {String} leadId  — Facebook leadgen_id
 * @param {String} formId  — Facebook form_id (from webhook payload)
 * @param {String} pageId  — Facebook page_id (from webhook payload)
 *
 * Throws on fatal errors; callers should handle or log errors accordingly.
 */
async function fetchLeadData(leadId, formId, pageId) {
  if (!leadId) throw new Error('leadId is required');

  try {
    const data = await fetchLeadDetails(leadId);
    console.info('[facebookService][fetchLeadData] Full lead data:', JSON.stringify(data));

    // Persist the lead into DB (idempotent)
    const saved = await saveLeadToDB(data, formId, pageId);
    return saved;
  } catch (err) {
    console.error('[facebookService][fetchLeadData] Error fetching or saving lead:', err.message);
    throw err;
  }
}

module.exports = { fetchLeadDetails, fetchLeadData, saveLeadToDB };
