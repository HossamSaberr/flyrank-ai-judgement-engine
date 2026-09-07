const express = require('express');
const {
  listAlerts,
  getAlert,
  resolveAlert
} = require('../services/alertService');

const router = express.Router();

/**
 * GET /api/v1/alerts (List system alerts)
 */
router.get('/', (req, res) => {
  const status = req.query.status;
  const severity = req.query.severity;
  const limit = parseInt(req.query.limit || '20', 10);

  const alerts = listAlerts({ status, severity, limit });
  return res.status(200).json({
    total: alerts.length,
    alerts
  });
});

/**
 * GET /api/v1/alerts/:id (Get single alert)
 */
router.get('/:id', (req, res) => {
  const alert = getAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  return res.status(200).json({ alert });
});

/**
 * POST /api/v1/alerts/:id/resolve (Mark alert as resolved)
 */
router.post('/:id/resolve', (req, res) => {
  const alert = resolveAlert(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  return res.status(200).json({
    message: 'Alert resolved successfully',
    alert
  });
});

module.exports = router;
