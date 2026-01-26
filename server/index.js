// server/index.js
// Lightweight server - serves frontend + simple caching proxy
// Optimized for low-memory environments (256MB)

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLE IN-MEMORY CACHE (Low memory footprint)
// ═══════════════════════════════════════════════════════════════════════════
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  // Limit cache size to prevent memory issues
  if (cache.size > 10) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    cacheSize: cache.size
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CACHING PROXY FOR METEORA APIs
// Reduces redundant fetches when multiple users load the page
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/proxy/dlmm', async (req, res) => {
  try {
    const cached = getCached('dlmm');
    if (cached) {
      return res.json(cached);
    }

    const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
    if (!response.ok) throw new Error(`DLMM API returned ${response.status}`);

    const data = await response.json();
    setCache('dlmm', data);
    res.json(data);
  } catch (err) {
    console.error('[Proxy] DLMM error:', err.message);
    res.status(502).json({ error: 'Failed to fetch DLMM data' });
  }
});

app.get('/api/proxy/damm', async (req, res) => {
  try {
    const cached = getCached('damm');
    if (cached) {
      return res.json(cached);
    }

    const response = await fetch('https://dammv2-api.meteora.ag/pools?limit=200&order_by=tvl&order=desc');
    if (!response.ok) throw new Error(`DAMM API returned ${response.status}`);

    const data = await response.json();
    setCache('damm', data);
    res.json(data);
  } catch (err) {
    console.error('[Proxy] DAMM error:', err.message);
    res.status(502).json({ error: 'Failed to fetch DAMM data' });
  }
});

app.get('/api/proxy/jupiter-tokens', async (req, res) => {
  try {
    const cached = getCached('jupiter');
    if (cached) {
      return res.json(cached);
    }

    const response = await fetch('https://api.jup.ag/tokens/v2/tag?query=verified');
    if (!response.ok) throw new Error(`Jupiter API returned ${response.status}`);

    const data = await response.json();
    setCache('jupiter', data);
    res.json(data);
  } catch (err) {
    console.error('[Proxy] Jupiter error:', err.message);
    res.status(502).json({ error: 'Failed to fetch Jupiter tokens' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY API (for compatibility)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/v1/meteora/analytics', async (req, res) => {
  try {
    const cached = getCached('analytics');
    if (cached) {
      return res.json(cached);
    }

    const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const pools = await response.json();

    // Simple scoring
    const scored = pools
      .filter(p => p.name && p.address && !p.hide && parseFloat(p.liquidity || 0) > 10000)
      .map(p => {
        const tvl = parseFloat(p.liquidity) || 0;
        const volume = parseFloat(p.trade_volume_24h) || 0;
        const fees = parseFloat(p.fees_24h) || 0;
        const apr = parseFloat(p.apr) || 0;

        let score = 50;
        if (tvl > 500000) score += 20;
        else if (tvl > 100000) score += 15;
        else if (tvl > 10000) score += 10;

        if (volume > 100000) score += 15;
        else if (volume > 10000) score += 10;

        if (apr > 100) score += 10;
        else if (apr > 50) score += 7;

        return {
          address: p.address,
          name: p.name,
          protocol: 'Meteora DLMM',
          tvl,
          volume24h: volume,
          fees24h: fees,
          apr,
          score: Math.min(99, Math.round(score))
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 200);

    const result = { success: true, count: scored.length, data: scored };
    setCache('analytics', result);
    res.json(result);
  } catch (err) {
    console.error('[API] Analytics error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════
const PORT = Number(process.env.PORT) || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  process.exit(0);
});
