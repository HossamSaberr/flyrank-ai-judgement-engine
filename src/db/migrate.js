const fs = require('fs');
const path = require('path');
const db = require('./connection');

function runMigrations() {
  const schemaSql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
  db.exec(schemaSql);

  // Check if ai_cost_logs needs check constraint update for ai_judgement
  try {
    const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ai_cost_logs'").get();
    if (tableSql && tableSql.sql && !tableSql.sql.includes('ai_judgement')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_cost_logs_new (
          id TEXT PRIMARY KEY,
          operation TEXT NOT NULL CHECK (operation IN ('vision_tagging', 'embedding_generation', 'batch_ingest', 'ai_judgement')),
          model_name TEXT NOT NULL,
          input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0,
          cost_usd REAL DEFAULT 0.0,
          latency_ms INTEGER DEFAULT 0,
          caller TEXT DEFAULT 'system',
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO ai_cost_logs_new SELECT * FROM ai_cost_logs;
        DROP TABLE ai_cost_logs;
        ALTER TABLE ai_cost_logs_new RENAME TO ai_cost_logs;
      `);
    }
  } catch (e) {
    // Ignore migration error if already up to date
  }

  console.log('✅ [DB Migration] AI Matching Engine schema migrated successfully.');
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
