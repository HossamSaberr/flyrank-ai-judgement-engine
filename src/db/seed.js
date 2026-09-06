const crypto = require('crypto');
const db = require('./connection');
const { runMigrations } = require('./migrate');
const { runBatchIngestionJob } = require('../services/batchProcessor');
const { generateAndStoreImageEmbeddings, generateAndStorePostEmbedding } = require('../services/embedding.service');

const DEMO_POSTS = [
  {
    id: 'post-red-fox-01',
    title: 'The Secret World of Wild Red Foxes in North America',
    slug: 'secret-world-wild-red-foxes',
    category: 'wildlife',
    expected_subject: 'red fox',
    content: 'An exploration into the behaviors, nocturnal hunting adaptations, and ecological significance of Vulpes vulpes across temperate woodland forests.',
    tags: ['wildlife', 'foxes', 'nature', 'biology']
  },
  {
    id: 'post-gray-wolf-02',
    title: 'Pack Dynamics and Apex Hunting in Gray Wolves',
    slug: 'pack-dynamics-gray-wolves',
    category: 'wildlife',
    expected_subject: 'gray wolf',
    content: 'How Canis lupus wolfpacks maintain territorial communication, coordinate complex hunting strategies, and survive subzero winters in northern wilderness.',
    tags: ['wildlife', 'wolves', 'predators', 'canis-lupus']
  },
  {
    id: 'post-quantum-comp-03',
    title: 'Superconducting Qubits and Cryogenic Quantum Architectures',
    slug: 'superconducting-qubits-quantum-architecture',
    category: 'technology',
    expected_subject: 'quantum computer',
    content: 'Understanding how dilution refrigerators maintain millikelvin temperatures to protect quantum states and coherence across superconducting qubit processors.',
    tags: ['quantum', 'computing', 'technology', 'hardware']
  },
  {
    id: 'post-barista-coffee-04',
    title: 'The Chemistry of Specialty Espresso and Latte Art',
    slug: 'chemistry-specialty-espresso-latte-art',
    category: 'culinary',
    expected_subject: 'artisan coffee',
    content: 'A comprehensive guide to espresso extraction ratios, boiler pressure stability, and creating silky microfoam for pouring latte art.',
    tags: ['coffee', 'espresso', 'culinary', 'food']
  },
  {
    id: 'post-mars-rover-05',
    title: 'Interstellar Deep Space Exploration and Mars Rovers',
    slug: 'interstellar-deep-space-mars-rovers',
    category: 'aerospace',
    expected_subject: 'deep space probe',
    content: 'Telemetry systems, autonomous hazard detection algorithms, and ion propulsion thrusters for robotic probes venturing beyond the solar system.',
    tags: ['space', 'mars', 'astronomy', 'rovers']
  }
];

async function seedDatabase() {
  runMigrations();
  console.log('🌱 [DB Seed] Running batch image ingestion...');
  await runBatchIngestionJob();
  await generateAndStoreImageEmbeddings();

  console.log('🌱 [DB Seed] Seeding demo blog posts...');
  const insertPost = db.prepare(`
    INSERT OR REPLACE INTO posts (id, title, slug, category, expected_subject, content, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const post of DEMO_POSTS) {
    insertPost.run(
      post.id,
      post.title,
      post.slug,
      post.category,
      post.expected_subject,
      post.content,
      JSON.stringify(post.tags)
    );
    await generateAndStorePostEmbedding(post);
    console.log(`   ✓ Seeded post: "${post.title}"`);
  }

  console.log('✨ [DB Seed] Complete! Database is populated and indexed.');
}

if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = {
  seedDatabase,
  DEMO_POSTS
};
