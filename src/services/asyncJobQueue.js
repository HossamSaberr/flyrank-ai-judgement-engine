const crypto = require('crypto');
const db = require('../db/connection');
const { makeJudgement } = require('./judgement.service');
const { matchImagesForPost } = require('./matchingEngine');
const { runBatchIngestionJob } = require('./batchProcessor');
const { dispatchAlert } = require('./alertService');

/**
 * Generate a deterministic hash for payload if no custom idempotency key is provided
 * @param {string} jobType
 * @param {object} payload
 * @returns {string}
 */
function generateIdempotencyKey(jobType, payload) {
  const hash = crypto.createHash('sha256').update(`${jobType}:${JSON.stringify(payload)}`).digest('hex');
  return `idem-${hash.slice(0, 24)}`;
}

/**
 * Enqueues an asynchronous background job with strict idempotency and retry parameters
 * @param {object} options
 * @param {string} options.jobType
 * @param {object} options.payload
 * @param {string} [options.idempotencyKey]
 * @param {number} [options.maxAttempts=3]
 * @param {Function} [options.customExecutor] Optional mock executor for testing
 * @returns {{ job: object, isReplay: boolean }}
 */
function enqueueAsyncJob({
  jobType,
  payload,
  idempotencyKey,
  maxAttempts = 3,
  customExecutor = null
}) {
  const key = idempotencyKey || generateIdempotencyKey(jobType, payload);

  // 1. Idempotency Check (Jobs will run twice / duplicate request prevention)
  const existing = db.prepare('SELECT * FROM async_jobs WHERE idempotency_key = ?').get(key);
  if (existing) {
    return {
      job: {
        ...existing,
        payload: JSON.parse(existing.payload),
        result: existing.result ? JSON.parse(existing.result) : null,
        check_url: `/api/v1/jobs/${existing.id}`
      },
      isReplay: true
    };
  }

  const jobId = 'job-' + crypto.randomUUID();

  const insert = db.prepare(`
    INSERT INTO async_jobs (
      id, job_type, idempotency_key, payload, status, progress, attempts, max_attempts
    ) VALUES (?, ?, ?, ?, 'queued', 0, 0, ?)
  `);

  insert.run(
    jobId,
    jobType,
    key,
    JSON.stringify(payload),
    maxAttempts
  );

  // 2. Trigger worker asynchronously without blocking HTTP response (Answers in milliseconds)
  setImmediate(() => {
    processJob(jobId, { customExecutor }).catch((err) => {
      console.error(`💥 [Async Worker] Unhandled exception processing job ${jobId}:`, err);
    });
  });

  const createdJob = getAsyncJob(jobId);
  return {
    job: createdJob,
    isReplay: false
  };
}

/**
 * Worker engine that processes a single background job with locking, progress, retries, and alerts
 * @param {string} jobId
 * @param {object} [options]
 * @param {Function} [options.customExecutor]
 * @returns {Promise<object>}
 */
