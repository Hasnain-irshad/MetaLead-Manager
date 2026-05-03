const Lead = require('../models/Lead');
const User = require('../models/User');

/**
 * Controller: get all leads
 */
async function getAllLeads(req, res) {
  try {
    const leads = await Lead.find().sort({ created_time: -1 });
    res.json(leads);
  } catch (err) {
    console.error('[leadController][getAllLeads] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
}

/**
 * Controller: get single lead by id
 */
async function getLeadById(req, res) {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    console.error('[leadController][getLeadById] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
}

/**
 * Controller: update lead status
 */
async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    console.info('[leadController][updateStatus] Updated', lead._id, '->', status);
    res.json(lead);
  } catch (err) {
    console.error('[leadController][updateStatus] Error:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
}

/**
 * Controller: add comment to lead
 */
async function addComment(req, res) {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text required' });
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    lead.comments.push({ text, date: new Date() });
    await lead.save();
    console.info('[leadController][addComment] Added comment to', lead._id.toString());
    res.json(lead);
  } catch (err) {
    console.error('[leadController][addComment] Error:', err.message);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

/**
 * Controller: stats
 */
async function getStats(req, res) {
  try {
    const total = await Lead.countDocuments();
    const byStatus = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const counts = {};
    byStatus.forEach((b) => (counts[b._id] = b.count));
    res.json({ total, counts });
  } catch (err) {
    console.error('[leadController][getStats] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
}

/**
 * Controller: reassign lead (agent access)
 */
async function reassignLead(req, res) {
  try {
    const { agent_id } = req.body;
    if (!agent_id) {
        return res.status(400).json({ error: 'agent_id is required' });
    }

    const agent = await User.findOne({ _id: agent_id, role: 'agent', active: true });
    if (!agent) {
        return res.status(404).json({ error: 'Active agent not found' });
    }

    const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        { assigned_agent: agent._id },
        { new: true }
    ).populate('assigned_agent', 'name email');

    if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
    }

    console.info(`[leadController][reassignLead] Lead ${lead._id} reassigned to ${agent.name}`);
    res.json(lead);
  } catch (err) {
    console.error('[leadController][reassignLead] Error:', err.message);
    res.status(500).json({ error: 'Failed to reassign lead' });
  }
}

module.exports = { getAllLeads, getLeadById, updateStatus, addComment, getStats, reassignLead };
