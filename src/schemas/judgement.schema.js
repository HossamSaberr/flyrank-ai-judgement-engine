const { z } = require('zod');

/**
 * Input Schema for AI Judgement Request
 */
const JudgementRequestSchema = z.object({
  article: z.object({
    title: z.string().min(1, 'Article title is required').trim(),
    content: z.string().min(1, 'Article content is required').trim(),
    category: z.string().optional().default('general').transform((s) => s.trim().toLowerCase()),
    expected_subject: z.string().optional().default('').transform((s) => s.trim().toLowerCase())
  }),
  image: z.object({
    subject: z.string().min(1, 'Image subject is required').trim().toLowerCase(),
    category: z.string().optional().default('general').transform((s) => s.trim().toLowerCase()),
    caption: z.string().optional().default(''),
    attributes: z.array(z.string()).optional().default([]),
    confidence: z.number().min(0.0).max(1.0).optional().default(1.0)
  }),
  options: z.object({
    strict_mode: z.boolean().optional().default(true),
    timeout_ms: z.number().positive().optional().default(5000),
    max_retries: z.number().int().min(0).max(5).optional().default(3)
  }).optional().default({})
});

/**
 * Output Schema for AI Judgement Response (The trusted contract)
 */
const JudgementResultSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'FLAGGED_FOR_REVIEW']),
  confidence: z.number().min(0.0).max(1.0),
  verdict_category: z.enum([
    'perfect_match',
    'acceptable_contextual',
    'taxonomy_conflict',
    'category_mismatch',
    'low_relevance',
    'ambiguous_visual'
  ]),
  taxonomy_compatible: z.boolean(),
  rationale: z.string().min(1, 'Rationale must not be empty'),
  risk_flags: z.array(z.string()),
  suggested_caption: z.string().optional(),
  evaluation_timestamp: z.string().datetime().or(z.string())
});

module.exports = {
  JudgementRequestSchema,
  JudgementResultSchema
};
