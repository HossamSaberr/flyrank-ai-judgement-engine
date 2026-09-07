const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db/connection');
const { aggregateReportData } = require('./reportAggregator');
const { renderPdfReport } = require('./pdfRenderer');

const REPORTS_DIR = path.resolve(__dirname, '../../data/reports');

/**
 * Enqueues a new background report generation job
 * @param {object} options
 * @param {string} [options.type='executive_summary']
 * @param {object} [options.parameters={}]
 * @param {'on_demand'|'scheduled'|'api'} [options.triggered_by='on_demand']
 * @returns {object} Initial job record
 */
function enqueueReportJob({
  type = 'executive_summary',
  parameters = {},
  triggered_by = 'on_demand'
} = {}) {
  const jobId = 'rep-' + crypto.randomUUID();
  const downloadUrl = `/api/v1/reports/download/${jobId}`;

  const insert = db.prepare(`
    INSERT INTO report_jobs (
      id, type, status, parameters, progress, download_url, triggered_by
    ) VALUES (?, ?, 'queued', ?, 0, ?, ?)
  `);

  insert.run(
    jobId,
    type,
    JSON.stringify(parameters),
    downloadUrl,
    triggered_by
  );

  // Trigger background execution asynchronously without blocking the event loop
  setImmediate(() => {
    processReportJob(jobId).catch((err) => {
      console.error(`💥 [Report Worker] Unexpected error processing job ${jobId}:`, err);
    });
  });

  return getJobStatus(jobId);
}

/**
 * Asynchronous worker that executes the report pipeline
 * @param {string} jobId
 * @returns {Promise<object>} Completed job record
 */
async function processReportJob(jobId) {
  const job = db.prepare('SELECT * FROM report_jobs WHERE id = ?').get(jobId);
  if (!job) {
    throw new Error(`Report job ${jobId} not found`);
  }

  const startTime = new Date().toISOString();

  // 1. Mark as Processing (15%)
  db.prepare(`
    UPDATE report_jobs
    SET status = 'processing', progress = 15, started_at = ?
    WHERE id = ?
  `).run(startTime, jobId);

  try {
    const params = job.parameters ? JSON.parse(job.parameters) : {};

    // 2. Query & Aggregate SQL Data (45%)
    const reportData = aggregateReportData(params);
    db.prepare('UPDATE report_jobs SET progress = 45 WHERE id = ?').run(jobId);

    // 3. Prepare Artifact File Path (65%)
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const artifactFilename = `FlyRank_${job.type}_${timestampStr}_${jobId.slice(-6)}.pdf`;
    const artifactPath = path.join(REPORTS_DIR, artifactFilename);

    db.prepare('UPDATE report_jobs SET progress = 65 WHERE id = ?').run(jobId);

    // 4. Render PDF Document (90%)
    const renderResult = await renderPdfReport(reportData, artifactPath, {
      job_id: jobId,
      report_type: job.type
    });

    db.prepare('UPDATE report_jobs SET progress = 90 WHERE id = ?').run(jobId);

    // 5. Mark as Completed (100%)
    const completedTime = new Date().toISOString();
    db.prepare(`
      UPDATE report_jobs
      SET status = 'completed',
          progress = 100,
          artifact_path = ?,
          artifact_filename = ?,
          artifact_size_bytes = ?,
          completed_at = ?
      WHERE id = ?
    `).run(
      renderResult.outputPath,
      artifactFilename,
      renderResult.sizeBytes,
      completedTime,
      jobId
    );

    console.log(`✅ [Report Worker] Job ${jobId} completed successfully (${renderResult.sizeBytes} bytes).`);
    return getJobStatus(jobId);
  } catch (err) {
    const failedTime = new Date().toISOString();
    console.error(`❌ [Report Worker] Job ${jobId} failed: ${err.message}`);

    db.prepare(`
      UPDATE report_jobs
      SET status = 'failed',
          progress = 0,
          error_message = ?,
          completed_at = ?
      WHERE id = ?
    `).run(err.message, failedTime, jobId);

    return getJobStatus(jobId);
  }
}

/**
 * Retrieve status and metadata for a specific job
 * @param {string} jobId
 * @returns {object|null}
 */
function getJobStatus(jobId) {
  const job = db.prepare('SELECT * FROM report_jobs WHERE id = ?').get(jobId);
  if (!job) return null;

  return {
    ...job,
    parameters: job.parameters ? JSON.parse(job.parameters) : {}
  };
}

/**
 * List recent report jobs
 * @param {object} [options]
 * @param {number} [options.limit=20]
 * @param {string} [options.status]
 * @returns {Array<object>}
 */
function listJobs({ limit = 20, status } = {}) {
  let query = 'SELECT * FROM report_jobs WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params).map((job) => ({
    ...job,
    parameters: job.parameters ? JSON.parse(job.parameters) : {}
  }));
}

/**
 * Deletes a report job and its associated file artifact
 * @param {string} jobId
 * @returns {boolean}
 */
function deleteReportJob(jobId) {
  const job = db.prepare('SELECT * FROM report_jobs WHERE id = ?').get(jobId);
  if (!job) return false;

  if (job.artifact_path && fs.existsSync(job.artifact_path)) {
    try {
      fs.unlinkSync(job.artifact_path);
    } catch (e) {
      console.warn(`Could not delete artifact file ${job.artifact_path}:`, e.message);
    }
  }

  db.prepare('DELETE FROM report_jobs WHERE id = ?').run(jobId);
  return true;
}

module.exports = {
  enqueueReportJob,
  processReportJob,
  getJobStatus,
  listJobs,
  deleteReportJob,
  REPORTS_DIR
};
