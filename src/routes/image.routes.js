const express = require('express');
const db = require('../db/connection');
const { runBatchIngestionJob } = require('../services/batchProcessor');
const { generateAndStoreImageEmbeddings } = require('../services/embedding.service');

const router = express.Router();

/**
 * GET /api/v1/images (List all ingested images with vision metadata)
 */
router.get('/', (req, res) => {
  const { category, status } = req.query;

  let query = `
    SELECT
      i.id, i.filename, i.url, i.width, i.height, i.created_at,
      m.subject, m.category, m.attributes, m.caption, m.confidence, m.status as vision_status
    FROM images i
    LEFT JOIN image_metadata m ON i.id = m.image_id
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    query += ' AND m.category = ?';
    params.push(category);
  }

  if (status) {
    query += ' AND m.status = ?';
    params.push(status);
  }

  query += ' ORDER BY i.created_at DESC';

  const images = db.prepare(query).all(...params).map((img) => ({
    ...img,
    attributes: img.attributes ? JSON.parse(img.attributes) : []
  }));

  return res.status(200).json({
    total: images.length,
    images
  });
});

/**
 * POST /api/v1/images/batch-ingest (Trigger batch vision processing job)
 */
router.post('/batch-ingest', async (req, res) => {
  try {
    const report = await runBatchIngestionJob();
    await generateAndStoreImageEmbeddings();

    return res.status(202).json({
      message: 'Batch ingestion job completed successfully',
      report
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/images/:id (Get single image details)
 */
router.get('/:id', (req, res) => {
  const image = db.prepare(`
    SELECT
      i.id, i.filename, i.url, i.width, i.height, i.created_at,
      m.subject, m.category, m.attributes, m.caption, m.confidence, m.status as vision_status
    FROM images i
    LEFT JOIN image_metadata m ON i.id = m.image_id
    WHERE i.id = ?
  `).get(req.params.id);

  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }

  return res.status(200).json({
    image: {
      ...image,
      attributes: image.attributes ? JSON.parse(image.attributes) : []
    }
  });
});

module.exports = router;
