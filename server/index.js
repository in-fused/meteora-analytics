import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { fetchMeteoraPools, scorePool } from './analytics/meteora.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/**
 * ✅ REQUIRED FOR FLY.IO
 * Fly injects PORT — we MUST use it
 */
const PORT = process.env.PORT;

/**
 * ✅ Serve frontend
 */
app.use(express.static('public'));

/**
 * Health / root check
 */
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'meteora-analytics-backend',
    uptime: process.uptime()
  });
});

/**
 * Free health endpoint
 */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * Meteora analytics
 * PREVIEW_MODE=true disables payment enforcement
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
 * Start server
 */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
