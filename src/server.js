require('dotenv').config();
const app = require('./app');
const { seedDatabase } = require('./db/seed');

const PORT = process.env.PORT || 3000;

// Ensure database is seeded on startup
seedDatabase().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`🦊 FlyRank AI Image Understanding Engine is LIVE`);
    console.log(`📡 API Server:         http://localhost:${PORT}`);
    console.log(`🖼️ Images Endpoint:    http://localhost:${PORT}/api/v1/images`);
    console.log(`📝 Posts Endpoint:     http://localhost:${PORT}/api/v1/posts`);
    console.log(`📊 Benchmark Eval:     http://localhost:${PORT}/api/v1/eval/benchmark`);
    console.log(`💰 Costs Summary:      http://localhost:${PORT}/api/v1/costs/summary`);
    console.log(`🩺 Health Check:       http://localhost:${PORT}/health`);
    console.log(`========================================================\n`);
  });
});

module.exports = app;
