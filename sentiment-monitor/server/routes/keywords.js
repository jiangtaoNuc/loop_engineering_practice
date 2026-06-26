'use strict';

const express = require('express');
const router = express.Router();

// In-memory keyword store
let keywords = [
  { id: '1', name: '星巴克', created_at: new Date().toISOString() },
  { id: '2', name: '蔚来', created_at: new Date().toISOString() },
  { id: '3', name: '咖啡', created_at: new Date().toISOString() },
];
let nextId = 4;

// GET /api/keywords
router.get('/', (req, res) => {
  res.json({ data: keywords, total: keywords.length });
});

// POST /api/keywords
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const trimmed = name.trim();
  if (keywords.some(k => k.name === trimmed)) {
    return res.status(409).json({ error: 'keyword already exists' });
  }
  const kw = { id: String(nextId++), name: trimmed, created_at: new Date().toISOString() };
  keywords.push(kw);
  res.status(201).json(kw);
});

// DELETE /api/keywords/:id
router.delete('/:id', (req, res) => {
  const idx = keywords.findIndex(k => k.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'keyword not found' });
  }
  keywords.splice(idx, 1);
  res.json({ success: true });
});

module.exports = router;
