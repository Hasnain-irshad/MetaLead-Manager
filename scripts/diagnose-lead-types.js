require('dotenv').config();
const mongoose = require('mongoose');
const Form = require('../src/models/Form');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI;

(async () => {
  await mongoose.connect(MONGO_URI, { dbName: 'leadbridge' });

  console.log('\n=== FORMS ===');
  const forms = await Form.find().lean();
  for (const f of forms) {
    console.log(JSON.stringify({
      _id: String(f._id),
      form_id: f.form_id,
      form_name: f.form_name,
      lead_type: f.lead_type,
      lead_type_chars: [...(f.lead_type || '')].map(c => c.charCodeAt(0))
    }));
  }

  console.log('\n=== AGENTS ===');
  const agents = await User.find({ role: 'agent' }).lean();
  for (const a of agents) {
    console.log(JSON.stringify({
      name: a.name,
      active: a.active,
      workStatus: a.workStatus,
      leadTypes: a.leadTypes,
      leadTypes_chars: (a.leadTypes || []).map(t => [t, [...t].map(c => c.charCodeAt(0))])
    }));
  }

  console.log('\n=== LEADS (most recent 20) ===');
  const leads = await Lead.find().sort({ createdAt: -1 }).limit(20).lean();
  for (const l of leads) {
    console.log(JSON.stringify({
      _id: String(l._id),
      form_id: l.form_id,
      form_name: l.form_name,
      lead_type: l.lead_type,
      lead_type_chars: [...(l.lead_type || '')].map(c => c.charCodeAt(0)),
      assigned_agent: l.assigned_agent ? String(l.assigned_agent) : null,
      status: l.status
    }));
  }

  console.log('\n=== LEADS GROUPED BY (form_id, lead_type) ===');
  const grouped = await Lead.aggregate([
    { $group: { _id: { form_id: '$form_id', lead_type: '$lead_type' }, count: { $sum: 1 } } },
    { $sort: { '_id.form_id': 1 } }
  ]);
  console.log(JSON.stringify(grouped, null, 2));

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
