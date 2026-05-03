const express = require('express');
const router = express.Router();
const { fetchLeadData } = require('../services/facebookService');
const verifyFacebook = require('../middleware/verifyFacebook');

/**
 * GET /webhook
 * Verify webhook challenge from Facebook. Facebook sends three query params:
 * - hub.mode
 * - hub.verify_token
 * - hub.challenge
 * If the verify_token matches `process.env.VERIFY_TOKEN` and mode is 'subscribe',
 * respond with the raw challenge value (status 200). Otherwise respond 403.
 */
router.get('/', async (req, res) => {
	try {
		const mode = req && req.query ? req.query['hub.mode'] : undefined;
		const token = req && req.query ? req.query['hub.verify_token'] : undefined;
		const challenge = req && req.query ? req.query['hub.challenge'] : undefined;

		if (!mode || !token) {
			console.warn('[webhook][verify] Missing hub.mode or hub.verify_token');
			return res.status(400).send('Missing hub.mode or hub.verify_token');
		}

		const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
		if (!VERIFY_TOKEN) {
			console.error('[webhook][verify] VERIFY_TOKEN not set in environment');
			return res.status(500).send('Server misconfigured');
		}

		if (mode === 'subscribe' && token === VERIFY_TOKEN) {
			console.info('[webhook][verify] Verification successful');
			return res.status(200).send(String(challenge || ''));
		}

		console.warn('[webhook][verify] Verification failed: invalid token or mode');
		return res.sendStatus(403);
	} catch (err) {
		console.error('[webhook][verify] Error handling verification:', err.message);
		return res.status(500).send('Internal server error');
	}
});


/**
 * POST /webhook
 * Handle incoming webhook notifications from Facebook. We return 200 OK
 * immediately to acknowledge receipt (Facebook requires a quick response),
 * then process leadgen events asynchronously in the background.
 */
router.post('/', verifyFacebook, async (req, res) => {
	try {
		let body;
		try {
			if (!Buffer.isBuffer(req.body)) {
				console.error('[webhook][post] Expected raw buffer body');
				return res.status(400).send('Expected raw buffer body');
			}

			body = JSON.parse(req.body.toString('utf8'));

			console.log('===== FULL WEBHOOK BODY =====');
			console.log(JSON.stringify(body, null, 2));
			console.log('================================');
		} catch (err) {
			console.error('[webhook][post] Failed to parse webhook JSON:', err.message);
			return res.status(400).send('Invalid JSON');
		}

		// Acknowledge quickly
		res.sendStatus(200);

		// Process in background — do not await so response is immediate
		(async () => {
			try {
				if (!body || body.object !== 'page' || !Array.isArray(body.entry)) {
					console.warn('[webhook][post] Ignoring non-page or malformed body');
					return;
				}

				for (const entry of body.entry) {
					if (!entry || !Array.isArray(entry.changes)) continue;
					for (const change of entry.changes) {
						if (!change) continue;
						if (change.field !== 'leadgen') continue;

						const leadgenId = change.value && change.value.leadgen_id ? change.value.leadgen_id : null;
						const formId = change.value && change.value.form_id ? change.value.form_id : null;
						const pageId = change.value && change.value.page_id ? change.value.page_id : null;

						if (!leadgenId) {
							console.warn('[webhook][post] leadgen change missing leadgen_id');
							continue;
						}

						console.info('[webhook][post] Leadgen event received:', leadgenId, '| form:', formId);

						try {
							// Fetch full lead data and persist it; service handles form lookup & agent assignment
							const saved = await fetchLeadData(leadgenId, formId, pageId);
							console.info('[webhook][post] Lead fetched and saved for', leadgenId, saved && saved._id ? saved._id.toString() : 'no-id');
						} catch (err) {
							console.error('[webhook][post] Error fetching/saving lead data for', leadgenId, err.message);
						}
					}
				}
			} catch (err) {
				console.error('[webhook][post] Background processing error:', err.message);
			}
		})();
	} catch (err) {
		console.error('[webhook][post] Failed to handle webhook POST:', err.message);
		// We already attempted to respond; if headers not sent, send 500
		if (!res.headersSent) res.sendStatus(500);
	}
});

/**
 * POST /webhook/test
 * A lightweight endpoint to verify that POST requests from Facebook or the
 * Lead Ads Testing Tool reach this server. Logs the full request body and
 * responds with a simple JSON payload.
 */
router.post('/test', async (req, res) => {
	try {
		// Log the entire body for debugging/inspection
		console.info('[webhook][test] Received test POST:', JSON.stringify(req.body));
		// Acknowledge receipt
		return res.status(200).json({ success: true });
	} catch (err) {
		console.error('[webhook][test] Error handling test POST:', err && err.message ? err.message : err);
		return res.status(500).json({ success: false, error: 'Internal server error' });
	}
});

module.exports = router;
