const mongoose = require('mongoose');

/**
 * GlobalSettings — singleton document that stores all
 * admin-controlled system configuration.
 *
 * Only one document should exist; helpers ensure upsert behaviour.
 */
const GlobalSettingsSchema = new mongoose.Schema(
    {
        // ── Lead Assignment ──
        autoAssign: {
            type: Boolean,
            default: true
        },
        assignmentStrategy: {
            type: String,
            enum: ['ROUND_ROBIN', 'TYPE_BASED', 'HYBRID'],
            default: 'ROUND_ROBIN'
        },
        duplicateHandling: {
            type: String,
            enum: ['ALLOW', 'BLOCK', 'MERGE'],
            default: 'ALLOW'
        },

        // ── Agent Management ──
        maxLeadsPerAgent: {
            type: Number,
            default: 0  // 0 = unlimited
        },
        autoReassign: {
            type: Boolean,
            default: false
        },

        // ── System ──
        timezone: {
            type: String,
            default: 'Asia/Karachi'
        },
        dateFormat: {
            type: String,
            enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
            default: 'DD/MM/YYYY'
        },

        // ── Facebook Integration ──
        token_created_at: {
            type: Date,
            description: 'Timestamp when Facebook PAGE_ACCESS_TOKEN was created. Tokens expire after ~60 days.'
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('GlobalSettings', GlobalSettingsSchema);
