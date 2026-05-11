require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/leadbridge';

async function run(){
  await mongoose.connect(MONGO_URI);
  const admins = await User.find({ role: 'admin' }).select('email name');
  if (!admins || admins.length === 0){
    console.log('NO_ADMIN_FOUND');
    process.exit(0);
  }
  // Print only safe info: index, id, email
  admins.forEach((a, idx) => {
    console.log(`${idx}: ${a._id.toString()} | ${a.email}`);
  });
  process.exit(0);
}

run().catch(err => { console.error('ERR', err); process.exit(2); });
