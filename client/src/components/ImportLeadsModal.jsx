import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import Papa from 'papaparse';

export default function ImportLeadsModal({ onClose, onSuccess }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState([]);
    const [allData, setAllData] = useState([]); // Store all parsed data
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [step, setStep] = useState('upload'); // upload, preview, done
    const [leadTypeOverride, setLeadTypeOverride] = useState('');
    const [knownLeadTypes, setKnownLeadTypes] = useState([]);

    // Load known lead types so admin can pick from existing ones (or type a new one).
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
                setKnownLeadTypes(merged);
            } catch (err) {
                console.error('Failed to load lead types:', err);
            }
        })();
    }, []);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError('');

        // Parse CSV file
        if (selectedFile.name.endsWith('.csv')) {
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    if (results.data.length === 0) {
                        setError('CSV file is empty');
                        return;
                    }
                    setAllData(results.data); // Store all data
                    setPreview(results.data.slice(0, 5)); // Show first 5 rows in preview
                    setStep('preview');
                },
                error: (err) => {
                    setError(`CSV parsing error: ${err.message}`);
                }
            });
        } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
            // For Excel - would need xlsx library
            setError('Excel import coming soon. Please use CSV file instead.');
        } else {
            setError('Please select a CSV or Excel file');
        }
    };

    const handleImport = async () => {
        if (allData.length === 0) return;

        setLoading(true);
        setError('');

        try {
            // Send the full raw rows — the backend handles header-name
            // normalization, prefix stripping (e.g. "f:..." form_id), and
            // routing all non-core columns into extra_fields.
            console.log('Sending to API:', allData.length, 'rows from', file?.name, '| override:', leadTypeOverride || '(none)');
            const result = await api.importLeads(allData, file?.name, leadTypeOverride);

            // Show detailed errors if any
            let successMessage = `✓ Imported ${result.successCount} leads successfully`;
            if (result.errorCount > 0) {
                successMessage += ` (${result.errorCount} failed)`;
                if (result.errors && result.errors.length > 0) {
                    successMessage += ':\n\n' + result.errors.join('\n');
                }
            }

            setSuccessMessage(successMessage);
            setStep('done');

            // Auto-close after 5 seconds (longer if there are errors)
            setTimeout(() => {
                onSuccess();
                onClose();
            }, result.errorCount > 0 ? 5000 : 3000);
        } catch (err) {
            setError(`Import failed: ${err.message}`);
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setStep('upload');
        setFile(null);
        setPreview([]);
        setAllData([]);
        setError('');
        setSuccessMessage('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Import Leads</h2>

                {step === 'upload' && (
                    <div>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33A3 3 0 0116.5 19.5H6.75z" />
                            </svg>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <span className="text-primary-600 font-medium hover:text-primary-700">
                                    Click to upload
                                </span>
                                <span className="text-gray-500"> or drag and drop</span>
                            </label>
                            <p className="text-sm text-gray-500 mt-2">CSV or Excel file (max 10MB)</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {step === 'preview' && (
                    <div>
                        <p className="text-gray-600 mb-4">
                            Preview of leads to import (showing first 5 of {allData.length} total):
                        </p>

                        {/* Lead type override — applies to every row in this import */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <label className="block text-xs font-bold text-blue-800 uppercase tracking-widest mb-1.5">
                                Lead Type for this import (optional)
                            </label>
                            <input
                                type="text"
                                list="known-lead-types"
                                value={leadTypeOverride}
                                onChange={(e) => setLeadTypeOverride(e.target.value)}
                                placeholder="Pick or type — e.g. IELTS, CA, ACCA, Admission"
                                className="w-full bg-white border border-blue-200 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 block p-2.5"
                            />
                            <datalist id="known-lead-types">
                                {knownLeadTypes.map(t => <option key={t} value={t} />)}
                            </datalist>
                            <p className="text-xs text-blue-700 mt-1.5">
                                Every imported lead will be tagged with this type and routed to a matching agent.
                                Leave blank to use the type from your CSV or matching Form.
                            </p>
                        </div>

                        {/* Validation warning */}
                        {allData.some(r => !((r.full_name || r['Full Name'] || '').trim()) || !((r.email || r['Email'] || '').trim())) && (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4 text-sm">
                                <p className="font-medium">⚠ Warning: Some rows have missing required fields (Name or Email)</p>
                                <p className="text-xs mt-1">These rows will fail to import. Please check your CSV file.</p>
                            </div>
                        )}

                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-sm border border-gray-200 rounded">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-gray-700 font-semibold">Name</th>
                                        <th className="px-4 py-2 text-left text-gray-700 font-semibold">Email</th>
                                        <th className="px-4 py-2 text-left text-gray-700 font-semibold">Lead Type</th>
                                        <th className="px-4 py-2 text-left text-gray-700 font-semibold">Phone</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.map((row, idx) => {
                                        const name = (row.full_name || row['Full Name'] || '').trim();
                                        const email = (row.email || row['Email'] || '').trim();
                                        const hasIssue = !name || !email;
                                        return (
                                            <tr key={idx} className={`border-b border-gray-200 ${hasIssue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                                                <td className={`px-4 py-2 ${!name ? 'text-red-600 font-medium' : ''}`}>{name || '⚠ MISSING'}</td>
                                                <td className={`px-4 py-2 ${!email ? 'text-red-600 font-medium' : ''}`}>{email || '⚠ MISSING'}</td>
                                                <td className="px-4 py-2">{(row.lead_type || row['Lead Type'] || '') || '-'}</td>
                                                <td className="px-4 py-2">{(row.phone_number || row['Phone Number'] || row['Phone'] || '') || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <p className="text-sm text-gray-500 mb-4">
                            Total leads to import: <span className="font-semibold">{preview.length}</span>
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={handleCancel}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={loading}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:bg-gray-400"
                            >
                                {loading ? 'Importing...' : 'Confirm & Import'}
                            </button>
                        </div>
                    </div>
                )}

                {step === 'done' && (
                    <div className="text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-lg font-semibold text-gray-900 mb-2">Import Completed</p>
                        <div className="text-gray-600 mb-4 text-left max-h-80 overflow-y-auto">
                            <p className="mb-3 font-medium">✓ {successMessage.split('successfully')[0]}successfully</p>
                            {successMessage.includes('failed') && (
                                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                                    <p className="font-medium text-red-700 mb-2">Failed imports:</p>
                                    <ul className="text-red-600 space-y-1">
                                        {successMessage.split('\n').slice(1).filter(e => e.trim()).map((error, idx) => (
                                            <li key={idx} className="text-xs">• {error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-gray-500">Closing in a moment...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
