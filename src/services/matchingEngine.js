const crypto = require('crypto');
const db = require('../db/connection');
const { generateEmbedding, cosineSimilarity } = require('./embedding.service');
const { evaluateCandidateWithGuard } = require('./mismatchGuard');

/**
 * Evaluates an article / post against all images in the database
 * Returns ranked image candidates and Mismatch Guard decisions
 * @param {object} post Target article / post object
 * @returns {Promise<object>}
 */
async function matchImagesForPost(post) {
  // 1. Generate / Retrieve Post Embedding
  const postText = `${post.title}. Subject: ${post.expected_subject}. Category: ${post.category}. ${post.content}`;
  const postVector = await generateEmbedding(postText);

  // 2. Fetch all ingested images with metadata and stored vectors
  const candidateRows = db.prepare(`
    SELECT
      i.id, i.filename, i.url, i.width, i.height,
      m.subject, m.category, m.attributes, m.caption, m.confidence, m.status,
      e.vector
    FROM images i
    JOIN image_metadata m ON i.id = m.image_id
    JOIN embeddings e ON i.id = e.entity_id AND e.entity_type = 'image'
  `).all();

  if (candidateRows.length === 0) {
    return {
      status: 'no_confident_match',
      message: 'Image library is empty. Please run batch ingestion first.',
      post_id: post.id,
      candidates: []
    };
  }

  // 3. Compute Cosine Similarity for every candidate image
  const scoredCandidates = candidateRows.map((row) => {
    const imageVector = JSON.parse(row.vector);
    const score = cosineSimilarity(postVector, imageVector);

    const imageObj = {
      id: row.id,
      filename: row.filename,
      url: row.url,
      subject: row.subject,
      category: row.category,
      attributes: JSON.parse(row.attributes),
      caption: row.caption,
      confidence: row.confidence,
      status: row.status
    };

    // 4. Pass candidate through Mismatch Guard
    const guardDecision = evaluateCandidateWithGuard(post, imageObj, score);

    return {
      image: imageObj,
      similarity_score: score,
      guard_passed: guardDecision.passed,
      guard_reason: guardDecision.reason,
      rule_triggered: guardDecision.rule_triggered
    };
  });

  // Sort candidates by similarity score descending
  scoredCandidates.sort((a, b) => b.similarity_score - a.similarity_score);

  // 5. Select Best Passing Candidate
  const passingCandidates = scoredCandidates.filter((c) => c.guard_passed);
  const bestCandidate = passingCandidates.length > 0 ? passingCandidates[0] : null;

  // Record Top Decision in Matches Table
  if (bestCandidate && post.id) {
    const matchId = 'match-' + crypto.randomUUID();
    const insertMatch = db.prepare(`
      INSERT OR REPLACE INTO matches (id, post_id, image_id, similarity_score, guard_status, guard_reason)
      VALUES (?, ?, ?, ?, 'passed', ?)
    `);
    insertMatch.run(matchId, post.id, bestCandidate.image.id, bestCandidate.similarity_score, bestCandidate.guard_reason);
  }

  if (bestCandidate) {
    return {
      status: 'matched',
      post_id: post.id,
      post_title: post.title,
      expected_subject: post.expected_subject,
      selected_image: bestCandidate.image,
      similarity_score: bestCandidate.similarity_score,
      guard_status: 'passed',
      match_explanation: bestCandidate.guard_reason,
      ranked_candidates: scoredCandidates.slice(0, 5)
    };
  } else {
    const highestScoring = scoredCandidates[0];
    return {
      status: 'no_confident_match',
      post_id: post.id,
      post_title: post.title,
      expected_subject: post.expected_subject,
      selected_image: null,
      guard_status: 'rejected',
      message: 'No candidate image cleared the mismatch safety thresholds',
      refusal_reason: highestScoring ? highestScoring.guard_reason : 'No candidates available',
      top_rejected_candidate: highestScoring
        ? {
            image_id: highestScoring.image.id,
            subject: highestScoring.image.subject,
            similarity_score: highestScoring.similarity_score,
            reason: highestScoring.guard_reason
          }
        : null,
      ranked_candidates: scoredCandidates.slice(0, 5)
    };
  }
}

module.exports = {
  matchImagesForPost
};
