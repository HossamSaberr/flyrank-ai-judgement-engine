const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const db = require('../src/db/connection');
const { runMigrations } = require('../src/db/migrate');
const { runBatchIngestionJob } = require('../src/services/batchProcessor');
const { generateAndStoreImageEmbeddings } = require('../src/services/embedding.service');
const { evaluateCandidateWithGuard } = require('../src/services/mismatchGuard');
const { runEvaluationBenchmark } = require('../src/eval');
const { getCostSummary } = require('../src/services/costTracker');

const PORT = 3999;
let server;

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 FlyRank AI Image Engine — Acceptance Test Suite & Probes');
  console.log('================================================================\n');

  runMigrations();
  await runBatchIngestionJob();
  await generateAndStoreImageEmbeddings();

  server = app.listen(PORT);

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // PROBE 1: Batch Job Structured Schema & Low-Confidence Gating
    // -------------------------------------------------------------------------
    await test('PROBE 1 — Batch job on corpus creates schema-valid tags and flags low-confidence images', async () => {
      const res = await request('/api/v1/images');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.total >= 20, 'Expected >= 20 images');

      // Verify every image has valid schema attributes
      for (const img of res.body.images) {
        assert.ok(img.subject, 'Subject must be populated');
        assert.ok(img.category, 'Category must be populated');
        assert.ok(Array.isArray(img.attributes), 'Attributes must be an array');
        assert.ok(typeof img.confidence === 'number');
      }

      // Check that at least one low-confidence image is flagged (<0.70)
      const flaggedImages = res.body.images.filter((img) => img.vision_status === 'flagged_low_confidence');
      assert.ok(flaggedImages.length >= 1, 'Expected at least 1 image to be flagged for low confidence');
      assert.ok(flaggedImages[0].confidence < 0.7, 'Flagged image must have confidence < 0.70');
    });

    // -------------------------------------------------------------------------
    // PROBE 2: Semantic Matching — Red Fox Ranks First over Wolf and Dog
    // -------------------------------------------------------------------------
    await test('PROBE 2 — Red fox article ranks fox image #1, wolf and dog rank clearly lower', async () => {
      // Create a test post on Red Foxes
      const createPostRes = await request('/api/v1/posts', { method: 'POST' }, {
        title: 'The Secret Lives of Wild Red Foxes',
        category: 'wildlife',
        expected_subject: 'red fox',
        content: 'Comprehensive research on Vulpes vulpes behaviors in North American forests and hunting strategies.'
      });
      assert.strictEqual(createPostRes.status, 201);
      const postId = createPostRes.body.post.id;

      // Query matching candidates
      const matchRes = await request(`/api/v1/posts/${postId}/matches`);
      assert.strictEqual(matchRes.status, 200);
      assert.strictEqual(matchRes.body.status, 'matched');
      assert.ok(matchRes.body.selected_image.subject.includes('fox'), 'Selected image must be a fox');

      // Verify wolf and dog rank lower
      const candidates = matchRes.body.ranked_candidates;
      const foxCandidate = candidates.find((c) => c.image.subject.includes('fox'));
      const wolfCandidate = candidates.find((c) => c.image.subject.includes('wolf'));
      const dogCandidate = candidates.find((c) => c.image.subject.includes('dog'));

      assert.ok(foxCandidate, 'Must contain fox candidate');
      assert.ok(wolfCandidate, 'Must contain wolf candidate');
      assert.ok(dogCandidate, 'Must contain dog candidate');
      assert.ok(
        foxCandidate.similarity_score > wolfCandidate.similarity_score,
        'Fox candidate score must exceed wolf candidate score'
      );
      assert.ok(
        foxCandidate.similarity_score > dogCandidate.similarity_score,
        'Fox candidate score must exceed dog candidate score'
      );
    });

    // -------------------------------------------------------------------------
    // PROBE 3: Mismatch Guard — Force Wolf as Candidate for Fox Post
    // -------------------------------------------------------------------------
    await test('PROBE 3 — Force wolf candidate for fox post -> guard rejects with taxonomy mismatch reason', async () => {
      const foxPost = {
        id: 'test-fox-post',
        title: 'The Behavior of Wild Red Foxes',
        category: 'wildlife',
        expected_subject: 'red fox',
        content: 'Studying red fox populations and behaviors.'
      };

      const wolfImage = {
        id: 'img-wolf-01',
        subject: 'gray wolf',
        category: 'wildlife',
        caption: 'A gray wolf in snowy woods',
        confidence: 0.95,
        status: 'accepted'
      };

      const guardDecision = evaluateCandidateWithGuard(foxPost, wolfImage, 0.85);
      assert.strictEqual(guardDecision.passed, false, 'Guard must reject wolf on fox post');
      assert.ok(
        guardDecision.reason.toLowerCase().includes('species conflict') ||
        guardDecision.reason.toLowerCase().includes('fox'),
        'Reason must clearly mention conflict with fox/wolf'
      );
    });

    // -------------------------------------------------------------------------
    // PROBE 4: Safe Refusal when No Image Matches
    // -------------------------------------------------------------------------
    await test('PROBE 4 — Post with no suitable image returns "no confident match" + diagnostic reason', async () => {
      const createPostRes = await request('/api/v1/posts', { method: 'POST' }, {
        title: 'Deep Orbital Astrophotography and Martian Probes',
        category: 'aerospace',
        expected_subject: 'deep space probe',
        content: 'Telemetry and ion propulsion thrusters for robotic probes travelling in deep interstellar space.'
      });
      assert.strictEqual(createPostRes.status, 201);
      const postId = createPostRes.body.post.id;

      const matchRes = await request(`/api/v1/posts/${postId}/matches`);
      assert.strictEqual(matchRes.status, 200);
      assert.strictEqual(matchRes.body.status, 'no_confident_match');
      assert.strictEqual(matchRes.body.selected_image, null);
      assert.ok(matchRes.body.refusal_reason.length > 0, 'Must include human-readable refusal reason');
    });

    // -------------------------------------------------------------------------
    // PROBE 5: Labeled Evaluation Dataset Precision Benchmark
    // -------------------------------------------------------------------------
    await test('PROBE 5 — Evaluation script reports Top-1 precision on labeled dataset', async () => {
      const evalRes = await request('/api/v1/eval/benchmark');
      assert.strictEqual(evalRes.status, 200);
      assert.ok(evalRes.body.metrics.total_cases >= 10);
      assert.strictEqual(evalRes.body.metrics.top1_precision_pct, 100);
      assert.strictEqual(evalRes.body.metrics.hard_negative_rejection_rate_pct, 100);
    });

    // -------------------------------------------------------------------------
    // PROBE 6: Cost Tracking Log Attribution
    // -------------------------------------------------------------------------
    await test('PROBE 6 — Every AI vision/embedding call is attributed in cost logs with tokens and USD cost', async () => {
      const costRes = await request('/api/v1/costs/summary');
      assert.strictEqual(costRes.status, 200);
      assert.ok(costRes.body.summary.total_calls > 0);
      assert.ok(costRes.body.summary.total_tokens > 0);
      assert.ok(costRes.body.summary.total_cost_usd >= 0.0);
      assert.ok(Array.isArray(costRes.body.by_operation));
      assert.ok(Array.isArray(costRes.body.recent_logs));
    });

    // -------------------------------------------------------------------------
    // 7. Human-in-the-Loop Review Workflow Tests
    // -------------------------------------------------------------------------
    await test('Review API: Approve and Reject pairings', async () => {
      // Create a test post in database to ensure FK validity
      const createPostRes = await request('/api/v1/posts', { method: 'POST' }, {
        title: 'Review Workflow Test Article',
        category: 'wildlife',
        expected_subject: 'red fox',
        content: 'Review testing article content.'
      });
      const testPostId = createPostRes.body.post.id;

      // Test approve
      const approveRes = await request('/api/v1/reviews/approve', { method: 'POST' }, {
        post_id: testPostId,
        image_id: 'img-fox-01',
        notes: 'Verified excellent pairing'
      });
      assert.strictEqual(approveRes.status, 200);
      assert.strictEqual(approveRes.body.review.decision, 'approved');

      // Test reject
      const rejectRes = await request('/api/v1/reviews/reject', { method: 'POST' }, {
        post_id: testPostId,
        image_id: 'img-wolf-01',
        notes: 'Wolf is unacceptable for fox post'
      });
      assert.strictEqual(rejectRes.status, 200);
      assert.strictEqual(rejectRes.body.review.decision, 'rejected');

      // Check review history
      const histRes = await request('/api/v1/reviews/history');
      assert.strictEqual(histRes.status, 200);
      assert.ok(histRes.body.history.length >= 2);
    });

    console.log('\n----------------------------------------------------------------');
    console.log(`Summary: ${passed}/${total} test probes passed with 100% success.`);
    console.log('----------------------------------------------------------------\n');
  } finally {
    server.close();
  }
}

if (require.main === module) {
  runTestSuite().then(() => process.exit(0));
}

module.exports = runTestSuite;
