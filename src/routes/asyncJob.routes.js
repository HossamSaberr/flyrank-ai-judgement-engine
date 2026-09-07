const express = require('express');
const { z } = require('zod');
const {
  enqueueAsyncJob,
  getAsyncJob,
  listAsyncJobs
} = require('../services/asyncJobQueue');
const { JudgementRequestSchema } = require('../schemas/judgement.schema');
const db = require('../db/connection');

const router = express.Router();

/**
 * Normalizes input payload for AI Judgement
 */
function normalizePayload(body) {
  let article = body.article;
  let image = body.image;

  if (body.post_id && !article) {
    const postRow = db.prepare('SELECT * FROM posts WHERE id = ?').get(body.post_id);
    if (postRow) {
      article = {
        title: postRow.title,
        content: postRow.content,
        category: postRow.category,
        expected_subject: postRow.expected_subject
      };
    }
  }

  if (body.image_id && !image) {
    const imgRow = db.prepare(`
      SELECT i.*, m.subject, m.category, m.attributes, m.caption, m.confidence
      FROM images i
      LEFT JOIN image_metadata m ON i.id = m.image_id
      WHERE i.id = ?
    `).get(body.image_id);
    if (imgRow) {
      image = {
        subject: imgRow.subject || imgRow.filename,
        category: imgRow.category || 'general',
        caption: imgRow.caption || '',
        attributes: imgRow.attributes ? JSON.parse(imgRow.attributes) : [],
        confidence: imgRow.confidence !== undefined ? imgRow.confidence : 1.0
      };
    }
  }

  if (!article && body.title && body.content) {
    article = {
      title: body.title,
      content: body.content,
      category: body.category || 'general',
      expected_subject: body.expected_subject || ''
    };
  }

  return {
    article,
    image,
    options: body.options || {}
  };
}

/**
 * POST /api/v1/jobs/judge & POST /api/v1/judge/async
 * Instantly accepts AI judgement request and returns 202 with polling link
 */
router.post('/judge', (req, res) => {
  const normalized = normalizePayload(req.body);
  const validation = JudgementRequestSchema.safeParse(normalized);

  if (!validation.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    });
  }

  const idempotencyKey = req.headers['idempotency-key'] || req.body.idempotency_key;
  const maxAttempts = parseInt(req.body.max_attempts || '3', 10);

  const { job, isReplay } = enqueueAsyncJob({
    jobType: 'ai_judgement',
    payload: validation.data,
    idempotencyKey,
    maxAttempts
  });

  if (isReplay) {
    res.setHeader('Idempotent-Replay', 'true');
  }

  const statusCode = isReplay && job.status === 'completed' ? 200 : 202;

  return res.status(statusCode).json({
    message: isReplay
      ? 'Idempotent replay: existing job retrieved'
      : 'AI Judgement job accepted for background processing',
    job_id: job.id,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    idempotency_key: job.idempotency_key,
    check_url: `/api/v1/jobs/${job.id}`,
    result: job.result || null,
    created_at: job.created_at
  });
});

/**
 * GET /api/v1/jobs/:id
 * Poll background job status and retrieve result
 */
router.get('/:id', (req, res) => {
  const job = getAsyncJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Background job not found' });
  }

  return res.status(200).json({
    job: {
      ...job,
      check_url: `/api/v1/jobs/${job.id}`
    }
  });
});

/**
 * GET /api/v1/jobs
 * List all background jobs
 */
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  const status = req.query.status;
  const jobType = req.query.job_type;

  const jobs = listAsyncJobs({ limit, status, job_type: jobType });

  return res.status(200).json({
    total: jobs.length,
    jobs
  });
});

module.exports = {
  asyncJobRouter: router,
  normalizePayload
};
