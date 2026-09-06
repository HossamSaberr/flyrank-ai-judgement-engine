require('dotenv').config();

const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.60');
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.70');

// Taxonomy incompatibility pairs (Specific conflicts that must be guarded against)
const CONFLICT_RULES = [
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
  },
  {
    expected: ['quantum', 'quantum computer', 'microchip', 'semiconductor', 'datacenter', 'neural network'],
    forbidden: ['artisan coffee', 'pizza', 'ramen', 'beach', 'sand dunes'],
    reason: 'Technology domain mismatch: article is technical computing, candidate image is'
  }
];

/**
 * The Mismatch Guard: Evaluates candidate image against target post context
 * @param {object} post Target blog post
 * @param {object} image Candidate image with metadata
 * @param {number} similarityScore Cosine similarity score
 * @returns {{ passed: boolean, reason: string, rule_triggered?: string }}
 */
function evaluateCandidateWithGuard(post, image, similarityScore) {
  const postSubject = (post.expected_subject || '').toLowerCase();
  const postCategory = (post.category || '').toLowerCase();
  const imgSubject = (image.subject || '').toLowerCase();
  const imgCategory = (image.category || '').toLowerCase();

  // Gate 1: Vision Model Confidence Check
  if (image.status === 'flagged_low_confidence' || (image.confidence && image.confidence < CONFIDENCE_THRESHOLD)) {
    return {
      passed: false,
      reason: `Vision confidence gate: Candidate image was flagged with low detection confidence (${((image.confidence || 0) * 100).toFixed(0)}% < ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%)`,
      rule_triggered: 'LOW_VISION_CONFIDENCE'
    };
  }

  // Gate 2: Explicit Taxonomy & Subject Conflict Check
  for (const rule of CONFLICT_RULES) {
    const isExpectedTarget = rule.expected.some((exp) => postSubject.includes(exp) || post.title.toLowerCase().includes(exp));
    if (isExpectedTarget) {
      const isForbiddenCandidate = rule.forbidden.some((forbid) => imgSubject.includes(forbid) || image.caption.toLowerCase().includes(forbid));
      if (isForbiddenCandidate) {
        return {
          passed: false,
          reason: `${rule.reason} "${imgSubject}" (${imgCategory})`,
          rule_triggered: 'TAXONOMY_CONFLICT'
        };
      }
    }
  }

  // Gate 3: Broad Category Conflict Check
  if (postCategory && imgCategory && postCategory !== 'general' && imgCategory !== 'general') {
    // If post is wildlife and image is culinary/technology/architecture -> reject
    if (postCategory === 'wildlife' && ['culinary', 'technology', 'architecture'].includes(imgCategory)) {
      return {
        passed: false,
        reason: `Category mismatch: Article category is "${postCategory}", but image is categorized under "${imgCategory}"`,
        rule_triggered: 'CATEGORY_MISMATCH'
      };
    }
    if (postCategory === 'technology' && ['culinary', 'wildlife', 'domestic_animal'].includes(imgCategory)) {
      return {
        passed: false,
        reason: `Category mismatch: Article category is "${postCategory}", but image is categorized under "${imgCategory}"`,
        rule_triggered: 'CATEGORY_MISMATCH'
      };
    }
  }

  // Gate 4: Similarity Threshold Gate
  if (similarityScore < SIMILARITY_THRESHOLD) {
    return {
      passed: false,
      reason: `Similarity threshold gate: Semantic score (${similarityScore.toFixed(2)}) is below the minimum required threshold (${SIMILARITY_THRESHOLD.toFixed(2)})`,
      rule_triggered: 'LOW_SIMILARITY_SCORE'
    };
  }

  // All Gates Passed
  return {
    passed: true,
    reason: `High-confidence semantic alignment (Score: ${similarityScore.toFixed(2)}) matching subject "${imgSubject}"`,
    rule_triggered: 'NONE'
  };
}

module.exports = {
  evaluateCandidateWithGuard,
  SIMILARITY_THRESHOLD,
  CONFIDENCE_THRESHOLD
};
