import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

/**
 * ImportHistory — list every CSV/Excel import as a "file" the admin can
 * remove. Removing a file deletes its tagged leads but never touches
 * Facebook-sourced leads (which have import_batch = null).
 */
export default function ImportHistory({ onBack, onChange }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    load();
  }, []);

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  async function load() {
    setLoading(true);
    try {
      const res = await api.fetchImportBatches();
      setBatches(res.batches || []);
    } catch (err) {
      console.error('Failed to load import batches:', err);
      showMessage('error', 'Failed to load import history.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(batch) {
    const confirmMsg =
      `Remove import "${batch.filename}"?\n\n` +
      `${batch.live_count} lead${batch.live_count === 1 ? '' : 's'} from this file will be permanently deleted.\n` +
      `Facebook-sourced leads will NOT be affected.`;
    if (!window.confirm(confirmMsg)) return;

    setRemoving(batch._id);
    try {
      const res = await api.deleteImportBatch(batch._id);
      showMessage('success', `Removed "${res.filename}". ${res.deletedLeads} lead${res.deletedLeads === 1 ? '' : 's'} deleted.`);
      load();
      if (onChange) onChange();
    } catch (err) {
      console.error('Remove failed:', err);
      showMessage('error', err.response?.data?.error || 'Failed to remove import.');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 bg-white text-gray-500 rounded-xl hover:bg-gray-50 hover:text-gray-700 shadow-sm transition-all border border-gray-200"
          title="Back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Import History</h2>
          <p className="text-gray-500 text-sm mt-1">Remove a file to permanently delete the leads that came from it. Facebook leads are never affected.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading…</div>
        ) : batches.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No imports yet. Upload a CSV from the Lead Inventory toolbar.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Imported</th>
                <th>Leads (current)</th>
                <th>Failed at import</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b._id}>
                  <td className="font-medium text-gray-900 break-all">{b.filename}</td>
                  <td className="text-xs text-gray-500">
                    {b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className={`badge ${b.live_count > 0 ? 'badge-interested' : 'badge-other'}`}>
                      {b.live_count}{b.count > 0 && b.live_count !== b.count ? ` of ${b.count}` : ''}
                    </span>
                  </td>
                  <td className="text-xs text-gray-500">{b.failed_count || 0}</td>
                  <td className="text-right">
                    <button
                      onClick={() => handleRemove(b)}
                      disabled={removing === b._id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {removing === b._id ? 'Removing…' : 'Remove File'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
