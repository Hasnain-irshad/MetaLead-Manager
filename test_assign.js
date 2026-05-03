require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const { assignLead } = require('./src/services/assignmentService');
    const GlobalSettings = require('./src/models/GlobalSettings');
    const User = require('./src/models/User');

    console.log("Testing assignment for CA...");
    
    // Log GlobalSettings
    const settings = await GlobalSettings.findOne();
    console.log("Settings:", settings.assignmentStrategy, "autoAssign:", settings.autoAssign);

    // Filter agents
    const baseFilter = { role: 'agent', active: true, workStatus: 'AVAILABLE' };
    const agents = await User.find(baseFilter);
    console.log("All available agents:", agents.map(a => ({ name: a.name, leadTypes: a.leadTypes, workStatus: a.workStatus })));

    // Specific agents
    const specificAgents = await User.find({ ...baseFilter, leadTypes: { $regex: new RegExp(`^CA$`, 'i') } });
    console.log("Regex matched agents for CA:", specificAgents.map(a => ({ name: a.name, leadTypes: a.leadTypes })));

    // Run actual assignment
    try {
        const agent = await assignLead('CA');
        console.log("Assigned Agent =>", agent ? agent.name : "null");
    } catch (e) {
        console.error("Error in assignLead:", e);
    }
    
    process.exit(0);
});
