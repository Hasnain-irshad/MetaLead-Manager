require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('../src/models/Lead');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/leadbridge';

async function verify() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('--- Lead Assignment Verification ---');

        const leads = await Lead.find({}).populate('assigned_agent', 'name').sort({ createdAt: -1 }).limit(10);

        if (leads.length === 0) {
            console.log('No leads found in database.');
        } else {
            leads.forEach((l, idx) => {
                console.log(`[${idx + 1}] Lead ID: ${l.leadId} | Agent: ${l.assigned_agent ? l.assigned_agent.name : 'UNASSIGNED'} | Status: ${l.status}`);
            });
        }

        process.exit(0);
    } catch (err) {
        console.error('Verification error:', err);
        process.exit(1);
    }
}

verify();
