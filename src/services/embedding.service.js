const axios = require('axios');
const crypto = require('crypto');
const db = require('../db/connection');
const { recordAICost } = require('./costTracker');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-004';
const VECTOR_DIMENSIONS = 64;

// Known Semantic Taxonomy Clusters for Concept Mapping
const TAXONOMY_CLUSTERS = [
  // Cluster 0: Red Fox / Vulpes vulpes
  ['fox', 'foxes', 'red fox', 'vulpes', 'vulpes vulpes', 'wild fox', 'orange fur', 'bushy tail', 'canid fox'],
  // Cluster 1: Arctic Fox
  ['arctic fox', 'white fox', 'polar fox', 'tundra fox', 'snow fox'],
  // Cluster 2: Wolf / Canis lupus
  ['wolf', 'wolves', 'gray wolf', 'grey wolf', 'timber wolf', 'canis lupus', 'wolfpack', 'apex predator'],
  // Cluster 3: Domestic Dog / Canis familiaris
  ['dog', 'dogs', 'domestic dog', 'canis familiaris', 'pet', 'german shepherd', 'golden retriever', 'puppy', 'canine pet'],
  // Cluster 4: Bear / Ursus
  ['bear', 'bears', 'grizzly', 'brown bear', 'grizzly bear', 'ursus', 'ursus arctos', 'black bear'],
  // Cluster 5: Deer / Cervidae
  ['deer', 'buck', 'doe', 'whitetail', 'whitetail deer', 'antlers', 'cervidae', 'fawn'],
  // Cluster 6: Eagle / Birds of Prey
  ['eagle', 'bald eagle', 'raptor', 'bird of prey', 'wingspan', 'haliaeetus leucocephalus'],
  // Cluster 7: Landscape / Alpine / Mountains / Lakes
  ['landscape', 'mountain', 'lake', 'alpine', 'rockies', 'evergreen', 'forest', 'wilderness', 'scenic', 'nature'],
  // Cluster 8: Beach / Ocean / Coast
  ['beach', 'tropical', 'ocean', 'sand', 'coast', 'sea', 'palm trees', 'waves', 'shoreline'],
  // Cluster 9: Desert / Dunes
  ['desert', 'sand dunes', 'sahara', 'arid', 'dune', 'dry landscape'],
  // Cluster 10: Glacier / Ice
  ['glacier', 'ice', 'ice cave', 'frozen', 'iceland', 'subzero', 'crystal'],
  // Cluster 11: Quantum Computing
  ['quantum', 'quantum computing', 'qubits', 'cryostat', 'dilution refrigerator', 'superconducting', 'quantum mechanics'],
  // Cluster 12: Semiconductors / Microchips
  ['microchip', 'semiconductor', 'silicon', 'wafer', 'processor', 'integrated circuit', 'nanometer', 'cpu'],
  // Cluster 13: Datacenter & Cloud Servers
  ['datacenter', 'data center', 'server', 'server rack', 'cloud infrastructure', 'enterprise cloud', 'hosting'],
  // Cluster 14: Neural Networks & Artificial Intelligence
  ['ai', 'neural network', 'deep learning', 'machine learning', 'artificial intelligence', 'synapses', 'algorithm'],
  // Cluster 15: Skyscraper & Modern Architecture
  ['skyscraper', 'high-rise', 'modern building', 'glass facade', 'city skyline', 'urban architecture'],
  // Cluster 16: Ancient Roman Architecture
  ['colosseum', 'roman', 'ancient rome', 'amphitheatre', 'flavian', 'historical monument', 'antiquity'],
  // Cluster 17: Rustic Wooden Cabin
  ['cabin', 'wooden cabin', 'log cabin', 'timber', 'rustic retreat', 'woodland shelter'],
  // Cluster 18: Artisan Coffee & Espresso
  ['coffee', 'espresso', 'latte', 'latte art', 'barista', 'cafe', 'rosetta', 'cappuccino'],
  // Cluster 19: Pizza & Italian Gastronomy
  ['pizza', 'neapolitan pizza', 'woodfired', 'margherita', 'mozzarella', 'italian food'],
  // Cluster 20: Ramen & Japanese Cuisine
  ['ramen', 'japanese ramen', 'tonkotsu', 'noodles', 'broth', 'chashu', 'japanese cuisine']
];

/**
 * Computes a normalized dense semantic vector representation for arbitrary text
 * @param {string} text
 * @returns {Promise<number[]>} Array of 64 normalized floats
 */
