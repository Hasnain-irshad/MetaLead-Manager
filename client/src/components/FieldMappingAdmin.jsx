import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

/**
 * FieldMappingAdmin — manage Facebook-field → normalized-key mappings per lead_type.
 * Also surfaces "unmapped" raw FB field names that have appeared on real leads
 * but don't yet have a mapping.
 */
export default function FieldMappingAdmin({ onBack }) {
  const [forms, setForms] = useState([]);
  const [leadTypes, setLeadTypes] = useState([]);
  const [activeLeadType, setActiveLeadType] = useState('');
  const [mappings, setMappings] = useState([]);
  const [unmapped, setUnmapped] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Edit state
  const [draft, setDraft] = useState(null);

  // Initial load: pull lead_types from forms + form configs.
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
        setForms(formsRes.forms || []);
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
      const [mapRes, unmapRes] = await Promise.all([
        api.fetchFieldMappings(activeLeadType),
        api.fetchUnmappedFields(activeLeadType)
      ]);
      setMappings(mapRes.mappings || []);
      setUnmapped(unmapRes.unmapped || []);
    } catch (err) {
      console.error('Failed to load mappings:', err);
      setMessage({ type: 'error', text: 'Failed to load mappings.' });
    } finally {
      setLoading(false);
    }
  }, [activeLeadType]);

  useEffect(() => { reload(); }, [reload]);

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  function startCreate(prefillFb = '') {
    setDraft({
      _id: null,
      lead_type: activeLeadType,
      facebook_field: prefillFb,
      normalized_key: '',
      display_name: ''
    });
  }

  function startEdit(m) {
    setDraft({ ...m });
  }

  async function handleSave() {
    if (!draft) return;
    const payload = {
      lead_type: draft.lead_type,
      facebook_field: draft.facebook_field.trim(),
      normalized_key: draft.normalized_key.trim(),
      display_name: draft.display_name.trim()
    };
    if (!payload.facebook_field || !payload.normalized_key || !payload.display_name) {
      showMessage('error', 'All fields are required.');
      return;
    }
    try {
      if (draft._id) {
        await api.updateFieldMapping(draft._id, payload);
        showMessage('success', 'Mapping updated.');
      } else {
        await api.createFieldMapping(payload);
        showMessage('success', 'Mapping created.');
      }
      setDraft(null);
      reload();
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Save failed.');
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this mapping?')) return;
    try {
      await api.deleteFieldMapping(id);
      showMessage('success', 'Mapping deleted.');
      reload();
    } catch (err) {
      showMessage('error', err.response?.data?.error || 'Delete failed.');
    }
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
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Field Mapping</h2>
          <p className="text-gray-500 text-sm mt-1">Translate raw Facebook field names into clean normalized keys per lead type.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message.text}
        </div>
      )}

      {/* Lead type selector */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 mb-6">
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Lead Type</label>
        <div className="flex flex-wrap gap-2">
          {leadTypes.length === 0 ? (
            <span className="text-sm text-gray-400 italic">No lead types found. Sync forms or seed configs first.</span>
          ) : leadTypes.map(lt => (
            <button
              key={lt}
              onClick={() => setActiveLeadType(lt)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeLeadType === lt
                  ? 'bg-primary-600 text-white shadow'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {lt}
            </button>
          ))}
        </div>
      </div>

      {activeLeadType && (
        <>
          {/* Unmapped fields panel */}
          {unmapped.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
              <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.5 0l-7.1 12.25A2 2 0 005 19z" />
                </svg>
                Unmapped fields seen on leads ({unmapped.length})
              </h3>
              <p className="text-xs text-amber-700 mb-3">These raw Facebook fields have appeared on incoming leads but don't yet have a mapping. Click one to create a mapping.</p>
              <div className="flex flex-wrap gap-2">
                {unmapped.map(fb => (
                  <button
                    key={fb}
                    onClick={() => startCreate(fb)}
                    className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 text-xs font-mono rounded-lg hover:bg-amber-100"
                  >
                    + {fb}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mappings table */}
          <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Mappings for {activeLeadType}</h3>
              <button
                onClick={() => startCreate()}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Add Mapping
              </button>
            </div>
            {loading ? (
              <div className="p-12 text-center text-gray-400">Loading…</div>
            ) : mappings.length === 0 ? (
              <div className="p-12 text-center text-gray-400">No mappings yet for this lead type.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Facebook Field (raw)</th>
                    <th>Normalized Key</th>
                    <th>Display Name</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(m => (
                    <tr key={m._id}>
                      <td className="font-mono text-xs text-gray-600">{m.facebook_field}</td>
                      <td className="font-mono text-xs text-primary-600">{m.normalized_key}</td>
                      <td className="font-medium text-gray-900">{m.display_name}</td>
                      <td className="text-right flex items-center justify-end gap-3">
                        <button onClick={() => startEdit(m)} className="text-primary-600 hover:text-primary-800 text-xs font-bold">Edit</button>
                        <button onClick={() => handleDelete(m._id)} className="text-red-500 hover:text-red-700 text-xs font-bold">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Edit / create modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in" onClick={(e) => e.target === e.currentTarget && setDraft(null)}>
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md animate-slide-up">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{draft._id ? 'Edit Mapping' : 'New Mapping'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">For lead type: {draft.lead_type}</p>
            </div>
            <div className="p-6 space-y-4">
              <Field label="Facebook Field (raw)" value={draft.facebook_field}
                     onChange={v => setDraft({ ...draft, facebook_field: v })}
                     placeholder="e.g. which_level_do_you_want_to_enroll_in?" mono />
              <Field label="Normalized Key" value={draft.normalized_key}
                     onChange={v => setDraft({ ...draft, normalized_key: v })}
                     placeholder="e.g. level" mono />
              <Field label="Display Name" value={draft.display_name}
                     onChange={v => setDraft({ ...draft, display_name: v })}
                     placeholder="e.g. Education Level" />
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button onClick={() => setDraft(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={handleSave} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, mono }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`input-field ${mono ? 'font-mono text-sm' : ''}`}
      />
    </div>
  );
}
