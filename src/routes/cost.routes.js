const express = require('express');
const { getCostSummary } = require('../services/costTracker');

const router = express.Router();

/**
 * GET /api/v1/costs/summary
 */
router.get('/summary', (req, res) => {
  const summary = getCostSummary();
  return res.status(200).json(summary);
});

module.exports = router;
