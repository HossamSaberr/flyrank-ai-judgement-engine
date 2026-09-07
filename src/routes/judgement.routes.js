const express = require('express');
const { makeJudgement } = require('../services/judgement.service');
const { JudgementRequestSchema } = require('../schemas/judgement.schema');
const db = require('../db/connection');

const router = express.Router();

/**
 * Normalizes flexible request bodies into standard Judgement input payload
 * @param {object} body
 * @returns {object}
 */
function normalizePayload(body) {
  let article = body.article;
  let image = body.image;

  // Handle post_id lookup if provided
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

  // Handle image_id lookup if provided
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

  // Handle flat body format: { title, content, category, expected_subject, image: {...} }
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
 * POST /api/v1/judge & POST /api/v1/match/evaluate
 * Execute AI model judgement on article and candidate image pairing
 */
router.post('/', async (req, res) => {
  try {
    const normalized = normalizePayload(req.body);

    const validation = JudgementRequestSchema.safeParse(normalized);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      });
    }

    const result = await makeJudgement(validation.data);

    return res.status(200).json({
      status: 'success',
      judgement: result.judgement,
      metadata: result.metadata
    });
  } catch (err) {
    if (err.status === 400 || err.name === 'ZodError') {
      return res.status(400).json({
        error: err.message,
        details: err.details || []
      });
    }

    console.error('💥 [Judgement Route Error]:', err);
    return res.status(500).json({
      error: 'Internal Judgement Processing Error',
      message: err.message
    });
  }
});

module.exports = router;
