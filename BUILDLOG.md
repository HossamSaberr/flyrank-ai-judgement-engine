# 🤖 BUILDLOG.md — AI-Assisted Engineering Log
## Capstone: AI Image Understanding & Content Matching Engine

This log tracks architectural decisions, prompts, AI assistance, corrections, and manual engineering refinements across the project.

---

## 1. Phase 1 — Design & Architecture
- **Where AI helped**: Designing the multi-layer Mismatch Guard logic combining cosine similarity thresholds, taxonomy/category compatibility checks, and vision confidence gating.
- **Where AI needed correction**: The initial model only considered cosine distance, which fails on hard semantic negatives (e.g., foxes vs wolves, which have very similar word embeddings). Refined to enforce an explicit taxonomy verification gate.
- **What was manually customized**: Curated an initial 40+ image corpus spanning diverse categories (animals, landscapes, technology, food, architecture) with intentional hard negatives (e.g. Red Fox vs Gray Wolf vs German Shepherd) to thoroughly test the guard.

---

## 2. Phase 2 — Database Schema & Cost Tracking
- **Where AI helped**: Setting up SQLite tables for image metadata, vector embeddings, matches, reviews, and cost tracking.
- **Where AI needed correction**: Ensuring all vision model and embedding API operations are attributed with token counts, latency, and estimated USD cost in `ai_cost_logs`.
- **What was manually customized**: Added vector serialization utilities and database indexes on `image_id`, `post_id`, and `created_at`.

---

## 3. Phase 3 — Vision Ingestion, Schema Validation & Batch Processing
- **Where AI helped**: Structuring the vision tagging prompt and Zod schema validation rules.
- **Where AI needed correction**: Ensuring that low-confidence classifications (`confidence < 0.70`) are flagged rather than blindly accepted.
- **What was manually customized**: Implemented an asynchronous batch processor with retry mechanisms and progress tracking so slow vision calls never block the API.

---

## 4. Phase 4 — Semantic Embeddings & Similarity Ranking
- **Where AI helped**: Implementing cosine similarity calculations for dense vectors.
- **Where AI needed correction**: Ensuring the vector search works with semantic synonyms (e.g., "Vulpes vulpes" matching "red fox").
- **What was manually customized**: Built a deterministic dual-mode embedding engine that connects to Gemini text embeddings when an API key is present and uses an internal semantic vectorizer for zero-credential offline evaluation.

---

## 5. Phase 5 — The Mismatch Guard & Refusal Explanations
- **Where AI helped**: Formulating clear, diagnostic human-readable rejection messages when candidate images fail the guard.
- **Where AI needed correction**: When no candidates pass, the system must cleanly return `"no confident match"` rather than picking the least-bad candidate.
- **What was manually customized**: Tuned the similarity threshold ($0.60$) and taxonomy checks based on empirical eval set testing.

---

## 6. Phase 6 & 7 — Review Workflow & Evaluation Dataset
- **Where AI helped**: Scaffolding the Human-in-the-Loop review API (`approve`, `reject`, `pending`).
- **Where AI needed correction**: Developing a rigorous labeled evaluation dataset (12 articles with ground truth targets and hard distractors) to measure Top-1 Precision accurately.
- **What was manually customized**: Automated the evaluation benchmark runner (`npm run eval`) that calculates and prints Top-1 Precision.
