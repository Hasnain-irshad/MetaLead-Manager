require('dotenv').config();
const mongoose = require('mongoose');
const Form = require('../src/models/Form');
const Lead = require('../src/models/Lead');

const MONGO_URI = process.env.MONGO_URI;
const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(MONGO_URI, { dbName: 'leadbridge' });
  console.log(APPLY ? '\n=== APPLYING BACKFILL ===' : '\n=== DRY RUN (no writes) ===');

  const forms = await Form.find().lean();
  let totalToUpdate = 0;
  let totalUpdated = 0;

  for (const form of forms) {
    if (!form.form_id || !form.lead_type) continue;

    // Find leads whose lead_type is out of sync with the form's current value.
    const mismatched = await Lead.find(
      { form_id: form.form_id, lead_type: { $ne: form.lead_type } },
      { _id: 1, lead_type: 1 }
    ).lean();

    if (mismatched.length === 0) {
      console.log(`✓ "${form.form_name}" (form_id ${form.form_id}) — all ${form.lead_type === undefined ? '?' : form.lead_type} leads in sync`);
      continue;
    }

    const fromCounts = {};
    mismatched.forEach(l => { fromCounts[l.lead_type || '<null>'] = (fromCounts[l.lead_type || '<null>'] || 0) + 1; });
    const summary = Object.entries(fromCounts).map(([k, v]) => `"${k}" × ${v}`).join(', ');
    console.log(`→ "${form.form_name}" (form_id ${form.form_id}): ${mismatched.length} lead(s) will go ${summary} → "${form.lead_type}"`);
    totalToUpdate += mismatched.length;

    if (APPLY) {
      const result = await Lead.updateMany(
        { form_id: form.form_id, lead_type: { $ne: form.lead_type } },
        { $set: { lead_type: form.lead_type, form_name: form.form_name } }
      );
      totalUpdated += result.modifiedCount || 0;
      console.log(`  ✓ Updated ${result.modifiedCount} leads`);
    }
  }

  console.log('');
  if (APPLY) {
    console.log(`=== DONE: ${totalUpdated} lead(s) updated ===`);
  } else {
    console.log(`=== DRY RUN: ${totalToUpdate} lead(s) would be updated. Re-run with --apply to write. ===`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
