-- ============================================================================
-- FlyRank AI Image Understanding & Content Matching Engine Schema
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. Images Corpus Table
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  mime_type TEXT DEFAULT 'image/jpeg',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Structured Image Metadata (Produced by Vision Model)
CREATE TABLE IF NOT EXISTS image_metadata (
  id TEXT PRIMARY KEY,
  image_id TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL,
  attributes TEXT NOT NULL DEFAULT '[]', -- JSON array of visual features
  caption TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'flagged_low_confidence')),
  raw_vision_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- 3. Articles / Blog Posts Table
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  expected_subject TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Dense Vector Embeddings Table
CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('image', 'post')),
  entity_id TEXT NOT NULL,
  vector TEXT NOT NULL, -- JSON array of floats
  dimensions INTEGER NOT NULL,
  model_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id)
);

-- 5. Match Recommendations & Guard Decisions
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  similarity_score REAL NOT NULL,
  guard_status TEXT NOT NULL CHECK (guard_status IN ('passed', 'rejected')),
  guard_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- 6. Human-in-the-Loop Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reviewer_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
);

-- 7. AI Cost Accounting Log Table
CREATE TABLE IF NOT EXISTS ai_cost_logs (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('vision_tagging', 'embedding_generation', 'batch_ingest')),
  model_name TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0.0,
  latency_ms INTEGER DEFAULT 0,
  caller TEXT DEFAULT 'system',
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Retrieval & Isolation
CREATE INDEX IF NOT EXISTS idx_img_meta_image ON image_metadata(image_id);
CREATE INDEX IF NOT EXISTS idx_img_meta_subject ON image_metadata(subject);
CREATE INDEX IF NOT EXISTS idx_embeddings_lookup ON embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_matches_post ON matches(post_id);
CREATE INDEX IF NOT EXISTS idx_reviews_post ON reviews(post_id);
CREATE INDEX IF NOT EXISTS idx_cost_created ON ai_cost_logs(created_at);
