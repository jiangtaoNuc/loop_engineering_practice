'use strict';

const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { getMentions } = require('../mock/seed');

// GET /api/mentions
router.get('/', (req, res) => {
  const { keyword, channel, from, to, sentiment, page = '1', page_size = '20' } = req.query;

  let data = getMentions();

  if (keyword) {
    const kws = keyword.split(',').map(s => s.trim()).filter(Boolean);
    data = data.filter(m => kws.some(kw => m.keywords.includes(kw) || m.content.includes(kw)));
  }

  if (channel) {
    data = data.filter(m => m.channel === channel);
  }

  if (from) {
    const fromTs = dayjs(from).valueOf();
    data = data.filter(m => dayjs(m.posted_at).valueOf() >= fromTs);
  }

  if (to) {
    const toTs = dayjs(to).valueOf();
    data = data.filter(m => dayjs(m.posted_at).valueOf() <= toTs);
  }

  if (sentiment) {
    data = data.filter(m => m.sentiment === sentiment);
  }

  // Sort by posted_at desc
  data = data.slice().sort((a, b) => dayjs(b.posted_at).valueOf() - dayjs(a.posted_at).valueOf());

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(page_size, 10) || 20));
  const total = data.length;
  const start = (pageNum - 1) * pageSize;
  const items = data.slice(start, start + pageSize);

  res.json({
    data: items,
    pagination: {
      page: pageNum,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  });
});

module.exports = router;
