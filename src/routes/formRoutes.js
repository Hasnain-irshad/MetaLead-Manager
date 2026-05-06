const express = require('express');
const router = express.Router();
const { syncForms, getForms, updateForm, deleteForm } = require('../controllers/formController');

// GET /api/forms/sync - trigger FB graph API sync
router.get('/sync', syncForms);

// GET /api/forms - list all non-deleted forms
router.get('/', getForms);

// PUT /api/forms/:id - update form lead_type
router.put('/:id', updateForm);

// DELETE /api/forms/:id - soft delete a form
router.delete('/:id', deleteForm);

module.exports = router;
