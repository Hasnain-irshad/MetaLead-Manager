const mongoose = require('mongoose');

/**
 * FieldMapping — translates a raw Facebook field name into a normalized
 * key + human-friendly display name, scoped to a specific lead_type.
 *
 * Facebook form field names are often messy (e.g. "which_level_do_you_want_to_enroll_in?").
 * Admins create mappings so the system stores leads under stable, clean keys
 * that the FormConfig (form builder) can reference.
 *
 * Uniqueness: one mapping per (lead_type, facebook_field) pair.
 */
const FieldMappingSchema = new mongoose.Schema(
  {
    lead_type: { type: String, required: true, index: true },
    facebook_field: { type: String, required: true },
    normalized_key: { type: String, required: true },
    display_name: { type: String, required: true }
  },
  { timestamps: true }
);

FieldMappingSchema.index({ lead_type: 1, facebook_field: 1 }, { unique: true });

module.exports = mongoose.model('FieldMapping', FieldMappingSchema);
