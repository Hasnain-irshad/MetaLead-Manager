const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const facebookWebhookRouter = require('./routes/facebookWebhook');
const leadRoutes = require('./routes/leadRoutes');
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');
const authRoutes = require('./routes/authRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const formRoutes = require('./routes/formRoutes');
const fieldMappingRoutes = require('./routes/fieldMappingRoutes');
const formConfigRoutes = require('./routes/formConfigRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Enable CORS for the React dev server (port 3000)
app.use(cors({ origin: ['http://localhost:3000'], credentials: true }));

// Keep raw body available for signature verification middleware that needs
// the exact request bytes (X-Hub-Signature-256). We add both JSON and
// URL-encoded parsers to ensure body-parser works for common webhook clients.
// Use raw body ONLY for webhook route (required for Facebook signature validation)
app.use('/webhook', express.raw({ type: '*/*' }));

// Use JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet());

// Mount webhook router at /webhook so endpoints become:
// GET  /webhook  -> verification
// POST /webhook  -> notifications
app.use('/webhook', facebookWebhookRouter);

// API routes for leads (existing dashboard)
app.use('/api/leads', leadRoutes);

// Admin dashboard APIs
app.use('/api/admin', adminRoutes);

// Agent dashboard APIs
app.use('/api/agent', agentRoutes);

// Auth APIs
app.use('/api/auth', authRoutes);

// Settings APIs
app.use('/api/settings', settingsRoutes);

// Forms APIs
app.use('/api/forms', formRoutes);

// Field mapping APIs (raw FB field → normalized key + display name, per lead_type)
app.use('/api/field-mappings', fieldMappingRoutes);

// Form config APIs (per-leadType field structure, drives dynamic UI)
app.use('/api/form-configs', formConfigRoutes);

// health
app.get('/health', (req, res) => res.json({ ok: true }));

// error handler
app.use(errorHandler);

module.exports = app;
