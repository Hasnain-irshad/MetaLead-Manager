const FormConfig = require('../models/FormConfig');

/**
 * GET /api/form-configs
 */
async function listConfigs(req, res) {
  try {
    const configs = await FormConfig.find().sort({ lead_type: 1 });
    res.json({ configs });
  } catch (err) {
    console.error('[formConfigController][listConfigs] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch form configs' });
  }
}

/**
 * GET /api/form-configs/:lead_type
 */
async function getConfigByLeadType(req, res) {
  try {
    const config = await FormConfig.findOne({ lead_type: req.params.lead_type });
    if (!config) return res.status(404).json({ error: 'Form config not found for this lead_type' });
    res.json({ config });
  } catch (err) {
    console.error('[formConfigController][getConfigByLeadType] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch form config' });
  }
}

/**
 * PUT /api/form-configs/:lead_type
 * Upsert: create config if missing, replace `fields` array if present.
 * Body: { fields: [...] }
 */
async function upsertConfig(req, res) {
  try {
    const { lead_type } = req.params;
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ error: 'fields must be an array' });
    }
    // Validate each field has key + label.
    for (const f of fields) {
      if (!f || !f.key || !f.label) {
        return res.status(400).json({ error: 'Every field must have a key and a label' });
      }
    }
    const config = await FormConfig.findOneAndUpdate(
      { lead_type },
      { lead_type, fields },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.json({ config });
  } catch (err) {
    console.error('[formConfigController][upsertConfig] Error:', err.message);
    res.status(500).json({ error: 'Failed to save form config' });
  }
}

/**
 * DELETE /api/form-configs/:lead_type
 */
async function deleteConfig(req, res) {
  try {
    const config = await FormConfig.findOneAndDelete({ lead_type: req.params.lead_type });
    if (!config) return res.status(404).json({ error: 'Form config not found' });
    res.json({ message: 'Form config deleted' });
  } catch (err) {
    console.error('[formConfigController][deleteConfig] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete form config' });
  }
}

module.exports = { listConfigs, getConfigByLeadType, upsertConfig, deleteConfig };
