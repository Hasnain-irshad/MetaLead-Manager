const express = require('express');
const router = express.Router();
const { syncForms, getForms, updateForm } = require('../controllers/formController');

// GET /api/forms/sync - trigger FB graph API sync
router.get('/sync', syncForms);

// GET /api/forms - list all forms
router.get('/', getForms);

// PUT /api/forms/:id - update form lead_type
router.put('/:id', updateForm);

module.exports = router;
