const db = require('../db/connection');

/**
 * Aggregates complete analytics data for executive and operational PDF reporting
 * @param {object} [filters] Optional filters (e.g., category, date range)
 * @returns {object} Aggregated report dataset
 */
function aggregateReportData(filters = {}) {
  // 1. Image Library Aggregations
  const imageTotals = db.prepare(`
    SELECT
      COUNT(i.id) as total_images,
      COALESCE(SUM(CASE WHEN m.status = 'accepted' THEN 1 ELSE 0 END), 0) as accepted_count,
      COALESCE(SUM(CASE WHEN m.status = 'flagged_low_confidence' THEN 1 ELSE 0 END), 0) as flagged_count,
      COALESCE(AVG(m.confidence), 0.0) as avg_confidence
    FROM images i
    LEFT JOIN image_metadata m ON i.id = m.image_id
  `).get();

  const imageCategories = db.prepare(`
    SELECT COALESCE(m.category, 'unassigned') as category, COUNT(*) as count
    FROM images i
    LEFT JOIN image_metadata m ON i.id = m.image_id
    GROUP BY m.category
    ORDER BY count DESC
  `).all();

  // 2. Article / Post Aggregations
  const postTotals = db.prepare(`
    SELECT
      COUNT(*) as total_posts,
      COUNT(DISTINCT category) as total_categories
    FROM posts
  `).get();

  const postCategories = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM posts
    GROUP BY category
    ORDER BY count DESC
  `).all();

  // 3. Matching Engine & Mismatch Guard Aggregations
  const matchTotals = db.prepare(`
    SELECT
      COUNT(*) as total_evaluated,
      COALESCE(SUM(CASE WHEN guard_status = 'passed' THEN 1 ELSE 0 END), 0) as passed_count,
      COALESCE(SUM(CASE WHEN guard_status = 'rejected' THEN 1 ELSE 0 END), 0) as rejected_count,
      COALESCE(AVG(similarity_score), 0.0) as avg_similarity
    FROM matches
  `).get();

  const rejectionBreakdown = db.prepare(`
    SELECT
      CASE
        WHEN guard_reason LIKE '%Species conflict%' OR guard_reason LIKE '%taxonomic%' THEN 'Taxonomic / Species Conflict'
        WHEN guard_reason LIKE '%Category mismatch%' OR guard_reason LIKE '%domain%' THEN 'Category / Domain Mismatch'
        WHEN guard_reason LIKE '%confidence%' THEN 'Low Vision Confidence'
        WHEN guard_reason LIKE '%threshold%' OR guard_reason LIKE '%score%' THEN 'Below Similarity Threshold'
        ELSE 'Other Refusal Reason'
      END as reason_category,
      COUNT(*) as count
    FROM matches
    WHERE guard_status = 'rejected'
    GROUP BY reason_category
    ORDER BY count DESC
  `).all();

  // 4. Human-in-the-Loop Review Metrics
  const reviewTotals = db.prepare(`
    SELECT
      COUNT(*) as total_reviews,
      COALESCE(SUM(CASE WHEN decision = 'approved' THEN 1 ELSE 0 END), 0) as approved_count,
      COALESCE(SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END), 0) as rejected_count
    FROM reviews
  `).get();

  const approvalRate = reviewTotals.total_reviews > 0
    ? ((reviewTotals.approved_count / reviewTotals.total_reviews) * 100).toFixed(1)
    : '100.0';

  // 5. AI Cost Accounting & Token Attribution
  const costTotals = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(cost_usd), 0.0) as total_cost_usd,
      COALESCE(AVG(latency_ms), 0.0) as avg_latency_ms
    FROM ai_cost_logs
  `).get();

  const costByOperation = db.prepare(`
    SELECT
      operation,
      model_name,
      COUNT(*) as call_count,
      COALESCE(SUM(cost_usd), 0.0) as cost_usd,
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(AVG(latency_ms), 0.0) as avg_latency_ms
    FROM ai_cost_logs
    GROUP BY operation, model_name
    ORDER BY cost_usd DESC
  `).all();

  // 6. Recent Match Decisions
  const recentMatches = db.prepare(`
    SELECT
      m.id, m.similarity_score, m.guard_status, m.guard_reason, m.created_at,
      p.title as post_title,
      COALESCE(meta.subject, i.filename) as image_subject
    FROM matches m
    JOIN posts p ON m.post_id = p.id
    JOIN images i ON m.image_id = i.id
    LEFT JOIN image_metadata meta ON i.id = meta.image_id
    ORDER BY m.created_at DESC
    LIMIT 6
  `).all();

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_images: imageTotals.total_images || 0,
      accepted_images: imageTotals.accepted_count || 0,
      flagged_images: imageTotals.flagged_count || 0,
      avg_confidence_pct: (imageTotals.avg_confidence * 100).toFixed(1),
      total_posts: postTotals.total_posts || 0,
      total_matches_evaluated: matchTotals.total_evaluated || 0,
      match_pass_rate_pct: matchTotals.total_evaluated > 0 ? ((matchTotals.passed_count / matchTotals.total_evaluated) * 100).toFixed(1) : '100.0',
      human_approval_rate_pct: approvalRate,
      total_ai_calls: costTotals.total_calls || 0,
      total_tokens: (costTotals.total_input_tokens || 0) + (costTotals.total_output_tokens || 0),
      total_cost_usd: parseFloat((costTotals.total_cost_usd || 0.0).toFixed(6)),
      avg_ai_latency_ms: Math.round(costTotals.avg_latency_ms || 0)
    },
    image_categories: imageCategories,
    post_categories: postCategories,
    rejection_breakdown: rejectionBreakdown,
    cost_breakdown: costByOperation,
    recent_matches: recentMatches
  };
}

module.exports = {
  aggregateReportData
};
