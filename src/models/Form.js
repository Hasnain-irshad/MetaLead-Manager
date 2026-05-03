const mongoose = require('mongoose');

/**
 * Form schema — represents a Facebook Lead Ads form.
 * Each form maps to a specific lead_type so incoming leads
 * can be categorised automatically.
 */
const FormSchema = new mongoose.Schema(
    {
        form_id: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        form_name: {
            type: String,
            required: true
        },
        lead_type: {
            type: String,
            default: "Other"
        },
        page_id: {
            type: String
        },
        description: {
            type: String,
            default: ''
        },
        created_at: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Form', FormSchema);
