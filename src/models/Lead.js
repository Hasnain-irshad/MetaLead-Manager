const mongoose = require('mongoose');

/**
 * Lead schema — stores leads received from Facebook Lead Ads.
 *
 * Key additions over the original schema:
 *  - form_name / lead_type   → populated from the Form model on ingest
 *  - assigned_agent           → round-robin or manually assigned User
 *  - comments[].added_by     → ObjectId reference to the commenting User
 *  - expanded status enum    → covers the full lead lifecycle
 */
const LeadSchema = new mongoose.Schema(
  {
    leadId: { type: String, unique: true, sparse: true },

    // Contact info (extracted from Facebook field_data)
    full_name: { type: String },
    email: { type: String },
    phone_number: { type: String },

    // Form metadata
    form_id: { type: String },
    form_name: { type: String },
    lead_type: { type: String },

    // Page / time
    page_id: { type: String },
    created_time: { type: Date },

    // Assignment
    assigned_agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // The lead's "long-term owner" — set when the lead is first assigned and
    // preserved through temporary reroutes (e.g. when the agent goes offline).
    // When that agent comes back AVAILABLE, leads with home_agent === them and
    // a different current assigned_agent snap back. Permanent ownership
    // transfer requires updating this field explicitly.
    home_agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
      sparse: true
    },

    // Lifecycle status
    status: {
      type: String,
      enum: [
        'new',
        'contacted',
        'interested',
        'not_interested',
        'follow_up',
        'admission_done',
        'other',
        'not_connected'
      ],
      default: 'new'
    },

    // Comments with authorship tracking
    comments: [
      {
        text: { type: String, required: true },
        added_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        created_at: { type: Date, default: Date.now }
      }
    ],

    // Dynamic per-leadType fields. Keys are normalized via FieldMapping when a
    // mapping exists; otherwise the raw Facebook field name is used and the key
    // is also pushed into `unmapped_fields` so admins can review and map it.
    extra_fields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: undefined
    },

    // Raw Facebook field names captured on this lead that don't yet have a
    // FieldMapping for this leadType. Surfaced in admin UI as "needs mapping".
    unmapped_fields: [{ type: String }],

    // Set when this lead came from a CSV/Excel import. Null for Facebook-
    // sourced leads. Allows admins to undo an entire import batch.
    import_batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ImportBatch',
      default: null,
      index: true,
      sparse: true
    },

    // Raw Graph API response for debugging
    rawData: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Lead', LeadSchema);
