const crypto = require('crypto');
const db = require('../db/connection');
const { enqueueReportJob } = require('./reportJobQueue');

let schedulerTimer = null;

/**
 * Creates a new recurring report schedule
 * @param {object} options
 * @param {string} options.name
 * @param {string} [options.report_type='executive_summary']
 * @param {number} [options.interval_minutes=60]
 * @param {object} [options.parameters={}]
 * @returns {object}
 */
function createSchedule({
  name,
  report_type = 'executive_summary',
  interval_minutes = 60,
  parameters = {}
}) {
  const id = 'sch-' + crypto.randomUUID();
  const nextRun = new Date(Date.now() + interval_minutes * 60 * 1000).toISOString();

  const insert = db.prepare(`
    INSERT INTO report_schedules (
      id, name, report_type, interval_minutes, is_active, next_run_at, parameters
    ) VALUES (?, ?, ?, ?, 1, ?, ?)
  `);

  insert.run(id, name, report_type, interval_minutes, nextRun, JSON.stringify(parameters));

  return getSchedule(id);
}

/**
 * Get schedule by ID
 * @param {string} id
 * @returns {object|null}
 */
function getSchedule(id) {
  const schedule = db.prepare('SELECT * FROM report_schedules WHERE id = ?').get(id);
  if (!schedule) return null;
  return {
    ...schedule,
    parameters: schedule.parameters ? JSON.parse(schedule.parameters) : {}
  };
}

/**
 * List all schedules
 * @returns {Array<object>}
 */
function listSchedules() {
  return db.prepare('SELECT * FROM report_schedules ORDER BY created_at DESC').all().map((sch) => ({
    ...sch,
    parameters: sch.parameters ? JSON.parse(sch.parameters) : {}
  }));
}

/**
 * Triggers a schedule immediately
 * @param {string} id
 * @returns {object} Enqueued job
 */
function runScheduleNow(id) {
  const schedule = getSchedule(id);
  if (!schedule) {
    throw new Error(`Schedule ${id} not found`);
  }

  const job = enqueueReportJob({
    type: schedule.report_type,
    parameters: schedule.parameters,
    triggered_by: 'scheduled'
  });

  const now = new Date().toISOString();
  const nextRun = new Date(Date.now() + schedule.interval_minutes * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE report_schedules
    SET last_run_at = ?, next_run_at = ?
    WHERE id = ?
  `).run(now, nextRun, id);

  return job;
}

/**
 * Checks all active schedules and runs any that are due
 * @returns {Array<object>} List of triggered jobs
 */
function checkAndRunDueSchedules() {
  const now = new Date().toISOString();
  const dueSchedules = db.prepare(`
    SELECT * FROM report_schedules
    WHERE is_active = 1 AND (next_run_at IS NULL OR next_run_at <= ?)
  `).all(now);

  const triggeredJobs = [];

  for (const row of dueSchedules) {
    try {
      const schedule = {
        ...row,
        parameters: row.parameters ? JSON.parse(row.parameters) : {}
      };

      const job = enqueueReportJob({
        type: schedule.report_type,
        parameters: schedule.parameters,
        triggered_by: 'scheduled'
      });

      const nextRun = new Date(Date.now() + schedule.interval_minutes * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE report_schedules
        SET last_run_at = ?, next_run_at = ?
        WHERE id = ?
      `).run(now, nextRun, schedule.id);

      triggeredJobs.push(job);
    } catch (err) {
      console.error(`Error running due schedule ${row.id}:`, err);
    }
  }

  return triggeredJobs;
}

/**
 * Start background timer to check due schedules
 * @param {number} [checkIntervalMs=60000]
 */
function startScheduler(checkIntervalMs = 60000) {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    checkAndRunDueSchedules();
  }, checkIntervalMs);
  if (schedulerTimer.unref) schedulerTimer.unref(); // Don't block process exit in tests
}

/**
 * Stop background timer
 */
function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  createSchedule,
  getSchedule,
  listSchedules,
  runScheduleNow,
  checkAndRunDueSchedules,
  startScheduler,
  stopScheduler
};
