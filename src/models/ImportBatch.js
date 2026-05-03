const mongoose = require('mongoose');

/**
 * ImportBatch — one document per CSV/Excel import. Every Lead created from
 * that import is tagged with `import_batch` pointing here, so admins can
 * later remove an entire batch (and only that batch, leaving Facebook-sourced
 * leads untouched).
 */
const ImportBatchSchema = new mongoose.Schema(
  {
    filename: { type: String, default: 'unknown.csv' },
    count: { type: Number, default: 0 },
    failed_count: { type: Number, default: 0 },
    imported_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ImportBatch', ImportBatchSchema);
