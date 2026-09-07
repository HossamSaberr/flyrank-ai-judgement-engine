const crypto = require('crypto');
const db = require('../db/connection');

/**
 * Dispatches and logs a system alert when background jobs fail terminally or encounter high risk
 * @param {object} params
 * @param {'critical'|'warning'|'info'} [params.severity='critical']
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.channel='webhook']
 * @param {string} [params.job_id]
 * @param {object} [params.metadata={}]
 * @returns {object} Created alert record
 */
function dispatchAlert({
  severity = 'critical',
  title,
  message,
  channel = 'webhook',
  job_id = null,
  metadata = {}
}) {
  const alertId = 'alt-' + crypto.randomUUID();
  const firedAt = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO system_alerts (
      id, job_id, severity, channel, title, message, metadata, status, fired_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'fired', ?)
  `);

  insert.run(
    alertId,
    job_id,
    severity,
    channel,
    title,
    message,
    JSON.stringify(metadata),
    firedAt
  );

  const icon = severity === 'critical' ? '🚨 [CRITICAL ALERT]' : '⚠️ [SYSTEM ALERT]';
  console.error(`${icon} ${title}: ${message} (Job: ${job_id || 'none'}, Channel: ${channel})`);

  return getAlert(alertId);
}

/**
 * Retrieves a single alert
 * @param {string} id
 * @returns {object|null}
 */
function getAlert(id) {
  const alert = db.prepare('SELECT * FROM system_alerts WHERE id = ?').get(id);
  if (!alert) return null;
  return {
    ...alert,
    metadata: alert.metadata ? JSON.parse(alert.metadata) : {}
  };
}

/**
 * Lists system alerts
 * @param {object} [options]
 * @param {string} [options.status]
 * @param {string} [options.severity]
 * @param {number} [options.limit=20]
 * @returns {Array<object>}
 */
function listAlerts({ status, severity, limit = 20 } = {}) {
  let query = 'SELECT * FROM system_alerts WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }

  query += ' ORDER BY fired_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params).map((a) => ({
    ...a,
    metadata: a.metadata ? JSON.parse(a.metadata) : {}
  }));
}

/**
 * Marks an alert as resolved
 * @param {string} id
 * @returns {object|null}
 */
function resolveAlert(id) {
  const resolvedAt = new Date().toISOString();
  db.prepare(`
    UPDATE system_alerts
    SET status = 'resolved', resolved_at = ?
    WHERE id = ?
  `).run(resolvedAt, id);

  return getAlert(id);
}

module.exports = {
  dispatchAlert,
  getAlert,
  listAlerts,
  resolveAlert
};
