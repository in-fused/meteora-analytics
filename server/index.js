import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { fetchMeteoraPools, scorePool } from './analytics/meteora.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Health + root
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'meteora-analytics-backend',
    uptime: process.uptime()
  });
});

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

/**
 * FREE: Meteora analytics (no payment, preview mode)
 */
app.get('/api/v1/meteora/analytics', async (req, res) => {
  try {
    const pools = await fetchMeteoraPools();
    const scored = pools.map(scorePool);

    res.json({
      success: true,
      count: scored.length,
      data: scored
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PORT — Fly.io REQUIRED
 */
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`✅ Meteora backend running on port ${PORT}`);
});
