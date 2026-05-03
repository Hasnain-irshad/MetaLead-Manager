const FieldMapping = require('../models/FieldMapping');
const Lead = require('../models/Lead');

/**
 * GET /api/field-mappings
 * Optional ?lead_type=CA to filter.
 */
async function listMappings(req, res) {
  try {
    const filter = {};
    if (req.query.lead_type) filter.lead_type = req.query.lead_type;
    const mappings = await FieldMapping.find(filter).sort({ lead_type: 1, facebook_field: 1 });
    res.json({ mappings });
  } catch (err) {
    console.error('[fieldMappingController][listMappings] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch field mappings' });
  }
}

/**
 * POST /api/field-mappings
 * Body: { lead_type, facebook_field, normalized_key, display_name }
 */
async function createMapping(req, res) {
  try {
    const { lead_type, facebook_field, normalized_key, display_name } = req.body;
    if (!lead_type || !facebook_field || !normalized_key || !display_name) {
      return res.status(400).json({ error: 'lead_type, facebook_field, normalized_key, and display_name are all required' });
    }
    const mapping = await FieldMapping.create({
      lead_type, facebook_field, normalized_key, display_name
    });
    res.status(201).json({ mapping });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A mapping for this lead_type + facebook_field already exists' });
    }
    console.error('[fieldMappingController][createMapping] Error:', err.message);
    res.status(500).json({ error: 'Failed to create mapping' });
  }
}

/**
 * PUT /api/field-mappings/:id
 * Body may contain any of: facebook_field, normalized_key, display_name, lead_type
 */
async function updateMapping(req, res) {
  try {
    const updates = {};
    ['facebook_field', 'normalized_key', 'display_name', 'lead_type'].forEach(k => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    const mapping = await FieldMapping.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true
    });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    res.json({ mapping });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Another mapping with this lead_type + facebook_field already exists' });
    }
    console.error('[fieldMappingController][updateMapping] Error:', err.message);
    res.status(500).json({ error: 'Failed to update mapping' });
  }
}

/**
 * DELETE /api/field-mappings/:id
 */
async function deleteMapping(req, res) {
  try {
    const mapping = await FieldMapping.findByIdAndDelete(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    res.json({ message: 'Mapping deleted' });
  } catch (err) {
    console.error('[fieldMappingController][deleteMapping] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete mapping' });
  }
}

/**
 * GET /api/field-mappings/unmapped/:lead_type
 *
 * Aggregates raw Facebook field names that have appeared on at least one lead
 * of `lead_type` but don't yet have a FieldMapping row. Useful for the admin
 * "needs review" panel in the Field Mapping UI.
 */
async function listUnmappedForType(req, res) {
  try {
    const { lead_type } = req.params;
    if (!lead_type) return res.status(400).json({ error: 'lead_type is required' });

    // Collect unmapped_fields seen in leads of this type.
    const leads = await Lead.find({ lead_type }, { unmapped_fields: 1 }).lean();
    const seen = new Set();
    leads.forEach(l => (l.unmapped_fields || []).forEach(k => seen.add(k)));

    // Filter out any keys that already have a mapping (in case mapping was
    // added after the lead was ingested).
    const existing = await FieldMapping.find(
      { lead_type, facebook_field: { $in: Array.from(seen) } },
      { facebook_field: 1 }
    ).lean();
    const mapped = new Set(existing.map(m => m.facebook_field));

    const unmapped = Array.from(seen).filter(k => !mapped.has(k)).sort();
    res.json({ lead_type, unmapped });
  } catch (err) {
    console.error('[fieldMappingController][listUnmappedForType] Error:', err.message);
    res.status(500).json({ error: 'Failed to compute unmapped fields' });
  }
}

module.exports = {
  listMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  listUnmappedForType
};
