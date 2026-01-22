import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { fetchMeteoraPools, scorePool } from './analytics/meteora.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Serve frontend (public/index.html)
 */
app.use(express.static(path.join(__dirname, '../public')));

/**
 * Root
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/**
 * Health check
 */
app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

/**
 * Meteora analytics (FREE / preview)
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
 * REQUIRED FOR FLY
 */
const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on 0.0.0.0:${PORT}`);
});

