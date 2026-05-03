require('dotenv').config();
const mongoose = require('mongoose');
const { fetchLeadData } = require('../src/services/facebookService');

async function run() {
    process.env.MOCK_FACEBOOK = 'true';
    await mongoose.connect(process.env.MONGO_URI);
    try {
        const lead = await fetchLeadData('TEST_LEAD_ID_123', '24973126822363867', '1073025599216413');
        console.log('Lead saved successfully:', lead);
    } catch (err) {
        console.error('Test Failed:', err);
    }
    mongoose.disconnect();
}

run();
