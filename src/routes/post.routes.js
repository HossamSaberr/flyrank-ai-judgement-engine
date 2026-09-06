const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db/connection');
const { matchImagesForPost } = require('../services/matchingEngine');
const { generateAndStorePostEmbedding } = require('../services/embedding.service');

const router = express.Router();

const CreatePostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  category: z.string().min(2, 'Category is required'),
  expected_subject: z.string().min(2, 'Expected subject is required'),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  tags: z.array(z.string()).optional().default([])
});

/**
 * GET /api/v1/posts (List all posts)
 */
router.get('/', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  const formatted = posts.map((p) => ({
    ...p,
    tags: JSON.parse(p.tags)
  }));
  return res.status(200).json({ posts: formatted });
});

/**
 * POST /api/v1/posts (Create new post)
 */
router.post('/', async (req, res) => {
  const parseResult = CreatePostSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    });
  }

  const { title, category, expected_subject, content, tags } = parseResult.data;
  const id = 'post-' + crypto.randomUUID();
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + id.slice(-6);

  const insert = db.prepare(`
    INSERT INTO posts (id, title, slug, category, expected_subject, content, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(id, title, slug, category, expected_subject, content, JSON.stringify(tags));

  const createdPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);

  // Generate and store embedding for the new post
  await generateAndStorePostEmbedding(createdPost);

  return res.status(201).json({
    message: 'Post created and indexed successfully',
    post: {
      ...createdPost,
      tags: JSON.parse(createdPost.tags)
    }
  });
});

/**
 * GET /api/v1/posts/:id (Get single post)
 */
router.get('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  return res.status(200).json({
    post: {
      ...post,
      tags: JSON.parse(post.tags)
    }
  });
});

/**
 * GET /api/v1/posts/:id/matches (Get ranked images & Mismatch Guard decisions)
 */
router.get('/:id/matches', async (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? OR slug = ?').get(req.params.id, req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const result = await matchImagesForPost(post);
  return res.status(200).json(result);
});

module.exports = router;
