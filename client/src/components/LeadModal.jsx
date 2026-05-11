import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

/**
 * LeadModal — Detail view for leads with status management and commenting.
 * Renders fields dynamically based on FormConfig for the lead's lead_type;
 * falls back to a static layout when no FormConfig exists yet.
 */

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'admission_done', label: 'Admission Done' },
  { value: 'other', label: 'Other' }
  ,{ value: 'not_connected', label: 'Not Connected' }
];

// Top-level columns on the Lead document — looked up directly instead of
// going through extra_fields. Always rendered read-only since they come from
// the source (Facebook webhook / CSV import).
const TOP_LEVEL_KEYS = new Set(['full_name', 'email', 'phone_number', 'lead_type', 'form_name', 'created_time', 'status', 'leadId', 'assigned_agent']);

function getValueForKey(lead, key) {
  if (TOP_LEVEL_KEYS.has(key)) return lead[key];
  if (lead.extra_fields && Object.prototype.hasOwnProperty.call(lead.extra_fields, key)) {
    return lead.extra_fields[key];
  }
  return null;
}

function formatValue(value, type) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'date') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }
  if (type === 'checkbox') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Convert any incoming value into the format required by an HTML input of `type`. */
function toInputValue(value, type) {
  if (value === null || value === undefined) return type === 'checkbox' ? false : '';
  if (type === 'date') {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const d = new Date(value);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  if (type === 'checkbox') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return ['true', 'TRUE', 'yes', 'Yes', '1'].includes(value.trim());
    return Boolean(value);
  }
  return String(value);
}

/** Normalise for diff comparison so '' / null / undefined all collapse together. */
function normaliseForCompare(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  return String(v);
}

