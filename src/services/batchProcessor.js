const crypto = require('crypto');
const db = require('../db/connection');
const { runMigrations } = require('../db/migrate');
const { IMAGE_CORPUS } = require('../data/imageCorpus');
const { analyzeImageWithVision } = require('./vision.service');
const { recordAICost } = require('./costTracker');

/**
 * Runs the asynchronous background batch ingestion job for the entire image corpus
 * @param {Array<object>} [customCorpus] Optional custom image list
 * @param {number} [maxRetries=3] Maximum retries on transient errors
 * @returns {Promise<object>} Batch execution report
 */
async function runBatchIngestionJob(customCorpus = IMAGE_CORPUS, maxRetries = 3) {
  runMigrations();
  const startTime = Date.now();
  console.log(`\n================================================================`);
  console.log(`📦 [Batch Ingestion] Starting vision understanding job for ${customCorpus.length} images...`);
  console.log(`================================================================\n`);

  let processedCount = 0;
  let acceptedCount = 0;
  let flaggedCount = 0;
  let failureCount = 0;
  const errors = [];

  const insertImage = db.prepare(`
    INSERT OR REPLACE INTO images (id, filename, url, width, height, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMetadata = db.prepare(`
    INSERT OR REPLACE INTO image_metadata (
      id, image_id, subject, category, attributes, caption, confidence, status, raw_vision_response
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const image of customCorpus) {
    insertImage.run(image.id, image.filename, image.url, image.width, image.height, image.mime_type || 'image/jpeg');

    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
      attempt++;
      try {
        const { metadata, status, raw } = await analyzeImageWithVision(image);

        const metaId = 'meta-' + crypto.randomUUID();
        insertMetadata.run(
          metaId,
          image.id,
          metadata.subject,
          metadata.category,
          JSON.stringify(metadata.attributes),
          metadata.caption,
          metadata.confidence,
          status,
          JSON.stringify(raw)
        );

        processedCount++;
        if (status === 'accepted') {
          acceptedCount++;
        } else {
          flaggedCount++;
        }
        success = true;
        console.log(`  ✓ Processed [${image.id}] "${metadata.subject}" (${metadata.category}) — Confidence: ${(metadata.confidence * 100).toFixed(0)}% [${status}]`);
      } catch (err) {
        console.warn(`  ⚠️ Attempt ${attempt}/${maxRetries} failed for [${image.id}]: ${err.message}`);
        if (attempt >= maxRetries) {
          failureCount++;
          errors.push({ image_id: image.id, error: err.message });
        } else {
          await new Promise((r) => setTimeout(r, 200 * attempt));
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(`\n================================================================`);
  console.log(`✨ [Batch Ingestion Finished] in ${durationMs}ms`);
  console.log(`   - Total Processed: ${processedCount}/${customCorpus.length}`);
  console.log(`   - Accepted:        ${acceptedCount}`);
  console.log(`   - Flagged (<0.70): ${flaggedCount}`);
  console.log(`   - Failed:          ${failureCount}`);
  console.log(`================================================================\n`);

  recordAICost({
    operation: 'batch_ingest',
    model_name: 'batch-orchestrator',
    input_tokens: processedCount * 258,
    output_tokens: processedCount * 85,
    latency_ms: durationMs,
    caller: 'system_batch_worker',
    metadata: { processed: processedCount, accepted: acceptedCount, flagged: flaggedCount }
  });

  return {
    success: failureCount === 0,
    total_images: customCorpus.length,
    processed: processedCount,
    accepted: acceptedCount,
    flagged: flaggedCount,
    failed: failureCount,
    duration_ms: durationMs,
    errors
  };
}

if (require.main === module) {
  runBatchIngestionJob();
}

module.exports = {
  runBatchIngestionJob
};