async function processJob(jobId, options = {}) {
  const workerId = `worker-${process.pid}`;

  // Atomic lock: Only take job if in queued or failed (retryable) state
  const lockResult = db.prepare(`
    UPDATE async_jobs
    SET status = 'processing',
        locked_at = datetime('now'),
        locked_by = ?,
        started_at = COALESCE(started_at, datetime('now')),
        attempts = attempts + 1
    WHERE id = ? AND status IN ('queued', 'failed')
  `).run(workerId, jobId);

  if (lockResult.changes === 0) {
    // Job already picked up or finished
    return getAsyncJob(jobId);
  }

  const job = getAsyncJob(jobId);
  if (!job) return null;

  try {
    // Update Progress: 25%
    db.prepare('UPDATE async_jobs SET progress = 25 WHERE id = ?').run(jobId);

    let resultData = null;

    if (options.customExecutor) {
      resultData = await options.customExecutor(job.payload, { attempt: job.attempts });
    } else if (job.job_type === 'ai_judgement') {
      // Execute the A6 AI Judgement model call in the background
      const judgementResult = await makeJudgement(job.payload);
      resultData = judgementResult;
    } else if (job.job_type === 'match_evaluation') {
      resultData = await matchImagesForPost(job.payload);
    } else if (job.job_type === 'batch_vision') {
      resultData = await runBatchIngestionJob();
    } else {
      throw new Error(`Unknown job_type: ${job.job_type}`);
    }

    // Update Progress: 90%
    db.prepare('UPDATE async_jobs SET progress = 90 WHERE id = ?').run(jobId);

    // Mark Job as Completed
    const completedAt = new Date().toISOString();
    db.prepare(`
      UPDATE async_jobs
      SET status = 'completed',
          progress = 100,
          result = ?,
          completed_at = ?,
          locked_at = NULL,
          locked_by = NULL
      WHERE id = ?
    `).run(JSON.stringify(resultData), completedAt, jobId);

    console.log(`✅ [Async Worker] Job ${jobId} (${job.job_type}) completed successfully.`);
    return getAsyncJob(jobId);
  } catch (err) {
    console.error(`⚠️ [Async Worker] Job ${jobId} failed on attempt ${job.attempts}/${job.max_attempts}: ${err.message}`);

    const isTerminal = job.attempts >= job.max_attempts;

    if (isTerminal) {
      // Terminal Failure -> Mark failed and fire alert!
      const failedAt = new Date().toISOString();
      db.prepare(`
        UPDATE async_jobs
        SET status = 'failed',
            last_error = ?,
            completed_at = ?,
            locked_at = NULL,
            locked_by = NULL
        WHERE id = ?
      `).run(err.message, failedAt, jobId);

      // Trigger System Alert (Someone MUST find out)
      dispatchAlert({
        severity: 'critical',
        title: `Background Job ${job.job_type} Failed Terminally`,
        message: `Job ${jobId} reached max attempts (${job.max_attempts}). Error: ${err.message}`,
        job_id: jobId,
        metadata: {
          job_type: job.job_type,
          attempts: job.attempts,
          last_error: err.message,
          payload: job.payload
        }
      });

      return getAsyncJob(jobId);
    } else {
      // Retryable -> Schedule retry with exponential backoff
      const backoffMs = Math.min(10000, 150 * Math.pow(2, job.attempts - 1));
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

      db.prepare(`
        UPDATE async_jobs
        SET status = 'queued',
            last_error = ?,
            next_retry_at = ?,
            locked_at = NULL,
            locked_by = NULL
        WHERE id = ?
      `).run(err.message, nextRetryAt, jobId);

      setTimeout(() => {
        processJob(jobId, options).catch((e) => console.error(`Retry error on job ${jobId}:`, e));
      }, backoffMs);

      return getAsyncJob(jobId);
    }
  }
}

/**
 * Retrieve status and payload for an async background job
 * @param {string} id
 * @returns {object|null}
 */
function getAsyncJob(id) {
  const job = db.prepare('SELECT * FROM async_jobs WHERE id = ?').get(id);
  if (!job) return null;

  return {
    ...job,
    payload: job.payload ? JSON.parse(job.payload) : {},
    result: job.result ? JSON.parse(job.result) : null,
    check_url: `/api/v1/jobs/${job.id}`
  };
}

/**
 * List async background jobs
 * @param {object} [options]
 * @param {string} [options.status]
 * @param {string} [options.job_type]
 * @param {number} [options.limit=20]
 * @returns {Array<object>}
 */
function listAsyncJobs({ status, job_type, limit = 20 } = {}) {
  let query = 'SELECT * FROM async_jobs WHERE 1=1';
  const params = [];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  if (job_type) {
    query += ' AND job_type = ?';
    params.push(job_type);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params).map((j) => ({
    ...j,
    payload: j.payload ? JSON.parse(j.payload) : {},
    result: j.result ? JSON.parse(j.result) : null,
    check_url: `/api/v1/jobs/${j.id}`
  }));
}

module.exports = {
  enqueueAsyncJob,
  processJob,
  getAsyncJob,
  listAsyncJobs,
  generateIdempotencyKey
};
