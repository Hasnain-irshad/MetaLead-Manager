const User = require('../models/User');
const Lead = require('../models/Lead');
const Setting = require('../models/Setting');
const GlobalSettings = require('../models/GlobalSettings');

const ROUND_ROBIN_KEY = 'round_robin_index';

async function getSettings() {
  let settings = await GlobalSettings.findOne();
  if (!settings) settings = await GlobalSettings.create({});
  return settings;
}

async function nextCounter(key) {
  const doc = await Setting.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return Number(doc.value || 0);
}

async function assignLead(leadOrType) {
  try {
    const leadType = typeof leadOrType === 'string' ? leadOrType : (leadOrType && leadOrType.lead_type) || null;

    console.log('[assignmentService] >>> Starting assignment with leadType:', leadType);

    const settings = await getSettings();
    console.log('[assignmentService] GlobalSettings - autoAssign:', settings.autoAssign, 'strategy:', settings.assignmentStrategy);
    
    if (!settings.autoAssign) {
      console.info('[assignmentService] Auto-assign disabled');
      return null;
    }

    const baseFilter = { role: 'agent', active: true, workStatus: 'AVAILABLE' };
    console.log('[assignmentService] Base filter:', JSON.stringify(baseFilter));

    // Debug: Check total agents in database
    const totalAgents = await User.countDocuments();
    const roleAgents = await User.countDocuments({ role: 'agent' });
    const activeAgents = await User.countDocuments({ active: true });
    const availableAgents = await User.countDocuments(baseFilter);
    console.log(`[assignmentService] DEBUG - Total users: ${totalAgents}, Role=agent: ${roleAgents}, Active: ${activeAgents}, Available: ${availableAgents}`);

    let agents = [];
    let usingFallback = false;

    if (settings.assignmentStrategy === 'TYPE_BASED') {
      if (leadType) {
        agents = await User.find({ ...baseFilter, leadTypes: { $in: [leadType] } }).sort({ createdAt: 1 });
        console.log(`[assignmentService] TYPE_BASED query result: ${agents.length} agents with type "${leadType}"`);
        if (agents.length > 0) {
          agents.forEach(a => console.log(`  ✓ Agent: ${a.name}, LeadTypes: ${JSON.stringify(a.leadTypes)}`));
        }
      }
      if (!agents || agents.length === 0) {
        console.info('[assignmentService] TYPE_BASED: no eligible agents for', leadType);
        return null;
      }
    } else if (settings.assignmentStrategy === 'HYBRID') {
      if (leadType) {
        agents = await User.find({ ...baseFilter, leadTypes: { $in: [leadType] } }).sort({ createdAt: 1 });
        console.log(`[assignmentService] HYBRID (type match) query result: ${agents.length} agents`);
      }
      if (!agents || agents.length === 0) {
        agents = await User.find(baseFilter).sort({ createdAt: 1 });
        usingFallback = true;
        console.log(`[assignmentService] HYBRID fallback: ${agents.length} all available agents`);
      }
    } else {
      agents = await User.find(baseFilter).sort({ createdAt: 1 });
      usingFallback = true;
      console.log(`[assignmentService] ROUND_ROBIN: ${agents.length} available agents`);
    }

    if (!agents || agents.length === 0) {
      console.info('[assignmentService] No active/available agents');
      return null;
    }

    if (settings.maxLeadsPerAgent && settings.maxLeadsPerAgent > 0) {
      const filtered = [];
      for (const a of agents) {
        const cnt = await Lead.countDocuments({ assigned_agent: a._id });
        if (cnt < settings.maxLeadsPerAgent) filtered.push(a);
      }
      if (filtered.length === 0) {
        console.info('[assignmentService] All agents reached maxLeadsPerAgent');
        return null;
      }
      agents = filtered;
    }

    const indexKey = (!leadType || usingFallback) ? `${ROUND_ROBIN_KEY}_fallback` : `${ROUND_ROBIN_KEY}_${leadType}`;
    const next = await nextCounter(indexKey);
    const idx = (next - 1) % agents.length;
    const selected = agents[idx];

    console.info('[assignmentService] ✓ ASSIGNED - LeadType:', leadType, '| Agent:', selected.name, '(ID:', selected._id, ')');
    return selected;
  } catch (err) {
    console.error('[assignmentService] Error:', err.message);
    throw err;
  }
}

module.exports = { assignLead };

