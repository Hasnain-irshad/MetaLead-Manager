const User = require('../models/User');
const GlobalSettings = require('../models/GlobalSettings');
const Lead = require('../models/Lead');
const { assignLead } = require('../services/assignmentService');

// ─── Helper: get-or-create the singleton settings document ───
async function getOrCreateSettings() {
    let settings = await GlobalSettings.findOne();
    if (!settings) {
        settings = await GlobalSettings.create({});
        console.info('[settingsController] Created default GlobalSettings');
    }
    return settings;
}

// ════════════════════════════════════════
//  ADMIN — Global Settings
// ════════════════════════════════════════

/**
 * GET /api/settings
 */
async function getGlobalSettings(req, res) {
    try {
        const settings = await getOrCreateSettings();
        res.json(settings);
    } catch (err) {
        console.error('[settingsController][getGlobalSettings]', err.message);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
}

/**
 * PUT /api/settings
 */
async function updateGlobalSettings(req, res) {
    try {
        const allowed = [
            'autoAssign', 'assignmentStrategy', 'duplicateHandling',
            'maxLeadsPerAgent', 'autoReassign', 'timezone', 'dateFormat'
        ];

        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }

        let settings = await getOrCreateSettings();
        Object.assign(settings, updates);
        await settings.save();

        console.info('[settingsController][updateGlobalSettings] Settings updated');
        res.json(settings);
    } catch (err) {
        console.error('[settingsController][updateGlobalSettings]', err.message);
        res.status(500).json({ error: 'Failed to update settings' });
    }
}

/**
 * PUT /api/settings/password
 * Body: { email, oldPassword, newPassword }
 */
async function changeAdminPassword(req, res) {
    try {
        const { email, oldPassword, newPassword, newEmail, newName } = req.body;
        if (!email || !oldPassword || !newPassword) {
            return res.status(400).json({ error: 'email, oldPassword, and newPassword are required' });
        }

        const admin = await User.findOne({ email, role: 'admin' });
        if (!admin) return res.status(404).json({ error: 'Admin not found' });

        // Support both bcrypt-hashed and legacy-plaintext passwords.
        let isMatch = false;
        try {
            if (admin.password && admin.password.startsWith && admin.password.startsWith('$2')) {
                isMatch = await admin.comparePassword(oldPassword);
            } else {
                // legacy plaintext
                isMatch = admin.password === oldPassword;
            }
        } catch (e) {
            isMatch = false;
        }

        if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

        // Allow updating email/name together with password if provided
        if (newEmail && newEmail !== admin.email) {
            const exists = await User.findOne({ email: newEmail });
            if (exists && String(exists._id) !== String(admin._id)) {
                return res.status(400).json({ error: 'Email already in use' });
            }
            admin.email = newEmail;
        }
        if (newName) admin.name = newName;

        admin.password = newPassword; // pre-save hook will hash if necessary
        await admin.save();

        console.info('[settingsController][changeAdminPassword] Admin password/email/name updated');

        const userInfo = {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role
        };

        res.json({ success: true, message: 'Password updated successfully', user: userInfo });
    } catch (err) {
        console.error('[settingsController][changeAdminPassword]', err.message);
        res.status(500).json({ error: 'Failed to change password' });
    }
}

/**
 * GET /api/token-status
 * Check Facebook token expiry status.
 * Assumes tokens expire after 60 days.
 */
async function getTokenStatus(req, res) {
    try {
        const settings = await getOrCreateSettings();
        
        if (!settings.token_created_at) {
            return res.json({
                daysRemaining: null,
                isExpiringSoon: false,
                message: 'Token creation date not set'
            });
        }

        const createdDate = new Date(settings.token_created_at);
        const expiryDate = new Date(createdDate.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
        const now = new Date();
        
        const daysRemaining = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000));
        const isExpiringSoon = daysRemaining <= 10; // Warning if 10 days or less
        
        const isExpired = daysRemaining < 0;

        res.json({
            daysRemaining: Math.max(daysRemaining, 0),
            isExpiringSoon: !isExpired && isExpiringSoon,
            isExpired,
            tokenCreatedAt: createdDate.toISOString()
        });
    } catch (err) {
        console.error('[settingsController][getTokenStatus]', err.message);
        res.status(500).json({ error: 'Failed to check token status' });
    }
}

/**
 * PUT /api/token-created-at
 * Update token creation timestamp (admin only).
 * Body: { token_created_at: ISO date string OR null }
 */
async function setTokenCreatedAt(req, res) {
    try {
        const { token_created_at } = req.body;
        
        let settings = await getOrCreateSettings();
        
        if (token_created_at === null) {
            settings.token_created_at = null;
        } else if (typeof token_created_at === 'string') {
            settings.token_created_at = new Date(token_created_at);
        } else {
            // Set to now
            settings.token_created_at = new Date();
        }
        
        await settings.save();
        
        console.info('[settingsController][setTokenCreatedAt] Token timestamp updated');
        res.json({ success: true, token_created_at: settings.token_created_at });
    } catch (err) {
        console.error('[settingsController][setTokenCreatedAt]', err.message);
        res.status(500).json({ error: 'Failed to update token timestamp' });
    }
}

// ════════════════════════════════════════
//  AGENT — Profile & Work Status
// ════════════════════════════════════════

/**
 * GET /api/agent/settings
 */
async function getAgentSettings(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) return res.status(401).json({ error: 'Agent identification required' });

        const agent = await User.findById(agentId).select('-password');
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        res.json(agent);
    } catch (err) {
        console.error('[settingsController][getAgentSettings]', err.message);
        res.status(500).json({ error: 'Failed to fetch agent settings' });
    }
}

