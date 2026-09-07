const axios = require('axios');
const { JudgementResultSchema, JudgementRequestSchema } = require('../schemas/judgement.schema');
const { recordAICost } = require('./costTracker');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JUDGEMENT_MODEL = process.env.JUDGEMENT_MODEL || process.env.VISION_MODEL || 'gemini-1.5-flash';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.JUDGEMENT_TIMEOUT_MS || '5000', 10);
const DEFAULT_MAX_RETRIES = parseInt(process.env.JUDGEMENT_MAX_RETRIES || '3', 10);

class SchemaValidationError extends Error {
  constructor(message, rawData) {
    super(message);
    this.name = 'SchemaValidationError';
    this.rawData = rawData;
  }
}

class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Determines if an error is retryable
 * @param {Error} error
 * @returns {boolean}
 */
function isRetryableError(error) {
  if (error instanceof TimeoutError || error.name === 'TimeoutError') {
    return true;
  }
  if (error instanceof SchemaValidationError || error.name === 'SchemaValidationError') {
    return true;
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
    return true;
  }
  if (error.response) {
    const status = error.response.status;
    // 429 Rate Limit, 500, 502, 503, 504 are transient & retryable
    if (status === 429 || status >= 500) {
      return true;
    }
    // 400, 401, 403, 404 are non-retryable
    return false;
  }
  return false;
}

/**
 * Clean & extract JSON string from raw model text output
 * @param {string} text
 * @returns {string}
 */
