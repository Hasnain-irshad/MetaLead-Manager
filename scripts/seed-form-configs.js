require('dotenv').config();
const mongoose = require('mongoose');
const FormConfig = require('../src/models/FormConfig');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/leadbridge';

/**
 * Pre-defined per-leadType form structures. These drive the dynamic Lead detail UI.
 * Re-runnable: existing configs are upserted, not duplicated.
 */
const PRESETS = [
  {
    lead_type: 'ACCA',
    fields: [
      { key: 'full_name',        label: 'Full Name',        type: 'text',     required: true },
      { key: 'phone_number',     label: 'Phone',            type: 'phone',    required: true },
      { key: 'email',            label: 'Email',            type: 'email',    required: true },
      { key: 'education_level',  label: 'Education Level',  type: 'text' },
      { key: 'city',             label: 'City',             type: 'text' },
      { key: 'start_plan',       label: 'Start Plan',       type: 'text' },
      { key: 'mode',             label: 'Study Mode',       type: 'select',   options: ['Recorded', 'Online'] },
      { key: 'date',             label: 'Date',             type: 'date' },
      { key: 'remarks',          label: 'Remarks',          type: 'textarea' },
      { key: 'followup_remarks', label: 'Follow-up Remarks',type: 'textarea' },
      { key: 'followup_date',    label: 'Follow-up Date',   type: 'date' }
    ]
  },
  {
    lead_type: 'CA',
    fields: [
      { key: 'level',            label: 'Level',            type: 'text' },
      { key: 'subjects',         label: 'Subjects',         type: 'text' },
      { key: 'start_plan',       label: 'Start Plan',       type: 'text' },
      { key: 'email',            label: 'Email',            type: 'email',    required: true },
      { key: 'full_name',        label: 'Full Name',        type: 'text',     required: true },
      { key: 'phone_number',     label: 'Phone',            type: 'phone',    required: true },
      { key: 'education_level',  label: 'Education Level',  type: 'text' },
      { key: 'date',             label: 'Date',             type: 'date' },
      { key: 'remarks',          label: 'Remarks',          type: 'textarea' },
      { key: 'follow_up',        label: 'Follow Up',        type: 'textarea' }
    ]
  },
  {
    lead_type: 'Other',
    fields: [
      { key: 'lead_id',          label: 'Lead ID',          type: 'text' },
      { key: 'date',             label: 'Date',             type: 'date' },
      { key: 'full_name',        label: 'Name',             type: 'text',     required: true },
      { key: 'phone_number',     label: 'Contact Number',   type: 'phone',    required: true },
      { key: 'email',            label: 'Email Address',    type: 'email',    required: true },
      { key: 'city',             label: 'City',             type: 'text' },
      { key: 'course_interested',label: 'Course Interested',type: 'text' },
      { key: 'assigned_to',      label: 'Assigned To',      type: 'text' },
      { key: 'call_status',      label: 'Call Status',      type: 'select',   options: ['Pending', 'Completed', 'No Answer', 'Callback'] },
      { key: 'follow_up_date',   label: 'Follow-up Date',   type: 'date' },
      { key: 'remarks',          label: 'Remarks',          type: 'textarea' },
      { key: 'converted',        label: 'Converted',        type: 'checkbox' },
      { key: 'fee_received',     label: 'Fee Received',     type: 'number' }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for FormConfig seeding...');

    for (const preset of PRESETS) {
      const result = await FormConfig.findOneAndUpdate(
        { lead_type: preset.lead_type },
        { lead_type: preset.lead_type, fields: preset.fields },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      console.log(`✓ Upserted FormConfig: ${result.lead_type} (${result.fields.length} fields)`);
    }

    console.log('FormConfig seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
