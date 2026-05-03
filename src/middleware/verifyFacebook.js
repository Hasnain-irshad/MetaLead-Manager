const crypto = require('crypto');

/**
 * Middleware to verify Facebook signature header `x-hub-signature-256`.
 * Requires `express.raw()` to be used on the webhook route so `req.body`
 * is a Buffer of the exact raw bytes Facebook signed.
 */
module.exports = function verifyFacebook(req, res, next) {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret || process.env.MOCK_FACEBOOK === 'true') {
    if (process.env.MOCK_FACEBOOK === 'true') {
      console.info('[verifyFacebook] Mock mode enabled — skipping signature check');
    } else {
      console.warn('FACEBOOK_APP_SECRET not set — skipping verification');
    }
    return next();
  }

  const signature = req.get('x-hub-signature-256');
  if (!signature) {
    return res.status(400).send('Missing signature header');
  }

  // Expect raw Buffer body provided by express.raw
  if (!Buffer.isBuffer(req.body)) {
    console.error('Expected raw buffer body for webhook');
    return res.status(500).send('Webhook body not raw buffer');
  }

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return res.status(403).send('Invalid signature');
  }

  next();
};
