import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

/**
 * FormBuilder — admin defines the per-leadType field structure that drives
 * the dynamic Lead detail UI. A field's `key` should match either a top-level
 * Lead column (full_name, email, phone_number) or a FieldMapping.normalized_key.
 */
const FIELD_TYPES = ['text', 'email', 'phone', 'number', 'select', 'date', 'textarea', 'checkbox'];

export default function FormBuilder({ onBack }) {
  const [leadTypes, setLeadTypes] = useState([]);
  const [activeLeadType, setActiveLeadType] = useState('');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [newLeadTypeName, setNewLeadTypeName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [formsRes, configsRes] = await Promise.all([
          api.fetchForms(),
          api.fetchFormConfigs()
        ]);
        const fromForms = (formsRes.forms || []).map(f => f.lead_type).filter(Boolean);
        const fromConfigs = (configsRes.configs || []).map(c => c.lead_type).filter(Boolean);
        const merged = Array.from(new Set([...fromForms, ...fromConfigs])).sort();
        setLeadTypes(merged);
        if (merged.length > 0) setActiveLeadType(merged[0]);
      } catch (err) {
        console.error('Failed to load lead types:', err);
        setMessage({ type: 'error', text: 'Failed to load lead types.' });
      }
    })();
  }, []);

  const reload = useCallback(async () => {
    if (!activeLeadType) return;
    setLoading(true);
    try {
      const res = await api.fetchFormConfig(activeLeadType);
      setFields(res.config?.fields || []);
    } catch (err) {
      // 404 → config doesn't exist yet, start with empty
      if (err.response?.status === 404) {
        setFields([]);
      } else {
        console.error('Failed to load form config:', err);
        setMessage({ type: 'error', text: 'Failed to load form config.' });
      }
    } finally {
      setLoading(false);
    }
  }, [activeLeadType]);

  useEffect(() => { reload(); }, [reload]);

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  function addField() {
    setFields([...fields, { key: '', label: '', type: 'text', required: false, options: [] }]);
  }

  function updateField(idx, patch) {
    setFields(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  function removeField(idx) {
    setFields(fields.filter((_, i) => i !== idx));
  }

  function moveField(idx, dir) {
    const next = [...fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFields(next);
  }

  async function handleSave() {
    if (!activeLeadType) return;
    // Validate keys + labels.
    for (const f of fields) {
      if (!f.key || !f.label) {
        showMessage('error', 'Every field needs both a key and a label.');
        return;
      }
    }
    setSaving(true);
    try {
      await api.saveFormConfig(activeLeadType, fields);
      showMessage('success', `Form config saved for ${activeLeadType}.`);
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  function handleAddLeadType() {
    const name = newLeadTypeName.trim();
    if (!name) return;
    if (leadTypes.includes(name)) {
      setActiveLeadType(name);
    } else {
      setLeadTypes([...leadTypes, name].sort());
      setActiveLeadType(name);
    }
    setNewLeadTypeName('');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 bg-white text-gray-500 rounded-xl hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all border border-gray-200" title="Back">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Form Builder</h2>
          <p className="text-gray-500 text-sm mt-1">Define what fields the Lead detail view should display per lead type.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !activeLeadType}
          className="btn-primary"
        >
          {saving ? 'Saving…' : 'Save Form'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message.text}
        </div>
      )}

      {/* Lead type selector + add new */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 mb-6">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Lead Type</label>
        <div className="flex flex-wrap gap-2 mb-3">
          {leadTypes.length === 0 ? (
            <span className="text-sm text-gray-400 italic">No lead types yet.</span>
          ) : leadTypes.map(lt => (
            <button
              key={lt}
              onClick={() => setActiveLeadType(lt)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeLeadType === lt ? 'bg-primary-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {lt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLeadTypeName}
            onChange={(e) => setNewLeadTypeName(e.target.value)}
            placeholder="Add new lead type (e.g. CA, ACCA, Tax)"
            className="input-field flex-1"
            onKeyDown={(e) => e.key === 'Enter' && handleAddLeadType()}
          />
          <button
            onClick={handleAddLeadType}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
          >
            + Add Type
          </button>
        </div>
      </div>

      {activeLeadType && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{activeLeadType} — Fields</h3>
            <button
              onClick={addField}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              Add Field
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading…</div>
          ) : fields.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No fields yet. Click "Add Field" to start building.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {fields.map((f, idx) => (
                <div key={idx} className="p-4 grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-1 flex flex-col gap-1">
                    <button onClick={() => moveField(idx, -1)} className="text-gray-400 hover:text-gray-700 text-xs" title="Move up">▲</button>
                    <button onClick={() => moveField(idx, 1)} className="text-gray-400 hover:text-gray-700 text-xs" title="Move down">▼</button>
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Key</label>
                    <input
                      type="text"
                      value={f.key}
                      onChange={(e) => updateField(idx, { key: e.target.value })}
                      placeholder="normalized_key"
                      className="input-field font-mono text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Label</label>
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      placeholder="Display label"
                      className="input-field"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Type</label>
                    <select
                      value={f.type}
                      onChange={(e) => updateField(idx, { type: e.target.value })}
                      className="input-field"
                    >
                      {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    {f.type === 'select' ? (
                      <>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Options (comma)</label>
                        <input
                          type="text"
                          value={(f.options || []).join(', ')}
                          onChange={(e) => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                          placeholder="A, B, C"
                          className="input-field"
                        />
                      </>
                    ) : (
                      <div className="pt-5">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!f.required}
                            onChange={(e) => updateField(idx, { required: e.target.checked })}
                            className="w-4 h-4"
                          />
                          Required
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 pt-5 text-right">
                    <button onClick={() => removeField(idx)} className="text-red-500 hover:text-red-700 text-xs font-bold">Remove</button>
                  </div>
                  {f.type === 'select' && (
                    <div className="col-span-12 pl-[8.33%]">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!f.required}
                          onChange={(e) => updateField(idx, { required: e.target.checked })}
                          className="w-4 h-4"
                        />
                        Required
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