function sanitizeJsonString(text) {
  if (typeof text !== 'string') return '{}';
  let cleaned = text.trim();
  // Remove markdown code fences
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  // Extract JSON object substring if model added preamble/postamble
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

/**
 * Taxonomy conflict rules for deterministic assessment & validation
 */
const TAXONOMY_RULES = [
  {
    expected: ['fox', 'red fox', 'arctic fox', 'vulpes'],
    forbidden: ['wolf', 'gray wolf', 'timber wolf', 'dog', 'domestic dog', 'german shepherd', 'golden retriever'],
    reason: 'Species conflict: article specifies wild fox (Vulpes), but candidate image depicts'
  },
  {
    expected: ['wolf', 'gray wolf', 'timber wolf', 'canis lupus'],
    forbidden: ['fox', 'red fox', 'dog', 'domestic dog'],
    reason: 'Species conflict: article specifies wolf predator, but candidate image depicts'
  },
  {
    expected: ['dog', 'domestic dog', 'pet', 'canine pet'],
    forbidden: ['wolf', 'gray wolf', 'fox', 'red fox', 'bear'],
    reason: 'Domestic pet vs wild predator conflict: candidate image depicts'
  }
];

/**
 * Offline Intelligent Deterministic Judgement Engine (Free zero-credential provider)
 * @param {object} article
 * @param {object} image
 * @returns {object} Raw judgment data
 */
function evaluateDeterministicJudgement(article, image) {
  const artTitle = (article.title || '').toLowerCase();
  const artContent = (article.content || '').toLowerCase();
  const artSubject = (article.expected_subject || artTitle).toLowerCase();
  const artCategory = (article.category || 'general').toLowerCase();

  const imgSubject = (image.subject || '').toLowerCase();
  const imgCategory = (image.category || 'general').toLowerCase();
  const imgCaption = (image.caption || '').toLowerCase();
  const imgConfidence = typeof image.confidence === 'number' ? image.confidence : 1.0;

  const riskFlags = [];

  // 1. Low-Confidence / Ambiguous Image Gate
  if (imgConfidence < 0.70 || imgCategory === 'ambiguous' || imgSubject.includes('unclear') || imgSubject.includes('blurry') || imgSubject.includes('silhouette')) {
    riskFlags.push('low_vision_confidence');
    return {
      decision: 'FLAGGED_FOR_REVIEW',
      confidence: parseFloat(imgConfidence.toFixed(2)),
      verdict_category: 'ambiguous_visual',
      taxonomy_compatible: false,
      rationale: `Image visual detection confidence is low (${(imgConfidence * 100).toFixed(0)}%) or image is visually ambiguous. Requires human editorial verification.`,
      risk_flags: riskFlags,
      suggested_caption: image.caption || `Flagged image: ${image.subject}`,
      evaluation_timestamp: new Date().toISOString()
    };
  }

  // 2. Explicit Taxonomy & Biological Species Conflict Check
  for (const rule of TAXONOMY_RULES) {
    const isTarget = rule.expected.some((exp) => artSubject.includes(exp) || artTitle.includes(exp) || artContent.includes(exp));
    if (isTarget) {
      const isForbidden = rule.forbidden.some((forbid) => imgSubject.includes(forbid) || imgCaption.includes(forbid));
      if (isForbidden) {
        riskFlags.push('taxonomic_conflict');
        return {
          decision: 'REJECTED',
          confidence: 0.95,
          verdict_category: 'taxonomy_conflict',
          taxonomy_compatible: false,
          rationale: `${rule.reason} "${image.subject}". Strict taxonomic boundary violated.`,
          risk_flags: riskFlags,
          suggested_caption: undefined,
          evaluation_timestamp: new Date().toISOString()
        };
      }
    }
  }

  // 3. Category & Domain Conflict Check
  if (artCategory !== 'general' && imgCategory !== 'general' && artCategory !== imgCategory) {
    if (
      (artCategory === 'wildlife' && ['culinary', 'technology', 'architecture'].includes(imgCategory)) ||
      (artCategory === 'technology' && ['culinary', 'wildlife', 'domestic_animal', 'landscape'].includes(imgCategory)) ||
      (artCategory === 'culinary' && ['technology', 'wildlife', 'aerospace'].includes(imgCategory))
    ) {
      riskFlags.push('category_mismatch');
      return {
        decision: 'REJECTED',
        confidence: 0.92,
        verdict_category: 'category_mismatch',
        taxonomy_compatible: false,
        rationale: `Broad category incompatibility: Article category is "${artCategory}" but image is categorized under "${imgCategory}".`,
        risk_flags: riskFlags,
        suggested_caption: undefined,
        evaluation_timestamp: new Date().toISOString()
      };
    }
  }

  // 4. Positive Relevance & Subject Alignment Check
  const subjectTokens = imgSubject.split(/\s+/).filter((t) => t.length > 2);
  const matchedTokens = subjectTokens.filter((token) => artTitle.includes(token) || artContent.includes(token) || artSubject.includes(token));
  const relevance = subjectTokens.length > 0 ? matchedTokens.length / subjectTokens.length : 0;

  if (relevance >= 0.5 || artSubject.includes(imgSubject) || imgSubject.includes(artSubject)) {
    return {
      decision: 'APPROVED',
      confidence: 0.96,
      verdict_category: 'perfect_match',
      taxonomy_compatible: true,
      rationale: `Strong editorial alignment: Image subject "${image.subject}" accurately represents article focus "${article.title}".`,
      risk_flags: [],
      suggested_caption: image.caption || `${image.subject} featured in ${article.title}`,
      evaluation_timestamp: new Date().toISOString()
    };
  }

  // 5. Contextual or Low Relevance
  if (relevance > 0.2 || artCategory === imgCategory) {
    return {
      decision: 'APPROVED',
      confidence: 0.78,
      verdict_category: 'acceptable_contextual',
      taxonomy_compatible: true,
      rationale: `Acceptable contextual match in "${imgCategory}" category.`,
      risk_flags: ['contextual_only'],
      suggested_caption: image.caption,
      evaluation_timestamp: new Date().toISOString()
    };
  }

  return {
    decision: 'REJECTED',
    confidence: 0.88,
    verdict_category: 'low_relevance',
    taxonomy_compatible: false,
    rationale: `Low semantic relevance: Image subject "${image.subject}" does not correspond to article content.`,
    risk_flags: ['low_relevance'],
    suggested_caption: undefined,
    evaluation_timestamp: new Date().toISOString()
  };
}

/**
 * Calls remote LLM provider (e.g. Gemini) with timeout and AbortController
 * @param {object} article
 * @param {object} image
 * @param {number} timeoutMs
 * @param {string} apiKey
 * @returns {Promise<{raw: object, inputTokens: number, outputTokens: number}>}
 */
async function callLlmProvider(article, image, timeoutMs, apiKey) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${JUDGEMENT_MODEL}:generateContent?key=${apiKey}`;
    const prompt = `You are a strict editorial and taxonomy judgement AI in an automated publishing pipeline.
Evaluate whether the candidate image is an accurate, taxonomically correct, and editorially suitable match for the article.

Article:
- Title: "${article.title}"
- Category: "${article.category || 'general'}"
- Expected Subject: "${article.expected_subject || 'none'}"
- Content: "${article.content.slice(0, 1000)}"

Candidate Image:
- Subject: "${image.subject}"
- Category: "${image.category || 'general'}"
- Caption: "${image.caption || ''}"
- Attributes: ${JSON.stringify(image.attributes || [])}
- Detection Confidence: ${image.confidence || 1.0}

Respond ONLY with a JSON object conforming strictly to this JSON schema:
{
  "decision": "APPROVED" | "REJECTED" | "FLAGGED_FOR_REVIEW",
  "confidence": float between 0.0 and 1.0,
  "verdict_category": "perfect_match" | "acceptable_contextual" | "taxonomy_conflict" | "category_mismatch" | "low_relevance" | "ambiguous_visual",
  "taxonomy_compatible": boolean,
  "rationale": "Clear, concise editorial explanation of the verdict",
  "risk_flags": ["array of risk tag strings, or empty array"],
  "suggested_caption": "optional caption string",
  "evaluation_timestamp": "${new Date().toISOString()}"
}`;

    const res = await axios.post(
      endpoint,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      },
      {
        signal: controller.signal,
        timeout: timeoutMs
      }
    );

    clearTimeout(timeoutHandle);

    const rawText = res.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanJson = sanitizeJsonString(rawText);
    let parsedJson;
    try {
      parsedJson = JSON.parse(cleanJson);
    } catch (e) {
      throw new SchemaValidationError(`Model returned unparseable JSON: ${e.message}`, rawText);
    }

    const inputTokens = res.data.usageMetadata?.promptTokenCount || 320;
    const outputTokens = res.data.usageMetadata?.candidatesTokenCount || 95;

    return {
      raw: parsedJson,
      inputTokens,
      outputTokens
    };
  } catch (err) {
    clearTimeout(timeoutHandle);
    if (axios.isCancel(err) || err.name === 'AbortError' || err.code === 'ECONNABORTED') {
      throw new TimeoutError(`LLM call timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

/**
 * Execute AI Judgement with timeout, retry backoff, schema validation, and cost auditing
 * @param {object} inputPayload Request input payload
 * @param {object} [customOptions] Override options (timeout_ms, max_retries, mockCaller)
 * @returns {Promise<{judgement: object, metadata: object}>}
 */
async function makeJudgement(inputPayload, customOptions = {}) {
  const startTime = Date.now();

  // 1. Validate Input Schema
  const inputValidation = JudgementRequestSchema.safeParse(inputPayload);
  if (!inputValidation.success) {
    const errorMsg = inputValidation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    const err = new Error(`Invalid Judgement Request: ${errorMsg}`);
    err.status = 400;
    err.details = inputValidation.error.issues;
    throw err;
  }

  const { article, image, options } = inputValidation.data;
  const timeoutMs = customOptions.timeout_ms || options.timeout_ms || DEFAULT_TIMEOUT_MS;
  const maxRetries = customOptions.max_retries !== undefined ? customOptions.max_retries : (options.max_retries !== undefined ? options.max_retries : DEFAULT_MAX_RETRIES);
  const mockProvider = customOptions.mockProvider;

  let attempt = 0;
  let lastError = null;
  let rawOutput = null;
  let providerUsed = 'deterministic-offline-judge';
  let inputTokens = 120;
  let outputTokens = 65;

  const hasApiKey = Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here');

  while (attempt <= maxRetries) {
    attempt++;
    const attemptStart = Date.now();

    try {
      // Execute provider within strict timeout boundary
      const providerPromise = (async () => {
        if (typeof mockProvider === 'function') {
          return await mockProvider(article, image, { attempt, timeoutMs });
        } else if (hasApiKey) {
          return await callLlmProvider(article, image, timeoutMs, GEMINI_API_KEY);
        } else {
          return {
            raw: evaluateDeterministicJudgement(article, image),
            provider: 'local-deterministic-judge',
            inputTokens: 150,
            outputTokens: 70
          };
        }
      })();

      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new TimeoutError(`Judgement execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      let providerResult;
      try {
        providerResult = await Promise.race([providerPromise, timeoutPromise]);
      } finally {
        clearTimeout(timeoutHandle);
      }

      rawOutput = providerResult.raw;
      providerUsed = providerResult.provider || 'mock-llm-provider';
      inputTokens = providerResult.inputTokens || 200;
      outputTokens = providerResult.outputTokens || 80;

      // 2. Strict Boundary Schema Validation on Output
      const schemaValidation = JudgementResultSchema.safeParse(rawOutput);
      if (!schemaValidation.success) {
        throw new SchemaValidationError(
          `Model output failed schema validation: ${schemaValidation.error.issues.map((i) => i.message).join(', ')}`,
          rawOutput
        );
      }

      const validatedJudgement = schemaValidation.data;
      const totalLatency = Date.now() - startTime;

      // 3. Record Cost in Database
      recordAICost({
        operation: 'ai_judgement',
        model_name: providerUsed,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        latency_ms: totalLatency,
        caller: 'api_judgement_endpoint',
        metadata: {
          article_title: article.title,
          image_subject: image.subject,
          decision: validatedJudgement.decision,
          attempts: attempt
        }
      });

      return {
        judgement: validatedJudgement,
        metadata: {
          provider: providerUsed,
          attempts: attempt,
          latency_ms: totalLatency,
          timeout_ms: timeoutMs
        }
      };
    } catch (err) {
      lastError = err;
      const isRetryable = isRetryableError(err);

      // If non-retryable (400, 401, 403, 404, etc.), stop immediately
      if (!isRetryable) {
        console.warn(`🛑 [AI Judge] Non-retryable error on attempt ${attempt}: ${err.message}. Aborting retries.`);
        break;
      }

      // If we have retries remaining, wait with exponential backoff & jitter
      if (attempt <= maxRetries) {
        const backoffMs = Math.min(1000, 50 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 20);
        console.warn(`⚠️ [AI Judge] Attempt ${attempt} failed (${err.message}). Retrying in ${backoffMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // If live provider failed after all retries, fail safely with validated deterministic fallback
  console.warn(`🛡️ [AI Judge] All ${attempt} attempts exhausted (${lastError?.message}). Activating safe deterministic fallback.`);
  const fallbackOutput = evaluateDeterministicJudgement(article, image);
  fallbackOutput.risk_flags = Array.from(new Set([...(fallbackOutput.risk_flags || []), 'fallback_provider_used']));

  const validatedFallback = JudgementResultSchema.parse(fallbackOutput);
  const totalLatency = Date.now() - startTime;

  recordAICost({
    operation: 'ai_judgement',
    model_name: 'local-deterministic-judge-fallback',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    latency_ms: totalLatency,
    caller: 'api_judgement_endpoint',
    metadata: {
      article_title: article.title,
      image_subject: image.subject,
      fallback_reason: lastError?.message,
      attempts: attempt
    }
  });

  return {
    judgement: validatedFallback,
    metadata: {
      provider: 'local-deterministic-judge-fallback',
      attempts: attempt,
      latency_ms: totalLatency,
      timeout_ms: timeoutMs,
      fallback: true,
      last_error: lastError?.message
    }
  };
}

module.exports = {
  makeJudgement,
  evaluateDeterministicJudgement,
  callLlmProvider,
  isRetryableError,
  sanitizeJsonString,
  SchemaValidationError,
  TimeoutError
};
