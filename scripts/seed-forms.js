require('dotenv').config();
const mongoose = require('mongoose');
const Form = require('../src/models/Form');

const formsToSeed = [
    {
        form_id: '1946180855988159',
        form_name: 'Main Website Inquiry Form',
        lead_type: 'admission_inquiry', // Matches one of the enums
        description: 'General inquiries'
    },
    {
        form_id: '26765999006351849',
        form_name: 'Summer Bootcamp Registration',
        lead_type: 'course_information',
        description: 'Bootcamp sign ups'
    }
];

async function seedForms() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB.');

        for (const formData of formsToSeed) {
            const existing = await Form.findOne({ form_id: formData.form_id });
            if (!existing) {
                await Form.create(formData);
                console.log(`Seeded form: ${formData.form_name} (${formData.form_id})`);
            } else {
                console.log(`Form already exists: ${formData.form_name} (${formData.form_id})`);
            }
        }

        console.log('Form seeding complete!');
    } catch (err) {
        console.error('Error seeding forms:', err);
    } finally {
        mongoose.disconnect();
    }
}

seedForms();
