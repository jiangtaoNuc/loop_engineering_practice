'use strict';

const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { getMentions, CHANNELS } = require('../mock/seed');

function filterMentions(keyword, from, to) {
  let data = getMentions();

  if (keyword) {
    const kws = keyword.split(',').map(s => s.trim()).filter(Boolean);
    data = data.filter(m => kws.some(kw => m.keywords.includes(kw) || m.content.includes(kw)));
  }

  if (from) {
    const fromTs = dayjs(from).valueOf();
    data = data.filter(m => dayjs(m.posted_at).valueOf() >= fromTs);
  }

  if (to) {
    const toTs = dayjs(to).valueOf();
    data = data.filter(m => dayjs(m.posted_at).valueOf() <= toTs);
  }

  return data;
}

// GET /api/insights/summary
router.get('/summary', (req, res) => {
  const { keyword, from, to } = req.query;
  const data = filterMentions(keyword, from, to);

  // Sentiment distribution
  const sentimentDist = { positive: 0, negative: 0, neutral: 0 };
  for (const m of data) {
    sentimentDist[m.sentiment] = (sentimentDist[m.sentiment] || 0) + 1;
  }

  // Channel distribution
  const channelDist = {};
  for (const m of data) {
    channelDist[m.channel] = (channelDist[m.channel] || 0) + 1;
  }

  // Top keywords
  const kwCount = {};
  for (const m of data) {
    for (const kw of m.keywords) {
      kwCount[kw] = (kwCount[kw] || 0) + 1;
    }
  }
  const topKeywords = Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  // Time trend (last 30 days, grouped by day)
  const trend = {};
  const today = dayjs().startOf('day');
  for (let i = 29; i >= 0; i--) {
    const dateKey = today.subtract(i, 'day').format('YYYY-MM-DD');
    trend[dateKey] = { date: dateKey, positive: 0, negative: 0, neutral: 0, total: 0 };
  }
  for (const m of data) {
    const dateKey = dayjs(m.posted_at).format('YYYY-MM-DD');
    if (trend[dateKey]) {
      trend[dateKey][m.sentiment]++;
      trend[dateKey].total++;
    }
  }

  res.json({
    total: data.length,
    sentiment_distribution: sentimentDist,
    channel_distribution: channelDist,
    top_keywords: topKeywords,
    time_trend: Object.values(trend),
  });
});

// GET /api/insights/wordcloud
router.get('/wordcloud', (req, res) => {
  const { keyword, from, to } = req.query;
  const data = filterMentions(keyword, from, to);

  const wordMap = {};
  for (const m of data) {
    for (const kw of m.keywords) {
      if (!wordMap[kw]) {
        wordMap[kw] = { word: kw, weight: 0, sentiments: { positive: 0, negative: 0, neutral: 0 } };
      }
      wordMap[kw].weight++;
      wordMap[kw].sentiments[m.sentiment]++;
    }
  }

  const result = Object.values(wordMap).map(w => {
    const { positive, negative, neutral } = w.sentiments;
    const dominant = positive >= negative && positive >= neutral ? 'positive'
      : negative >= positive && negative >= neutral ? 'negative' : 'neutral';
    return { word: w.word, weight: w.weight, sentiment: dominant };
  }).sort((a, b) => b.weight - a.weight);

  res.json({ data: result });
});

module.exports = router;
