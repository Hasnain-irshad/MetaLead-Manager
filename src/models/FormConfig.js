const mongoose = require('mongoose');

/**
 * FormConfig — defines the rendering structure for a given lead_type.
 * Drives the dynamic Lead detail UI (Form Builder).
 *
 * Each field references a normalized_key that should match either:
 *  - a top-level Lead column (full_name, email, phone_number), OR
 *  - a key produced by FieldMapping.normalized_key.
 *
 * Uniqueness: one FormConfig per lead_type.
 */
const FormFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: ['text', 'email', 'phone', 'number', 'select', 'date', 'textarea', 'checkbox'],
      default: 'text'
    },
    required: { type: Boolean, default: false },
    options: [{ type: String }]
  },
  { _id: false }
);

const FormConfigSchema = new mongoose.Schema(
  {
    lead_type: { type: String, required: true, unique: true, index: true },
    fields: { type: [FormFieldSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('FormConfig', FormConfigSchema);
