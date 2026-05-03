require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');

const MONGO_URI = process.env.MONGO_URI;
const APPLY = process.argv.includes('--apply');

(async () => {
  await mongoose.connect(MONGO_URI, { dbName: 'leadbridge' });
  console.log(APPLY ? '\n=== APPLYING home_agent BACKFILL ===' : '\n=== DRY RUN (no writes) ===');

  // Candidates: leads that currently have an assigned_agent but no home_agent.
  const filter = {
    home_agent: null,
    assigned_agent: { $ne: null }
  };
  const count = await Lead.countDocuments(filter);
  console.log(`Found ${count} lead(s) with assigned_agent but no home_agent`);

  if (count === 0) {
    console.log('Nothing to backfill.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (APPLY) {
    // Use updateMany with aggregation pipeline so each row's home_agent
    // copies from its own assigned_agent value.
    const result = await Lead.updateMany(
      filter,
      [{ $set: { home_agent: '$assigned_agent' } }]
    );
    console.log(`✓ Updated ${result.modifiedCount} lead(s)`);
  } else {
    console.log('Re-run with --apply to write.');
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
