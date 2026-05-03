require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./src/models/Lead');

async function checkLeads() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const leads = await Lead.find().limit(5).lean();
        console.log('Total leads found:', leads.length);

        leads.forEach((lead, index) => {
            console.log(`\n--- Lead ${index + 1} ---`);
            console.log('ID:', lead._id);
            console.log('Top-level Email:', lead.email);
            console.log('Top-level Name:', lead.full_name);
            if (lead.rawData && lead.rawData.field_data) {
                lead.rawData.field_data.forEach(f => {
                    console.log(`  Field: "${f.name}", Values:`, f.values);
                });
            }
        });

        await mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkLeads();
