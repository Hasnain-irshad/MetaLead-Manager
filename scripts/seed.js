require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Form = require('../src/models/Form');
const Setting = require('../src/models/Setting');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/leadbridge';

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB for seeding...');

        // Clear existing data
        await User.deleteMany({});
        await Form.deleteMany({});
        await Setting.deleteMany({});

        console.log('Cleared existing Users, Forms, and Settings.');

        // Create Admin
        const admin = await User.create({
            name: 'System Admin',
            email: 'admin@leadbridge.com',
            password: 'admin123',
            role: 'admin',
            active: true
        });

        // Create Agents
        const agents = [
            { name: 'Sarah Agent', email: 'agent1@leadbridge.com', password: 'password123', role: 'agent', active: true },
            { name: 'John Agent', email: 'agent2@leadbridge.com', password: 'password123', role: 'agent', active: true },
            { name: 'Mike Agent', email: 'agent3@leadbridge.com', password: 'password123', role: 'agent', active: true }
        ];

        await User.insertMany(agents);
        console.log('Created 1 Admin and 3 Active Agents.');

        // Create Forms
        const forms = [
            { form_id: '24973126822363867', form_name: 'Contact Us Form', lead_type: 'admission_inquiry' },
            { form_id: 'FORM_B', form_name: 'Newsletter Signup', lead_type: 'course_information' }
        ];

        await Form.insertMany(forms);
        console.log('Created test Lead Forms.');

        // Initialize Round Robin index
        await Setting.create({ key: 'round_robin_index', value: 0 });
        console.log('Initialised round-robin index.');

        console.log('Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
}

seed();
