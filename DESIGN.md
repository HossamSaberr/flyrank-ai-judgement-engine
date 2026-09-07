# 🏛️ Architecture & System Design Document
## AI Image Understanding & Content Matching Engine (`flyrank-capstone-imagerelevance`)

---

## 1. Executive Summary & Problem Statement

Digital publishers and SEO content systems need to automatically pair high-quality images with published blog articles based on semantic intent rather than superficial keyword matching. However, standard vector search alone frequently produces embarrassing hallucinations or category mismatches:
- An article on *Red Foxes in North America* might retrieve a visually similar *Gray Wolf* or a *German Shepherd*.
- An article on *Quantum Computing* might match an image of a *Coffee Machine* because both mentions "cooling systems".
- When an image library contains **no suitable image**, standard recommendation engines guess blindly instead of safely declining.

This platform implements an **AI Image Understanding & Content Matching Engine** featuring an **AI Mismatch Guard**. The engine analyzes an image corpus through structured vision models, generates semantic dense vector embeddings, ranks candidates via cosine similarity, and applies a multi-layered safety guard that refuses inappropriate or low-confidence matches with clear human-readable explanations.

---

## 2. Core Request Flow & Pipeline Architecture

```
+========================================================================================================+
|                                    AI IMAGE MATCHING PIPELINE                                          |
+========================================================================================================+

                               [ 1. ASYNCHRONOUS INGESTION BATCH JOB ]
                               
       Raw Images Corpus -----> [ Vision Model (Gemini / Local) ]
                                            |
                                            v (Zod Schema Validation)
                                { subject, category, attributes, caption, confidence }
                                            |
                                            +---> Low confidence (<0.70)? --> Flag for review
                                            |
                                            v (High confidence)
                                [ Embedding Generator ] -----> Stored in SQLite Vector Store
                                            |
                                            v
                                  [ Cost Tracker ] -----> Recorded in ai_cost_logs

----------------------------------------------------------------------------------------------------------

                               [ 2. REAL-TIME MATCHING & MISMATCH GUARD ]

     Blog Post Input ---------> [ Generate Post Embedding ]
                                            |
                                            v
                                [ Cosine Similarity Ranking ]
                                            |
                                            v (Top Candidates)
                                +-----------------------------------+
                                |        THE MISMATCH GUARD         |
                                | 1. Similarity Score >= Threshold  |
                                | 2. Category & Subject Compatibility|
                                | 3. Vision Confidence Check        |
                                +-----------------------------------+
                                   /                             \
                       [ All Checks Pass ]            [ Any Check Fails ]
                                |                                  |
                                v                                  v
                    Suggested Image (Ranked)             REFUSED ("No confident match")
                    with match explanation               with human-readable diagnostic

----------------------------------------------------------------------------------------------------------

                               [ 3. HUMAN-IN-THE-LOOP REVIEW WORKFLOW ]

                    Reviewer Dashboard ---> Inspect Guard Decisions ---> Approve / Reject
```

---

## 3. Data Model & Database Schema

The database is built on relational SQLite with typed JSON columns, strict foreign keys, and indexes on entity lookups and similarity queries.

```
+---------------------+           +---------------------+           +---------------------+
|       images        | 1       1 |   image_metadata    | 1       1 |     embeddings      |
+---------------------+-----------+---------------------+-----------+---------------------+
| id (PK, TEXT)       |           | id (PK, TEXT)       |           | id (PK, TEXT)       |
| filename            |           | image_id (FK)       |           | entity_type (image/ |
| url                 |           | subject             |           |              post)  |
| width, height       |           | category            |           | entity_id (FK)      |
| mime_type           |           | attributes (JSON)   |           | vector (JSON array) |
| created_at          |           | caption             |           | dimensions          |
+---------------------+           | confidence (REAL)   |           | model_name          |
                                  | status (accepted/   |           | created_at          |
                                  |         flagged)    |           +---------------------+
                                  | created_at          |
                                  +---------------------+

+---------------------+           +---------------------+           +---------------------+
|        posts        | 1       N |       matches       | 1       N |    ai_cost_logs     |
+---------------------+-----------+---------------------+-----------+---------------------+
| id (PK, TEXT)       |           | id (PK, TEXT)       |           | id (PK, TEXT)       |
| title               |           | post_id (FK)        |           | operation           |
| slug (UNIQUE)       |           | image_id (FK)       |           | model_name          |
| category            |           | similarity_score    |           | input_tokens        |
| expected_subject    |           | guard_status        |           | output_tokens       |
| content             |           | guard_reason        |           | cost_usd            |
| tags (JSON)         |           | created_at          |           | latency_ms          |
| created_at          |           +---------------------+           | created_at          |
+---------------------+                                             +---------------------+
```

