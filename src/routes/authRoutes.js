const express = require('express');
const router = express.Router();
const User = require('../models/User');

/**
 * POST /api/auth/login
 * Authenticate using primary `email` and `password` only.
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Verify password: bcrypt hash or plaintext fallback (migrate to hash)
        let passwordValid = false;
        if (user.password && user.password.startsWith && user.password.startsWith('$2')) {
            passwordValid = await user.comparePassword(password);
        } else if (user.password) {
            passwordValid = user.password === password;
            if (passwordValid) {
                user.password = password; // pre-save will hash
                await user.save();
            }
        }

        if (!passwordValid) return res.status(401).json({ error: 'Invalid credentials' });
        if (!user.active) return res.status(403).json({ error: 'Account is deactivated' });

        const userInfo = { id: user._id, name: user.name, email: user.email, role: user.role };
        return res.json({ success: true, user: userInfo });
    } catch (err) {
        console.error('[authRoutes][login] Error:', err.message);
        return res.status(500).json({ error: 'Authentication failed' });
    }
});

module.exports = router;
