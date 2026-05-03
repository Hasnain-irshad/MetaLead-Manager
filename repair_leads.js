require('dotenv').config();
const mongoose = require('mongoose');
const Lead = require('./src/models/Lead');

async function repairLeads() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const leads = await Lead.find();
        console.log(`Found ${leads.length} leads to check.`);

        let updatedCount = 0;

        for (const lead of leads) {
            if (!lead.rawData || !lead.rawData.field_data) {
                console.log(`Skipping lead ${lead._id} (no rawData)`);
                continue;
            }

            const fieldData = lead.rawData.field_data;

            // Local extraction helper (matching the updated robust logic)
            function extractField(name) {
                const searchName = name.toLowerCase().trim();
                const field = fieldData.find(
                    (f) => f.name && f.name.toLowerCase().trim() === searchName
                );
                return field && Array.isArray(field.values) && field.values.length > 0
                    ? field.values[0]
                    : null;
            }

            const fullName = extractField('full_name') || extractField('name');
            const email = extractField('email');
            const phoneNumber = extractField('phone_number') || extractField('phone');
            const leadId = lead.rawData.id;
            const createdTime = lead.rawData.created_time;

            let changed = false;

            if (fullName && lead.full_name !== fullName) {
                lead.full_name = fullName;
                changed = true;
            }
            if (email && lead.email !== email) {
                lead.email = email;
                changed = true;
            }
            if (phoneNumber && lead.phone_number !== phoneNumber) {
                lead.phone_number = phoneNumber;
                changed = true;
            }
            if (leadId && lead.leadId !== leadId) {
                lead.leadId = leadId;
                changed = true;
            }
            if (createdTime && !lead.created_time) {
                lead.created_time = createdTime;
                changed = true;
            }

            if (changed) {
                await lead.save();
                updatedCount++;
                console.log(`Updated lead ${lead._id}: ${fullName || 'No Name'} (${email || 'No Email'})`);
            }
        }

        console.log(`\nRepair complete. Updated ${updatedCount} leads.`);
        await mongoose.connection.close();
    } catch (err) {
        console.error('Repair failed:', err);
        process.exit(1);
    }
}

repairLeads();