---

## 4. The Mismatch Guard Decision Logic

When a post requests image recommendations (`GET /api/v1/posts/:id/matches`), candidates are evaluated through three sequential gates:

1. **Threshold Gate**: Cosine similarity $s = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|}$ must be $\ge 0.60$. If the top candidate scores $< 0.60$, the system returns `status: "no_match"` with reason `"Low semantic similarity score (${s.toFixed(2)} < 0.60)"`.
2. **Taxonomy & Category Gate**: The detected image `category` and `subject` are compared against the post's context. If the post is about a *Red Fox* and the candidate image is a *Wolf*, the guard immediately rejects the candidate with reason: `"Taxonomy conflict: post expects 'fox', candidate image is 'wolf'"`.
3. **Vision Confidence Gate**: The image must have vision classification `confidence >= 0.70`. Flagged images are excluded or escalated for manual human review.

---

## 5. API Contracts

### A. Posts & Image Ingestion
- `POST /api/v1/images/batch-ingest` — Triggers background vision tagging & embedding generation (`202 Accepted`).
- `GET /api/v1/images` — List all ingested images with metadata, tags, and confidence scores (`200 OK`).
- `GET /api/v1/posts` — List all articles / blog posts (`200 OK`).
- `POST /api/v1/posts` — Create a new blog post (`201 Created`).

### B. Matching & Mismatch Guard
- `GET /api/v1/posts/:id/matches` — Evaluates image library, runs mismatch guard, and returns ranked suggestions or safe refusal (`200 OK`).
- `POST /api/v1/match/evaluate` — Evaluates arbitrary post text against the image library on the fly (`200 OK`).

### C. Human Review & Quality Eval
- `POST /api/v1/reviews/approve` — Approves a suggested image pairing (`200 OK`).
- `POST /api/v1/reviews/reject` — Rejects pairing with human reviewer notes (`200 OK`).
- `GET /api/v1/reviews/pending` — Lists pairings awaiting review (`200 OK`).
- `GET /api/v1/eval/benchmark` — Executes benchmark over labeled evaluation set and returns precision metrics (`200 OK`).
- `GET /api/v1/costs/summary` — Returns total cost breakdown across vision and embedding models (`200 OK`).

### D. Asynchronous PDF Report Generation & Scheduling
- `POST /api/v1/reports/generate` — Enqueues background report generation job (`202 Accepted`).
- `GET /api/v1/reports/jobs/:id` — Polls background job status, progress %, and completion metadata (`200 OK`).
- `GET /api/v1/reports/download/:id` — Streams generated PDF report artifact (`200 OK`).
- `GET /api/v1/reports` — Lists historical generated report jobs (`200 OK`).
- `DELETE /api/v1/reports/:id` — Deletes report record and cleans disk artifact (`200 OK`).
- `POST /api/v1/reports/schedules` — Creates recurring report generation schedule (`201 Created`).
- `GET /api/v1/reports/schedules` — Lists active report generation schedules (`200 OK`).
- `POST /api/v1/reports/schedules/:id/run` — Manually triggers a scheduled report immediately (`202 Accepted`).

---

## 6. Explicit Non-Goals

1. **No External Vector Database Dependency**: Embeddings and similarity search run efficiently directly in SQLite and Node.js without requiring Pinecone, Weaviate, or Qdrant cloud accounts.
2. **No Image Manipulation or Generation**: The system specializes in understanding and matching existing images; image editing, resizing, or generative diffusion is outside the core scope.
3. **Zero Credit Card Guarantee**: Operates completely within free tiers (Gemini Flash free API key or built-in local vector embeddings).
