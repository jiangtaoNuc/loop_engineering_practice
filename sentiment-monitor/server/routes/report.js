'use strict';

const express = require('express');
const dayjs = require('dayjs');
const router = express.Router();
const { getMentions } = require('../mock/seed');

const SENTIMENT_LABEL = { positive: '正面', negative: '负面', neutral: '中性' };
const SENTIMENT_COLOR = { positive: '#52c41a', negative: '#ff4d4f', neutral: '#1677ff' };

// GET /api/report/export
router.get('/export', (req, res) => {
  const { keyword = '', from, to, format = 'html' } = req.query;

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

  const total = data.length;
  const sentimentDist = { positive: 0, negative: 0, neutral: 0 };
  const channelDist = {};
  for (const m of data) {
    sentimentDist[m.sentiment]++;
    channelDist[m.channel] = (channelDist[m.channel] || 0) + 1;
  }

  const sorted = data.slice().sort((a, b) => dayjs(b.posted_at).valueOf() - dayjs(a.posted_at).valueOf());
  const preview = sorted.slice(0, 20);

  const sentimentRows = Object.entries(sentimentDist)
    .map(([s, c]) => `<tr><td>${SENTIMENT_LABEL[s]}</td><td>${c}</td><td>${total ? ((c / total) * 100).toFixed(1) : 0}%</td></tr>`)
    .join('');

  const channelRows = Object.entries(channelDist)
    .sort((a, b) => b[1] - a[1])
    .map(([ch, c]) => `<tr><td>${ch}</td><td>${c}</td><td>${total ? ((c / total) * 100).toFixed(1) : 0}%</td></tr>`)
    .join('');

  const mentionRows = preview.map(m => `
    <tr>
      <td>${m.channel}</td>
      <td>${m.author}</td>
      <td>${dayjs(m.posted_at).format('YYYY-MM-DD HH:mm')}</td>
      <td style="max-width:400px">${m.content}</td>
      <td style="color:${SENTIMENT_COLOR[m.sentiment]}">${SENTIMENT_LABEL[m.sentiment]}</td>
    </tr>`).join('');

  const fromLabel = from ? dayjs(from).format('YYYY-MM-DD') : '不限';
  const toLabel = to ? dayjs(to).format('YYYY-MM-DD') : '不限';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>舆情监控报告 — ${keyword || '全部关键词'}</title>
  <style>
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; margin: 40px; color: #222; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #1677ff; padding-bottom: 8px; }
    h2 { color: #1677ff; margin-top: 32px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 14px; }
    th { background: #1677ff; color: #fff; padding: 8px 12px; text-align: left; }
    td { border: 1px solid #e8e8e8; padding: 7px 12px; }
    tr:nth-child(even) td { background: #f5f7fa; }
    .meta { color: #888; font-size: 14px; margin-bottom: 24px; }
    .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:12px; }
  </style>
</head>
<body>
  <h1>品牌舆情监控报告</h1>
  <p class="meta">
    关键词：<strong>${keyword || '全部'}</strong> &nbsp;|&nbsp;
    时间范围：<strong>${fromLabel}</strong> 至 <strong>${toLabel}</strong> &nbsp;|&nbsp;
    共 <strong>${total}</strong> 条记录 &nbsp;|&nbsp;
    生成时间：${dayjs().format('YYYY-MM-DD HH:mm:ss')}
  </p>

  <h2>情感分布</h2>
  <table>
    <tr><th>情感</th><th>数量</th><th>占比</th></tr>
    ${sentimentRows}
  </table>

  <h2>渠道分布</h2>
  <table>
    <tr><th>渠道</th><th>数量</th><th>占比</th></tr>
    ${channelRows}
  </table>

  <h2>近期声音（前 20 条）</h2>
  <table>
    <tr><th>渠道</th><th>作者</th><th>时间</th><th>内容</th><th>情感</th></tr>
    ${mentionRows}
  </table>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="sentiment-report-${dayjs().format('YYYYMMDD')}.html"`);
  res.send(html);
});

module.exports = router;