export default function LeadModal({ lead, onClose, onSave, isAdmin, agents = [], onReassign, onUpdateExtraFields }) {
  const [status, setStatus] = useState(lead.status || 'new');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(lead.assigned_agent?._id || '');
  const [formConfig, setFormConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  // Editable values for non-top-level FormConfig fields. Initialised on
  // configLoaded so we know which fields are editable.
  const [editableValues, setEditableValues] = useState({});

  // Pull FormConfig for this lead_type so the field rendering is dynamic.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!lead.lead_type) {
        setConfigLoaded(true);
        return;
      }
      try {
        const res = await api.fetchFormConfig(lead.lead_type);
        if (!cancelled) setFormConfig(res.config);
      } catch (err) {
        // 404 is expected when admin hasn't built a form for this type yet.
        if (err.response?.status !== 404) {
          console.error('Failed to load form config:', err);
        }
      } finally {
        if (!cancelled) setConfigLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [lead.lead_type]);

  // Initialise editable values from the lead's extra_fields whenever
  // the lead or its FormConfig changes.
  useEffect(() => {
    if (!configLoaded) return;
    const fields = formConfig?.fields || [];
    const init = {};
    for (const f of fields) {
      if (TOP_LEVEL_KEYS.has(f.key)) continue;
      const raw = lead.extra_fields ? lead.extra_fields[f.key] : null;
      init[f.key] = toInputValue(raw, f.type);
    }
    setEditableValues(init);
  }, [configLoaded, formConfig, lead]);

  function setEditable(key, value) {
    setEditableValues(prev => ({ ...prev, [key]: value }));
  }

  /**
   * Diff editableValues against the lead's stored extra_fields.
   * Returns the keys-and-values that have changed (only those need PATCH).
   */
  function getDirtyExtraFieldUpdates() {
    if (!formConfig?.fields) return {};
    const dirty = {};
    for (const f of formConfig.fields) {
      if (TOP_LEVEL_KEYS.has(f.key)) continue;
      const original = lead.extra_fields ? lead.extra_fields[f.key] : null;
      const originalNorm = normaliseForCompare(toInputValue(original, f.type));
      const currentNorm = normaliseForCompare(editableValues[f.key]);
      if (originalNorm !== currentNorm) {
        // Send the canonical value type (boolean for checkbox, raw string otherwise).
        dirty[f.key] = editableValues[f.key];
      }
    }
    return dirty;
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (isAdmin && onReassign && selectedAgentId !== (lead.assigned_agent?._id || '')) {
        await onReassign(lead._id, selectedAgentId);
      }

      const dirtyExtras = getDirtyExtraFieldUpdates();
      if (onUpdateExtraFields && Object.keys(dirtyExtras).length > 0) {
        await onUpdateExtraFields(lead._id, dirtyExtras);
      }

      await onSave({ status, comment });
      setComment('');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // Build the list of fields to render.
  // Prefer FormConfig if available; otherwise show a sensible default set.
  const configuredFields = formConfig?.fields?.length
    ? formConfig.fields
    : [
        { key: 'full_name',    label: 'Full Name', type: 'text' },
        { key: 'email',        label: 'Email',     type: 'email' },
        { key: 'phone_number', label: 'Phone',     type: 'phone' },
        { key: 'lead_type',    label: 'Lead Type', type: 'text' },
        { key: 'form_name',    label: 'Form Name', type: 'text' },
        { key: 'created_time', label: 'Created',   type: 'date' }
      ];

  // Keys present in extra_fields but not covered by configuredFields → show
  // in an "Other Fields" section so admins still see the data even if the
  // FormConfig is incomplete.
  const configuredKeys = new Set(configuredFields.map(f => f.key));
  const extraKeys = lead.extra_fields ? Object.keys(lead.extra_fields).filter(k => !configuredKeys.has(k)) : [];
  const unmappedSet = new Set(lead.unmapped_fields || []);

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
    >
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lead Details</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{lead.leadId || lead._id}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {!configLoaded ? (
            <div className="text-sm text-gray-400">Loading form…</div>
          ) : (
            <>
              {/* Form-config-driven fields. Top-level fields display read-only;
                  others render as inputs that get PATCHed on Save Changes. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {configuredFields.map(f => {
                  const isTopLevel = TOP_LEVEL_KEYS.has(f.key);
                  if (isTopLevel) {
                    return (
                      <DynamicField
                        key={f.key}
                        field={f}
                        value={getValueForKey(lead, f.key)}
                      />
                    );
                  }
                  return (
                    <EditableField
                      key={f.key}
                      field={f}
                      value={editableValues[f.key]}
                      onChange={(v) => setEditable(f.key, v)}
                    />
                  );
                })}
              </div>

              {/* Other (un-configured) extra_fields — still surface the data */}
              {extraKeys.length > 0 && (
                <div className="pt-4 border-t border-gray-50">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Other Fields</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    {extraKeys.map(k => (
                      <div key={k}>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5 flex items-center gap-2">
                          <span className="font-mono">{k}</span>
                          {unmappedSet.has(k) && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-bold">UNMAPPED</span>
                          )}
                        </p>
                        <p className="text-sm font-medium text-gray-900 break-words">
                          {formatValue(lead.extra_fields[k], 'text')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
            {/* Status Edit */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Update Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-field"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Agent Reassignment (Admin Only) */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a._id} value={a._id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Current Agent Info (Agent Only) */}
            {!isAdmin && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assigned To</label>
                <div className="p-2.5 bg-primary-50 text-primary-700 text-sm rounded-lg font-medium border border-primary-100">
                  {lead.assigned_agent?.name || 'You'}
                </div>
              </div>
            )}
          </div>

          {/* Add Comment */}
          <div className="pt-4 border-t border-gray-50">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Add Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write a note about the follow-up..."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          {/* Timeline/Comments */}
          <div className="pt-4 border-t border-gray-50">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              Timeline & Comments
            </h3>
            <div className="space-y-4">
              {(!lead.comments || lead.comments.length === 0) ? (
                <p className="text-sm text-gray-400 italic">No comments yet</p>
              ) : (
                [...lead.comments].reverse().map((c, idx) => (
                  <div key={idx} className="relative pl-6 pb-4 border-l-2 border-gray-100 last:border-0">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-primary-500 rounded-full" />
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-gray-900">
                          {c.added_by?.name || 'System / You'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(c.created_at || c.date).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 sticky bottom-0 z-10 backdrop-blur-md">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DynamicField({ field, value }) {
  const display = formatValue(value, field.type);
  const isEmail = field.type === 'email' && value;
  const isPhone = field.type === 'phone' && value;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5">{field.label}</p>
      {isEmail ? (
        <a href={`mailto:${value}`} className="text-sm font-medium text-primary-600 hover:underline break-all">{display}</a>
      ) : isPhone ? (
        <a href={`tel:${value}`} className="text-sm font-medium text-primary-600 hover:underline">{display}</a>
      ) : (
        <p className="text-sm font-medium text-gray-900 break-words" title={display}>{display}</p>
      )}
    </div>
  );
}

/**
 * EditableField — input variant of DynamicField for non-top-level FormConfig
 * fields. Picks an HTML input based on field.type. Edits are buffered in
 * parent state and committed when the user clicks Save Changes.
 */
function EditableField({ field, value, onChange }) {
  const labelEl = (
    <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-0.5 block">
      {field.label}{field.required ? <span className="text-red-500"> *</span> : null}
    </label>
  );

  if (field.type === 'textarea') {
    return (
      <div className="sm:col-span-2">
        {labelEl}
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="input-field resize-none"
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        {labelEl}
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="input-field"
        >
          <option value="">— Select —</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <div className="flex items-center gap-2 pt-4">
        <input
          type="checkbox"
          id={`ef-${field.key}`}
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
        />
        <label htmlFor={`ef-${field.key}`} className="text-sm font-medium text-gray-700">{field.label}</label>
      </div>
    );
  }

  // Default: text-style input — text / email / phone / number / date
  const inputType =
    field.type === 'date' ? 'date' :
    field.type === 'number' ? 'number' :
    field.type === 'email' ? 'email' :
    field.type === 'phone' ? 'tel' :
    'text';

  return (
    <div>
      {labelEl}
      <input
        type={inputType}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
      />
    </div>
  );
}
