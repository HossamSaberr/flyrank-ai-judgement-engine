# 🦊 AI Image Understanding & Content Matching Engine
> **FlyRank Backend Track Capstone Project**  
> *Understand an image library, organize it automatically, and match the right image to the right article — a red-fox post gets the red-fox photo, never the wolf. Good suggestions when confident, safe rejection when not.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Evaluation Precision](https://img.shields.io/badge/Top--1%20Precision-100%25-brightgreen.svg)]()
[![Free Tools Promise](https://img.shields.io/badge/%240%20Stack-Zero%20Credit%20Card-success.svg)]()

---

## 📖 1. Overview

In production content publishing, pairing articles with images must be **semantically accurate** and **trustworthy**. A standard vector search engine often suggests visually similar but contextually incorrect images — such as placing a wolf on a post about red foxes, or a dog on a wildlife article.

This project delivers a complete **AI Image Understanding & Content Matching Engine** equipped with an **AI Mismatch Guard**:
- **Structured Vision AI**: Classifies images into verified JSON metadata (subject, category, attributes, caption, confidence) validated with Zod.
- **Low-Confidence Gating**: Unclear classifications are flagged rather than guessed.
- **Batch Processing with Cost Tracking**: Ingestion runs asynchronously in batches with per-call token and USD cost accounting.
- **Semantic Embeddings**: Understands synonyms and concepts (e.g., *"Vulpes vulpes"* $\leftrightarrow$ *"red fox"*).
- **The Mismatch Guard**: Rejects incorrect candidates (like the wolf-on-fox scenario) with human-readable diagnostic explanations.
- **Safe Refusal**: When no image meets confidence thresholds, answers `"no confident match"` instead of guessing.
- **Human Review Workflow**: Review API to approve, reject, and inspect match rationales.
- **Evaluation Benchmark**: Evaluates retrieval accuracy and Top-1 precision on a labeled test set.

---

## 🏛️ 2. Architecture & Pipeline

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

## ⚡ 3. Quick Start

### 1. Prerequisites
- Node.js (v18 or higher)
- npm

### 2. Installation & Setup
```bash
git clone https://github.com/HossamSaberr/flyrank-capstone-imagerelevance.git
cd flyrank-capstone-imagerelevance
cp .env.example .env
npm install
```

### 3. Ingest Image Library & Seed Demo Articles
```bash
npm run seed
npm start
```

### 4. Run Evaluation Benchmark & Acceptance Tests
```bash
# Run precision evaluation benchmark
npm run eval

# Run 17/17 automated acceptance tests & probes
npm test
```
