const express = require('express');
const router = express.Router();
const {
    getGlobalSettings,
    updateGlobalSettings,
    changeAdminPassword,
    getTokenStatus,
    setTokenCreatedAt,
    getAgentSettings,
    updateAgentSettings,
    changeAgentPassword
} = require('../controllers/settingsController');

// ── Admin settings (no auth middleware for now, matches existing pattern) ──
router.get('/', getGlobalSettings);
router.put('/', updateGlobalSettings);
router.put('/password', changeAdminPassword);

// ── Facebook Token Status ──
router.get('/token-status', getTokenStatus);
router.put('/token-created-at', setTokenCreatedAt);

// ── Agent settings (uses tempAuth from agentRoutes pattern) ──
function tempAuth(req, res, next) {
    const userId = req.headers['x-user-id'] || req.query.userId;
    if (!userId) {
        return res.status(401).json({ error: 'x-user-id header or userId query param required' });
    }
    req.user = { id: userId };
    next();
}

router.get('/agent', tempAuth, getAgentSettings);
router.put('/agent', tempAuth, updateAgentSettings);
router.put('/agent/password', tempAuth, changeAgentPassword);

module.exports = router;
