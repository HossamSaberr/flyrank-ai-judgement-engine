const express = require('express');
const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const {
  enqueueReportJob,
  getJobStatus,
  listJobs,
  deleteReportJob
} = require('../services/reportJobQueue');
const {
  createSchedule,
  listSchedules,
  runScheduleNow
} = require('../services/reportScheduler');

const router = express.Router();

const GenerateReportSchema = z.object({
  type: z.enum(['executive_summary', 'cost_audit', 'matching_accuracy', 'full_audit']).optional().default('executive_summary'),
  parameters: z.record(z.any()).optional().default({})
});

const CreateScheduleSchema = z.object({
  name: z.string().min(1, 'Schedule name is required'),
  report_type: z.enum(['executive_summary', 'cost_audit', 'matching_accuracy', 'full_audit']).optional().default('executive_summary'),
  interval_minutes: z.number().int().positive().optional().default(60),
  parameters: z.record(z.any()).optional().default({})
});

/**
 * POST /api/v1/reports/generate (or POST /api/v1/reports)
 * Enqueue background report generation job
 */
router.post('/generate', (req, res) => {
  const parseResult = GenerateReportSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    });
  }

  const { type, parameters } = parseResult.data;
  const job = enqueueReportJob({
    type,
    parameters,
    triggered_by: 'on_demand'
  });

  return res.status(202).json({
    message: 'Report generation background job enqueued successfully',
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      check_url: `/api/v1/reports/jobs/${job.id}`,
      download_url: job.download_url,
      created_at: job.created_at
    }
  });
});

router.post('/', (req, res) => {
  req.url = '/generate';
  return router.handle(req, res);
});

/**
 * GET /api/v1/reports (List historical generated reports)
 */
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit || '20', 10);
  const status = req.query.status;
  const jobs = listJobs({ limit, status });

  return res.status(200).json({
    total: jobs.length,
    reports: jobs
  });
});

/**
 * GET /api/v1/reports/jobs/:id (Poll background job status)
 */
router.get('/jobs/:id', (req, res) => {
  const job = getJobStatus(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Report job not found' });
  }

  return res.status(200).json({
    job: {
      ...job,
      check_url: `/api/v1/reports/jobs/${job.id}`,
      download_url: job.download_url
    }
  });
});

/**
 * GET /api/v1/reports/download/:id (Download generated PDF artifact)
 */
router.get('/download/:id', (req, res) => {
  const job = getJobStatus(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Report job not found' });
  }

  if (job.status !== 'completed') {
    return res.status(409).json({
      error: 'Report artifact not ready yet',
      status: job.status,
      progress: job.progress,
      check_url: `/api/v1/reports/jobs/${job.id}`
    });
  }

  if (!job.artifact_path || !fs.existsSync(job.artifact_path)) {
    return res.status(404).json({ error: 'Report artifact file not found on disk' });
  }

  const filename = job.artifact_filename || `FlyRank_Report_${job.id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', job.artifact_size_bytes || fs.statSync(job.artifact_path).size);

  const fileStream = fs.createReadStream(job.artifact_path);
  fileStream.pipe(res);
});

/**
 * DELETE /api/v1/reports/:id (Delete report artifact and record)
 */
router.delete('/:id', (req, res) => {
  const success = deleteReportJob(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Report job not found' });
  }

  return res.status(200).json({
    message: 'Report and artifact deleted successfully'
  });
});

/**
 * POST /api/v1/reports/schedules (Create recurring report schedule)
 */
router.post('/schedules', (req, res) => {
  const parseResult = CreateScheduleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    });
  }

  const schedule = createSchedule(parseResult.data);
  return res.status(201).json({
    message: 'Report schedule created successfully',
    schedule
  });
});

/**
 * GET /api/v1/reports/schedules (List active schedules)
 */
router.get('/schedules', (req, res) => {
  const schedules = listSchedules();
  return res.status(200).json({
    total: schedules.length,
    schedules
  });
});

/**
 * POST /api/v1/reports/schedules/:id/run (Trigger schedule immediately)
 */
router.post('/schedules/:id/run', (req, res) => {
  try {
    const job = runScheduleNow(req.params.id);
    return res.status(202).json({
      message: 'Scheduled report job triggered successfully',
      job
    });
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

module.exports = router;
