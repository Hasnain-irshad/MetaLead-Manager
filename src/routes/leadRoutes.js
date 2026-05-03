const express = require('express');
const router = express.Router();
const {
  getAllLeads,
  getLeadById,
  updateStatus,
  addComment,
  getStats,
  reassignLead
} = require('../controllers/leadController');

// GET /api/leads
router.get('/', getAllLeads);

// GET /api/leads/stats
router.get('/stats', getStats);

// GET /api/leads/:id
router.get('/:id', getLeadById);

// PATCH /api/leads/:id/status
router.patch('/:id/status', updateStatus);

// POST /api/leads/:id/comment
router.post('/:id/comment', addComment);

// PUT /api/leads/:id/assign
router.put('/:id/assign', reassignLead);

module.exports = router;
