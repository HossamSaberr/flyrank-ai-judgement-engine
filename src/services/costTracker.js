const crypto = require('crypto');
const db = require('../db/connection');

// Pricing constants in USD per unit
const PRICING_RATES = {
  'gemini-1.5-flash-vision': {
    per_image: 0.00013,
    input_per_1k_tokens: 0.000075,
    output_per_1k_tokens: 0.0003
  },
  'gemini-1.5-flash': {
    input_per_1k_tokens: 0.000075,
    output_per_1k_tokens: 0.0003
  },
  'text-embedding-004': {
    input_per_1k_tokens: 0.00002
  },
  'local-semantic-embeddings': {
    input_per_1k_tokens: 0.0
  },
  'local-deterministic-judge': {
    input_per_1k_tokens: 0.0,
    output_per_1k_tokens: 0.0
  }
};

/**
 * Logs an AI operation and calculates estimated cost
 * @param {object} params
 * @param {'vision_tagging'|'embedding_generation'|'batch_ingest'|'ai_judgement'} params.operation
 * @param {string} params.model_name
 * @param {number} [params.input_tokens]
 * @param {number} [params.output_tokens]
 * @param {number} [params.latency_ms]
 * @param {string} [params.caller]
 * @param {object} [params.metadata]
 * @returns {object} Log record
 */
function recordAICost({
  operation,
  model_name,
  input_tokens = 0,
  output_tokens = 0,
  latency_ms = 0,
  caller = 'system',
  metadata = {}
}) {
  let costUsd = 0.0;

  if (operation === 'vision_tagging') {
    const rate = PRICING_RATES['gemini-1.5-flash-vision'];
    costUsd = rate.per_image + (input_tokens / 1000) * rate.input_per_1k_tokens + (output_tokens / 1000) * rate.output_per_1k_tokens;
  } else if (operation === 'embedding_generation') {
    const rate = PRICING_RATES[model_name] || PRICING_RATES['text-embedding-004'];
    costUsd = (input_tokens / 1000) * (rate.input_per_1k_tokens || 0.00002);
  } else if (operation === 'ai_judgement') {
    const rate = PRICING_RATES[model_name] || PRICING_RATES['gemini-1.5-flash'];
    costUsd = (input_tokens / 1000) * (rate.input_per_1k_tokens || 0.000075) + (output_tokens / 1000) * (rate.output_per_1k_tokens || 0.0003);
  }

  const logId = 'cost-' + crypto.randomUUID();
  const insert = db.prepare(`
    INSERT INTO ai_cost_logs (
      id, operation, model_name, input_tokens, output_tokens,
      cost_usd, latency_ms, caller, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    logId,
    operation,
    model_name,
    input_tokens,
    output_tokens,
    parseFloat(costUsd.toFixed(6)),
    latency_ms,
    caller,
    JSON.stringify(metadata)
  );

  return {
    id: logId,
    operation,
    model_name,
    cost_usd: parseFloat(costUsd.toFixed(6)),
    latency_ms
  };
}

/**
 * Returns aggregated AI cost metrics
 * @returns {object} Total costs, token counts, and operation breakdown
 */
function getCostSummary() {
  const totalStats = db.prepare(`
    SELECT
      COUNT(*) as total_calls,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens,
      COALESCE(SUM(output_tokens), 0) as total_output_tokens,
      COALESCE(SUM(cost_usd), 0.0) as total_cost_usd,
      COALESCE(AVG(latency_ms), 0.0) as avg_latency_ms
    FROM ai_cost_logs
  `).get();

  const byOperation = db.prepare(`
    SELECT
      operation,
      model_name,
      COUNT(*) as call_count,
      SUM(cost_usd) as cost_usd,
      SUM(input_tokens) as input_tokens,
      SUM(output_tokens) as output_tokens
    FROM ai_cost_logs
    GROUP BY operation, model_name
  `).all();

  const recentLogs = db.prepare(`
    SELECT * FROM ai_cost_logs ORDER BY created_at DESC LIMIT 10
  `).all();

  return {
    summary: {
      total_calls: totalStats.total_calls,
      total_tokens: totalStats.total_input_tokens + totalStats.total_output_tokens,
      total_cost_usd: parseFloat(totalStats.total_cost_usd.toFixed(6)),
      avg_latency_ms: Math.round(totalStats.avg_latency_ms)
    },
    by_operation: byOperation,
    recent_logs: recentLogs
  };
}

module.exports = {
  recordAICost,
  getCostSummary,
  PRICING_RATES
};
