const express = require('express');
const router = express.Router();
const {
  listConfigs,
  getConfigByLeadType,
  upsertConfig,
  deleteConfig
} = require('../controllers/formConfigController');

router.get('/', listConfigs);
router.get('/:lead_type', getConfigByLeadType);
router.put('/:lead_type', upsertConfig);
router.delete('/:lead_type', deleteConfig);

module.exports = router;
