const mongoose = require('mongoose');

/**
 * Generic key-value settings store.
 * Used to persist application-level state such as
 * the round-robin assignment index.
 */
const SettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);
