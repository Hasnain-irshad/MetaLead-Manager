const axios = require('axios');
const Form = require('../models/Form');

/**
 * Fetch lead gen forms from Meta Graph API for a specific page
 * and store them into MongoDB.
 */
async function fetchAndStoreForms(pageId) {
  if (!pageId) throw new Error('pageId is required');

  const token = process.env.PAGE_ACCESS_TOKEN;
  if (!token) throw new Error('PAGE_ACCESS_TOKEN not configured');

  // We only log this instead of throwing so it doesn't break webhook processing in mock mode
  if (process.env.MOCK_FACEBOOK === 'true') {
    console.info('[facebookFormService] Running in MOCK mode, skipping real form sync.');
    // Insert a dummy form for mock tests
    await Form.findOneAndUpdate(
       { form_id: 'mock_form_123' },
       { form_name: 'Mock Test Form', page_id: pageId },
       { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  const url = `https://graph.facebook.com/v25.0/${encodeURIComponent(pageId)}/leadgen_forms`;
  
  try {
    const res = await axios.get(url, {
      params: { access_token: token },
      timeout: 10000
    });
    
    const formsData = res.data && res.data.data ? res.data.data : [];
    
    console.info(`[facebookFormService] Fetched ${formsData.length} forms from Facebook.`);

    for (const fbForm of formsData) {
      if (!fbForm.id) continue;
      
      const formId = fbForm.id;
      const formName = fbForm.name || 'Unknown Form';

      // Check if already exists in DB
      const existing = await Form.findOne({ form_id: formId });
      
      if (!existing) {
        // Insert new
        const newForm = new Form({
          form_id: formId,
          form_name: formName,
          page_id: pageId,
          lead_type: 'Other'
        });
        await newForm.save();
        console.info(`[facebookFormService] Inserted new form: ${formName} (${formId})`);
      } else {
        // Update name if changed or pageId
        if (existing.form_name !== formName || existing.page_id !== pageId) {
          existing.form_name = formName;
          existing.page_id = pageId || existing.page_id;
          await existing.save();
          console.info(`[facebookFormService] Updated form name/pageId for: ${formId}`);
        }
      }
    }
  } catch (err) {
    const errMsg = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[facebookFormService] Failed to fetch forms: ${errMsg}`);
    throw new Error(`Failed to fetch forms: ${errMsg}`);
  }
}

module.exports = {
  fetchAndStoreForms
};
