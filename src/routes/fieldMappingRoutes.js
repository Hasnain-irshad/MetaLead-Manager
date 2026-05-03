const express = require('express');
const router = express.Router();
const {
  listMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  listUnmappedForType
} = require('../controllers/fieldMappingController');

router.get('/', listMappings);
router.post('/', createMapping);
router.put('/:id', updateMapping);
router.delete('/:id', deleteMapping);
router.get('/unmapped/:lead_type', listUnmappedForType);

module.exports = router;
