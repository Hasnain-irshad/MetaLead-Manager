import React from 'react';

/**
 * LeadsTable — Tailwind-styled data table with color-coded status badges
 * and action buttons. 
 *
 * Props:
 *   leads        — array of lead objects
 *   onOpen       — callback when user clicks a row action
 *   onDelete     — callback when user clicks delete button
 *   onSelect     — callback when user selects/deselects a lead (leadId, isSelected)
 *   selectedIds  — set of currently selected lead IDs
 *   showAgent    — boolean, if true shows the assigned agent column (for admins)
 */

// Map status → badge CSS class (defined in index.css)
const BADGE_MAP = {
  new: 'badge-pending',
  contacted: 'badge-contacted',
  interested: 'badge-interested',
  not_interested: 'badge-not-interested',
  follow_up: 'badge-warning',
  admission_done: 'badge-success',
  other: 'badge-other',
  not_connected: 'badge-other',
};

const DISPLAY_LABEL = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not Interested',
  follow_up: 'Follow Up',
  admission_done: 'Done',
  other: 'Other',
  not_connected: 'Not Connected'
};

// Map lead types to friendly labels or icons if needed
const LEAD_TYPE_LABELS = {
  admission_inquiry: 'Admission',
  course_information: 'Course Info',
  scholarship_application: 'Scholarship',
  career_counselling: 'Counselling',
};

export default function LeadsTable({ leads, onOpen, onDelete, onSelect, selectedIds = new Set(), showAgent, startIndex = 0 }) {
  const handleSelectAll = (e) => {
    if (!onSelect) return; // Skip if no selection handler
    
    if (e.target.checked) {
      // Select all
      leads.forEach(lead => {
        if (!selectedIds.has(lead._id)) {
          onSelect(lead._id, true);
        }
      });
    } else {
      // Deselect all
      leads.forEach(lead => {
        if (selectedIds.has(lead._id)) {
          onSelect(lead._id, false);
        }
      });
    }
  };

  const allSelected = leads.length > 0 && leads.every(lead => selectedIds.has(lead._id));
  const someSelected = leads.some(lead => selectedIds.has(lead._id));

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
            <tr>
            {onSelect && (
              <th className="w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 cursor-pointer"
                />
              </th>
            )}
            <th className="w-12 text-left">#</th>
            <th>Full Name</th>
            <th>Email</th>
            <th>Type</th>
            <th>Form Name</th>
            {showAgent && <th>Agent</th>}
            <th>Created</th>
            <th>Status</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, idx) => (
            <tr key={lead._id} className={`hover:bg-gray-50/50 transition-colors ${onSelect && selectedIds?.has(lead._id) ? 'bg-blue-50' : ''}`}>
              {onSelect && (
                <td className="w-8 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(lead._id) || false}
                    onChange={(e) => onSelect(lead._id, e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </td>
              )}
              <td className="w-12 text-sm text-gray-600 text-left">{startIndex + idx + 1}</td>
              <td className="font-medium text-gray-900">
                <div className="max-w-[150px] truncate" title={lead.full_name}>
                  {lead.full_name || '—'}
                </div>
              </td>
              <td>
                <div className="max-w-[180px] truncate" title={lead.email}>
                  {lead.email || '—'}
                </div>
              </td>
              <td className="text-xs font-semibold text-gray-500">
                {LEAD_TYPE_LABELS[lead.lead_type] || lead.lead_type || '—'}
              </td>
              <td>
                <div className="max-w-[150px] truncate text-xs text-gray-500" title={lead.form_name}>
                  {lead.form_name || lead.form_id || '—'}
                </div>
              </td>
              {showAgent && (
                <td className="text-sm font-medium text-primary-600">
                  {lead.assigned_agent?.name || 'Unassigned'}
                </td>
              )}
              <td className="text-xs">
                {lead.created_time ? new Date(lead.created_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
              </td>
              <td>
                <span className={`badge ${BADGE_MAP[lead.status] || 'badge-pending'}`}>
                  {DISPLAY_LABEL[lead.status] || (lead.status || 'new').replace(/_/g, ' ')}
                </span>
              </td>
              <td className="text-right">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onOpen(lead)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 
                               bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Details
                  </button>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(lead._id, lead.full_name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 
                                 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                      title="Delete this lead"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
