const { fetchLeadData } = require('../services/facebookService');

/**
 * Verify webhook (GET) and respond with the verification challenge.
 *
 * Security notes:
 * - The `VERIFY_TOKEN` must be provided via environment variables only.
 * - This handler never echoes secrets back in responses.
 *
 * The logic is synchronous by nature, but we wrap it as `async` and use a
 * try/catch to keep the pattern async-safe and consistent with other handlers.
 */
async function verifyWebhook(req, res, next) {
  try {
    const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

    // Defensive checks for missing env or query params
    const mode = req && req.query ? req.query['hub.mode'] : undefined;
    const token = req && req.query ? req.query['hub.verify_token'] : undefined;
    const challenge = req && req.query ? req.query['hub.challenge'] : undefined;

    if (!mode || !token) {
      console.warn('[webhook][verify] Missing required query parameters');
      // 400 for malformed verification requests
      return res.status(400).send('Missing hub.mode or hub.verify_token');
    }

    if (!VERIFY_TOKEN) {
      console.error('[webhook][verify] VERIFY_TOKEN not configured in environment');
      // Do not expose secrets — return 500 so the owner can inspect server logs
      return res.status(500).send('Server misconfigured');
    }

    // Only accept explicit subscribe mode and matching token
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.info('[webhook][verify] Successful verification');
      // Ensure challenge is a string (Facebook expects the raw challenge value)
      return res.status(200).send(String(challenge || ''));
    }

    // Log invalid attempts without revealing sensitive details
    console.warn('[webhook][verify] Invalid verify_token attempt');
    return res.sendStatus(403);
  } catch (err) {
    // Delegate to centralized error handler
    return next(err);
  }
}

/** Handle incoming webhook POST from Facebook */
async function handleWebhook(req, res, next) {
  try {
    const body = req.body;

    if (!body || !Array.isArray(body.entry)) return res.status(400).send('invalid payload');

    // Acknowledge quickly
    res.sendStatus(200);

    // Process entries asynchronously
    (async () => {
      try {
        for (const entry of body.entry) {
          if (!entry || !Array.isArray(entry.changes)) continue;
          for (const change of entry.changes) {
            if (!change || change.field !== 'leadgen') continue;
            const leadgenId = change.value && change.value.leadgen_id ? change.value.leadgen_id : null;
            const formId = change.value && change.value.form_id ? change.value.form_id : null;
            const pageId = change.value && change.value.page_id ? change.value.page_id : null;

            if (!leadgenId) {
              console.warn('[webhook][post] Missing leadgen_id');
              continue;
            }

            console.info('[webhook][post] Leadgen received:', leadgenId, 'Form:', formId);
            try {
              const saved = await fetchLeadData(leadgenId, formId, pageId);
              console.info('[webhook][post] Lead fetched and saved:', saved && saved._id ? saved._id.toString() : 'no-id');
            } catch (err) {
              console.error('[webhook][post] Error fetching/saving lead:', err.message);
            }
          }
        }
      } catch (err) {
        console.error('[webhook][post] Background processing error:', err.message);
      }
    })();
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyWebhook, handleWebhook };
