const express = require('express');
const router = express.Router();
const User = require('../models/User');

/**
 * POST /api/auth/login
 * Simple authentication for LeadBridge.
 * Verifies email and password (plaintext for demo purposes).
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Try bcrypt first, fall back to plaintext for unmigrated users
        let passwordValid = false;
        if (user.password.startsWith('$2')) {
            passwordValid = await user.comparePassword(password);
        } else {
            passwordValid = user.password === password;
            // Auto-migrate: hash the plaintext password for next time
            if (passwordValid) {
                user.password = password;  // pre-save hook will hash
                await user.save();
            }
        }

        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.active) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Return user info (excluding password)
        const userInfo = {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        res.json({
            success: true,
            user: userInfo
        });
    } catch (err) {
        console.error('[authRoutes][login] Error:', err.message);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

module.exports = router;
