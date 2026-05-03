/**
 * Shared helpers for safely patching Lead.extra_fields.
 * Extracted so both admin and agent controllers can share the allow-list.
 */

const TOP_LEVEL_RESERVED = new Set([
  '_id', 'leadId', 'full_name', 'email', 'phone_number',
  'form_id', 'form_name', 'lead_type', 'page_id', 'created_time',
  'assigned_agent', 'status', 'comments', 'rawData',
  'unmapped_fields', 'extra_fields', 'import_batch',
  'createdAt', 'updatedAt', '__v'
]);

/**
 * Strip any keys that map to top-level Lead columns. Top-level fields have
 * dedicated endpoints; this helper protects the extra_fields PATCH from
 * being abused to overwrite them.
 */
function sanitizeExtraFieldUpdates(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const cleaned = {};
  for (const k of Object.keys(raw)) {
    if (TOP_LEVEL_RESERVED.has(k)) continue;
    cleaned[k] = raw[k];
  }
  return cleaned;
}

/**
 * Apply a sanitized patch onto a Lead document's extra_fields Map.
 * Mutates the lead in place; caller is responsible for `await lead.save()`.
 */
function applyExtraFieldUpdates(lead, updates) {
  if (!lead.extra_fields) {
    lead.extra_fields = new Map();
  }
  for (const k of Object.keys(updates)) {
    lead.extra_fields.set(k, updates[k]);
  }
}

module.exports = {
  TOP_LEVEL_RESERVED,
  sanitizeExtraFieldUpdates,
  applyExtraFieldUpdates
};
