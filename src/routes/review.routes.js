const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db/connection');

const router = express.Router();

const ReviewActionSchema = z.object({
  post_id: z.string().min(1, 'post_id is required'),
  image_id: z.string().min(1, 'image_id is required'),
  notes: z.string().optional()
});

/**
 * POST /api/v1/reviews/approve (Approve an image recommendation)
 */
router.post('/approve', (req, res) => {
  const parseResult = ReviewActionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues.map((i) => i.message)
    });
  }

  const { post_id, image_id, notes } = parseResult.data;

  const reviewId = 'rev-' + crypto.randomUUID();
  const insertReview = db.prepare(`
    INSERT OR REPLACE INTO reviews (id, post_id, image_id, decision, reviewer_notes)
    VALUES (?, ?, ?, 'approved', ?)
  `);

  insertReview.run(reviewId, post_id, image_id, notes || 'Approved by reviewer');

  return res.status(200).json({
    message: 'Recommendation approved successfully',
    review: {
      id: reviewId,
      post_id,
      image_id,
      decision: 'approved',
      notes: notes || 'Approved by reviewer'
    }
  });
});

/**
 * POST /api/v1/reviews/reject (Reject an image recommendation)
 */
router.post('/reject', (req, res) => {
  const parseResult = ReviewActionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues.map((i) => i.message)
    });
  }

  const { post_id, image_id, notes } = parseResult.data;

  const reviewId = 'rev-' + crypto.randomUUID();
  const insertReview = db.prepare(`
    INSERT OR REPLACE INTO reviews (id, post_id, image_id, decision, reviewer_notes)
    VALUES (?, ?, ?, 'rejected', ?)
  `);

  insertReview.run(reviewId, post_id, image_id, notes || 'Rejected by reviewer');

  return res.status(200).json({
    message: 'Recommendation rejected',
    review: {
      id: reviewId,
      post_id,
      image_id,
      decision: 'rejected',
      notes: notes || 'Rejected by reviewer'
    }
  });
});

/**
 * GET /api/v1/reviews/pending (List matches awaiting review)
 */
router.get('/pending', (req, res) => {
  const pendingMatches = db.prepare(`
    SELECT
      m.id as match_id, m.post_id, m.image_id, m.similarity_score, m.guard_status, m.guard_reason,
      p.title as post_title, p.expected_subject,
      i.filename, i.url as image_url,
      meta.subject as image_subject, meta.category as image_category, meta.caption as image_caption
    FROM matches m
    JOIN posts p ON m.post_id = p.id
    JOIN images i ON m.image_id = i.id
    JOIN image_metadata meta ON i.id = meta.image_id
    LEFT JOIN reviews r ON m.post_id = r.post_id AND m.image_id = r.image_id
    WHERE r.id IS NULL
    ORDER BY m.created_at DESC
  `).all();

  return res.status(200).json({
    count: pendingMatches.length,
    pending_reviews: pendingMatches
  });
});

/**
 * GET /api/v1/reviews/history (List past review decisions)
 */
router.get('/history', (req, res) => {
  const history = db.prepare(`
    SELECT
      r.id, r.post_id, r.image_id, r.decision, r.reviewer_notes, r.created_at,
      p.title as post_title, i.filename, i.url as image_url
    FROM reviews r
    JOIN posts p ON r.post_id = p.id
    JOIN images i ON r.image_id = i.id
    ORDER BY r.created_at DESC
  `).all();

  return res.status(200).json({ history });
});

module.exports = router;
