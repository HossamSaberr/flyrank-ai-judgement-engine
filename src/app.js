const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const morgan = require('morgan');

const imageRoutes = require('./routes/image.routes');
const postRoutes = require('./routes/post.routes');
const reviewRoutes = require('./routes/review.routes');
const costRoutes = require('./routes/cost.routes');
const judgementRoutes = require('./routes/judgement.routes');
const reportRoutes = require('./routes/report.routes');
const { runEvaluationBenchmark } = require('./eval');
const db = require('./db/connection');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, '../public')));

// Health Check
app.get('/health', (req, res) => {
  try {
    const dbCheck = db.prepare('SELECT 1 as alive').get();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbCheck.alive === 1 ? 'connected' : 'disconnected'
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Benchmark Endpoint
app.get('/api/v1/eval/benchmark', async (req, res) => {
  try {
    const results = await runEvaluationBenchmark();
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Routes
app.use('/api/v1/images', imageRoutes);
app.use('/api/v1/posts', postRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/costs', costRoutes);
app.use('/api/v1/judge', judgementRoutes);
app.use('/api/v1/match/evaluate', judgementRoutes);
app.use('/api/v1/reports', reportRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

module.exports = app;