async function generateEmbedding(text) {
  const startTime = Date.now();
  const cleanText = (text || '').toLowerCase().trim();

  // 1. If Gemini API Key is present, try live Gemini Embedding
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
      const res = await axios.post(
        endpoint,
        {
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: cleanText }] }
        },
        { timeout: 5000 }
      );

      const rawValues = res.data?.embedding?.values || [];
      if (rawValues.length > 0) {
        // Sample or truncate to VECTOR_DIMENSIONS
        const vector = rawValues.slice(0, VECTOR_DIMENSIONS);
        const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
        const normalized = vector.map((v) => v / norm);

        recordAICost({
          operation: 'embedding_generation',
          model_name: EMBEDDING_MODEL,
          input_tokens: Math.ceil(cleanText.length / 4),
          latency_ms: Date.now() - startTime,
          caller: 'gemini_embedding_service'
        });

        return normalized;
      }
    } catch (apiErr) {
      console.warn(`⚠️ [Embedding API] Gemini call failed (${apiErr.message}). Using local semantic vectorizer.`);
    }
  }

  // 2. Local Deterministic Semantic Vectorizer
  const vector = new Array(VECTOR_DIMENSIONS).fill(0.01);

  // Map cluster activations based on semantic phrase matches
  TAXONOMY_CLUSTERS.forEach((cluster, clusterIdx) => {
    let matchScore = 0;
    for (const term of cluster) {
      if (cleanText.includes(term)) {
        matchScore += term.includes(' ') ? 1.5 : 1.0;
      }
    }
    if (matchScore > 0) {
      const dim = clusterIdx % VECTOR_DIMENSIONS;
      vector[dim] += matchScore * 0.8;

      // Spread semantic influence to adjacent related dimensions
      vector[(dim + 1) % VECTOR_DIMENSIONS] += matchScore * 0.3;
      vector[(dim + 2) % VECTOR_DIMENSIONS] += matchScore * 0.15;
    }
  });

  // Add deterministic word hash features for remaining dimensions
  const words = cleanText.split(/\W+/).filter(Boolean);
  words.forEach((word) => {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % VECTOR_DIMENSIONS;
    vector[idx] += 0.05;
  });

  // L2 Normalize the vector to unit length
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  const normalized = vector.map((v) => parseFloat((v / norm).toFixed(6)));

  recordAICost({
    operation: 'embedding_generation',
    model_name: 'local-semantic-embeddings',
    input_tokens: Math.ceil(cleanText.length / 4),
    latency_ms: Date.now() - startTime,
    caller: 'local_vectorizer'
  });

  return normalized;
}

/**
 * Computes Cosine Similarity between two dense vectors
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Score between -1.0 and 1.0
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0.0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0.0;
  return parseFloat((dotProduct / denominator).toFixed(4));
}

/**
 * Generates and stores vector embeddings for all images in the database
 */
async function generateAndStoreImageEmbeddings() {
  const images = db.prepare(`
    SELECT i.id, i.filename, m.subject, m.category, m.attributes, m.caption, m.status
    FROM images i
    JOIN image_metadata m ON i.id = m.image_id
  `).all();

  console.log(`🧠 [Embedding Engine] Generating dense vectors for ${images.length} images...`);

  const insertEmbedding = db.prepare(`
    INSERT OR REPLACE INTO embeddings (id, entity_type, entity_id, vector, dimensions, model_name)
    VALUES (?, 'image', ?, ?, ?, ?)
  `);

  for (const img of images) {
    const textToEmbed = `${img.subject}. ${img.category}. ${img.caption}. Attributes: ${img.attributes}`;
    const vector = await generateEmbedding(textToEmbed);
    const embId = 'emb-img-' + img.id;
    insertEmbedding.run(embId, img.id, JSON.stringify(vector), VECTOR_DIMENSIONS, EMBEDDING_MODEL);
  }

  console.log(`✅ [Embedding Engine] Successfully indexed all image vectors.`);
}

/**
 * Generates and stores vector embedding for a single blog post
 * @param {object} post
 * @returns {Promise<number[]>}
 */
async function generateAndStorePostEmbedding(post) {
  const textToEmbed = `${post.title}. Subject: ${post.expected_subject}. Category: ${post.category}. ${post.content}`;
  const vector = await generateEmbedding(textToEmbed);

  const insertEmbedding = db.prepare(`
    INSERT OR REPLACE INTO embeddings (id, entity_type, entity_id, vector, dimensions, model_name)
    VALUES (?, 'post', ?, ?, ?, ?)
  `);

  const embId = 'emb-post-' + post.id;
  insertEmbedding.run(embId, post.id, JSON.stringify(vector), VECTOR_DIMENSIONS, EMBEDDING_MODEL);

  return vector;
}

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  generateAndStoreImageEmbeddings,
  generateAndStorePostEmbedding,
  VECTOR_DIMENSIONS
};