/**
 * PUT /api/agent/settings
 * Body: { name?, email?, workStatus? }
 *
 * When workStatus moves away from AVAILABLE (i.e. BUSY or OFFLINE), the
 * agent's currently-assigned leads get unassigned in one bulk operation so
 * admin can re-distribute them via the dashboard's bulk-assign UI. If
 * GlobalSettings.autoReassign is enabled, we additionally try to find new
 * homes for them right away using the configured assignment strategy —
 * otherwise they sit in the unassigned pool waiting for the admin.
 */
async function updateAgentSettings(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) return res.status(401).json({ error: 'Agent identification required' });

        const { name, email, workStatus } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (workStatus && ['AVAILABLE', 'BUSY', 'OFFLINE'].includes(workStatus)) {
            updates.workStatus = workStatus;
        }

        // Capture the previous workStatus so we only cascade on a real
        // transition (not on no-op saves of name/email).
        const before = await User.findById(agentId).select('workStatus name');
        if (!before) return res.status(404).json({ error: 'Agent not found' });

        const agent = await User.findByIdAndUpdate(agentId, updates, {
            new: true,
            runValidators: true
        }).select('-password');

        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        let cascade = null;
        const wsChanged = workStatus && before.workStatus !== workStatus;

        if (wsChanged && workStatus === 'OFFLINE') {
            // === Going OFFLINE (vacation / EOD) ===
            // 1. Backfill home_agent for any of this agent's leads that don't
            //    have one yet (legacy data) so they restore correctly later.
            // 2. Unassign every lead currently with this agent.
            // 3. If autoReassign is on, immediately try to redistribute via
            //    the configured strategy. home_agent is left untouched so the
            //    lead still belongs to this agent for restore purposes.
            //
            // Note: BUSY is intentionally a no-op here — it just signals to
            // the assignment engine that this agent shouldn't receive *new*
            // leads (filter in assignmentService.js requires AVAILABLE), but
            // their current workload stays put.
            const affectedLeads = await Lead.find({ assigned_agent: agentId }).select('_id lead_type home_agent');

            await Lead.updateMany(
                { assigned_agent: agentId, home_agent: null },
                { $set: { home_agent: agentId } }
            );

            await Lead.updateMany(
                { assigned_agent: agentId },
                { $set: { assigned_agent: null } }
            );

            const unassignedCount = affectedLeads.length;
            let reassignedCount = 0;

            console.info(`[settingsController][updateAgentSettings] ${agent.name} → ${workStatus}: unassigned ${unassignedCount} lead(s)`);

            const settings = await getOrCreateSettings();
            if (settings.autoReassign && unassignedCount > 0) {
                for (const lead of affectedLeads) {
                    const newAgent = await assignLead(lead.lead_type);
                    if (newAgent && String(newAgent._id) !== String(agentId)) {
                        await Lead.findByIdAndUpdate(lead._id, { assigned_agent: newAgent._id });
                        reassignedCount++;
                    }
                }
                console.info(`[settingsController][updateAgentSettings] autoReassign: redistributed ${reassignedCount}/${unassignedCount} lead(s)`);
            }

            cascade = { kind: 'unassign', unassignedCount, reassignedCount };
        } else if (wsChanged && workStatus === 'AVAILABLE') {
            // === Coming back ONLINE ===
            // Restore every lead that's "home" with this agent but is currently
            // assigned to someone else (or unassigned). Comments / status /
            // extra_fields stay intact since they live on the lead document.
            const result = await Lead.updateMany(
                {
                    home_agent: agentId,
                    $or: [
                        { assigned_agent: { $ne: agentId } },
                        { assigned_agent: null }
                    ]
                },
                { $set: { assigned_agent: agentId } }
            );
            const restoredCount = result.modifiedCount || 0;
            console.info(`[settingsController][updateAgentSettings] ${agent.name} → AVAILABLE: restored ${restoredCount} lead(s) to home agent`);
            cascade = { kind: 'restore', restoredCount };
        }

        console.info(`[settingsController][updateAgentSettings] Agent ${agent.name} updated`);
        res.json({
            ...agent.toObject(),
            cascade
        });
    } catch (err) {
        console.error('[settingsController][updateAgentSettings]', err.message);
        res.status(500).json({ error: 'Failed to update agent settings' });
    }
}

/**
 * PUT /api/agent/settings/password
 * Body: { oldPassword, newPassword }
 */
async function changeAgentPassword(req, res) {
    try {
        const agentId = req.user && req.user.id;
        if (!agentId) return res.status(401).json({ error: 'Agent identification required' });

        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: 'oldPassword and newPassword are required' });
        }

        const agent = await User.findById(agentId);
        if (!agent) return res.status(404).json({ error: 'Agent not found' });

        // Support both bcrypt-hashed and legacy-plaintext passwords.
        let isMatch = false;
        try {
            if (agent.password && agent.password.startsWith && agent.password.startsWith('$2')) {
                isMatch = await agent.comparePassword(oldPassword);
            } else {
                isMatch = agent.password === oldPassword;
            }
        } catch (e) {
            isMatch = false;
        }

        if (!isMatch) return res.status(401).json({ error: 'Current password is incorrect' });

        agent.password = newPassword;
        await agent.save();

        console.info(`[settingsController][changeAgentPassword] Agent ${agent.name} password updated`);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        console.error('[settingsController][changeAgentPassword]', err.message);
        res.status(500).json({ error: 'Failed to change password' });
    }
}

module.exports = {
    getGlobalSettings,
    updateGlobalSettings,
    changeAdminPassword,
    getTokenStatus,
    setTokenCreatedAt,
    getAgentSettings,
    updateAgentSettings,
    changeAgentPassword
};
