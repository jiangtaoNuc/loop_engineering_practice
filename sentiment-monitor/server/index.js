'use strict';

const express = require('express');
const cors = require('cors');

const keywordsRouter = require('./routes/keywords');
const mentionsRouter = require('./routes/mentions');
const insightsRouter = require('./routes/insights');
const reportRouter = require('./routes/report');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/keywords', keywordsRouter);
app.use('/api/mentions', mentionsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/report', reportRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Sentiment Monitor Server running on http://localhost:${PORT}`);
});
