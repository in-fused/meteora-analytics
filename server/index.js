// server/index.js
// Main server with REST API and WebSocket support
// Performance-optimized with caching and database-backed data

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

import * as db from './services/database.js';
import * as cache from './services/cache.js';
import * as dataIngestion from './services/dataIngestion.js';
import * as wsServer from './services/wsServer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server for WebSocket support
const server = createServer(app);

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
  const ingestionStatus = dataIngestion.getStatus();
  const wsStats = wsServer.getStats();
  const cacheStats = cache.getStats();

  res.json({
    ok: true,
    timestamp: Date.now(),
    uptime: process.uptime(),
    services: {
      database: !!db.getDb(),
      dataIngestion: ingestionStatus.running,
      websocket: ingestionStatus.websocketConnected,
      wsClients: wsStats.connectedClients
    },
    stats: {
      poolCount: ingestionStatus.poolCount,
      lastRefresh: ingestionStatus.lastRefresh,
      cacheEntries: cacheStats.totalEntries,
      memoryUsage: Math.round(cacheStats.memoryUsage / 1024 / 1024) + 'MB'
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POOLS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v2/pools
 * Get paginated pool list with filters
 */
app.get('/api/v2/pools', async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      sort = 'score',
      order = 'desc',
      minTvl = 0,
      minVolume = 0,
      safety,
      protocol,
      farm,
      hot,
      search
    } = req.query;

    // Create cache key from query params
    const cacheKey = `pools_${JSON.stringify(req.query)}`;

    const pools = await cache.getOrCompute(cacheKey, () => {
      return db.getPools({
        limit: Math.min(parseInt(limit), 500),
        offset: parseInt(offset),
        sortBy: sort,
        sortOrder: order,
        minTvl: parseFloat(minTvl),
        minVolume: parseFloat(minVolume),
        safety: safety || null,
        protocol: protocol || null,
        farmOnly: farm === 'true' || farm === 'active',
        hotOnly: hot === 'true',
        search: search || null
      });
    });

    const totalCount = db.getPoolCount({
      minTvl: parseFloat(minTvl),
      safety: safety || null
    });

    res.json({
      success: true,
      count: pools.length,
      total: totalCount,
      offset: parseInt(offset),
      limit: parseInt(limit),
      data: pools
    });

  } catch (err) {
    console.error('[API] /pools error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v2/pools/:address
 * Get single pool by address
 */
app.get('/api/v2/pools/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const cacheKey = `pool_${address}`;

    const pool = await cache.getOrCompute(cacheKey, () => {
      return db.getPoolByAddress(address);
    });

    if (!pool) {
      return res.status(404).json({ success: false, error: 'Pool not found' });
    }

    res.json({ success: true, data: pool });

  } catch (err) {
    console.error('[API] /pools/:address error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v2/pools/:address/transactions
 * Get recent transactions for a pool
 */
app.get('/api/v2/pools/:address/transactions', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 20 } = req.query;

    const cacheKey = `transactions_${address}_${limit}`;

    const transactions = await cache.getOrCompute(cacheKey, () => {
      return db.getPoolTransactions(address, Math.min(parseInt(limit), 50));
    });

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });

  } catch (err) {
    console.error('[API] /pools/:address/transactions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v2/pools/:address/history
 * Get pool metrics history
 */
app.get('/api/v2/pools/:address/history', async (req, res) => {
  try {
    const { address } = req.params;
    const { hours = 24 } = req.query;

    const history = db.getPoolMetricsHistory(address, parseInt(hours));

    res.json({
      success: true,
      count: history.length,
      data: history
    });

  } catch (err) {
    console.error('[API] /pools/:address/history error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// OPPORTUNITIES API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v2/opportunities
 * Get detected trading opportunities
 */
app.get('/api/v2/opportunities', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    const cacheKey = `opportunities_${limit}`;

    const opportunities = await cache.getOrCompute(cacheKey, () => {
      const opps = db.getOpportunities(parseInt(limit));

      // Add opportunity reason/type for each pool
      return opps.map(p => {
        let reason = '', oppType = 'standard';

        if (p.isHot && p.fees1h > 0) {
          oppType = 'hot';
          const projected = p.fees1h * 24;
          const pctAbove = p.fees > 0 ? ((projected / p.fees - 1) * 100).toFixed(0) : 0;
          reason = `Fee spike: 1h fees $${p.fees1h?.toFixed(0) || 0} → projected $${projected?.toFixed(0) || 0}/day (${pctAbove}% above avg)`;
        } else if (p.fees1h > 0 && p.tvl > 0 && (p.fees1h / p.tvl) > 0.001) {
          oppType = 'active';
          reason = `Active pool: $${p.fees1h?.toFixed(0) || 0} fees in 1h (${((p.fees1h / p.tvl) * 100).toFixed(3)}% of TVL)`;
        } else if (p.farmActive) {
          reason = `Farm active: ${p.apr}% APR + farm rewards`;
        } else if (p.volumeToTvl > 0.5) {
          reason = `High volume: ${(p.volumeToTvl * 100).toFixed(0)}% vol/TVL ratio`;
        } else if (parseFloat(p.apr) > 50) {
          reason = `High APR: ${p.apr}% with strong fee efficiency`;
        } else if (p.feeTvlRatio > 0.01) {
          reason = `Efficient: ${(p.feeTvlRatio * 100).toFixed(2)}% fee/TVL`;
        } else {
          reason = `Top scorer: ${p.score} points, balanced metrics`;
        }

        return { ...p, reason, oppType };
      });
    });

    res.json({
      success: true,
      count: opportunities.length,
      data: opportunities
    });

  } catch (err) {
    console.error('[API] /opportunities error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STATS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v2/stats
 * Get platform statistics
 */
app.get('/api/v2/stats', async (req, res) => {
  try {
    const cacheKey = 'stats_global';

    const stats = await cache.getOrCompute(cacheKey, () => {
      const totalPools = db.getPoolCount();
      const safePools = db.getPoolCount({ safety: 'safe' });
      const hotPools = db.getPools({ hotOnly: true, limit: 100 }).length;
      const opportunities = db.getOpportunities(12);

      // Get top pools for aggregates
      const topByTvl = db.getPools({ limit: 10, sortBy: 'tvl' });
      const totalTvl = topByTvl.reduce((sum, p) => sum + (p.tvl || 0), 0);

      const ingestionStatus = dataIngestion.getStatus();
      const wsStats = wsServer.getStats();

      return {
        pools: {
          total: totalPools,
          safe: safePools,
          hot: hotPools,
          opportunities: opportunities.length
        },
        aggregates: {
          totalTvl,
          sources: ingestionStatus.sources
        },
        realtime: {
          websocketConnected: ingestionStatus.websocketConnected,
          connectedClients: wsStats.connectedClients,
          lastRefresh: ingestionStatus.lastRefresh
        }
      };
    });

    res.json({ success: true, data: stats });

  } catch (err) {
    console.error('[API] /stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTIONS API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v2/transactions
 * Get recent transactions across all pools
 */
app.get('/api/v2/transactions', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const transactions = db.getRecentTransactions(Math.min(parseInt(limit), 100));

    res.json({
      success: true,
      count: transactions.length,
      data: transactions
    });

  } catch (err) {
    console.error('[API] /transactions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v2/search
 * Search pools by name, address, or token
 */
app.get('/api/v2/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, count: 0, data: [] });
    }

    const pools = db.getPools({
      search: q,
      limit: Math.min(parseInt(limit), 50),
      sortBy: 'score'
    });

    res.json({
      success: true,
      count: pools.length,
      query: q,
      data: pools
    });

  } catch (err) {
    console.error('[API] /search error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN / CONTROL API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v2/refresh
 * Force immediate data refresh
 */
app.post('/api/v2/refresh', async (req, res) => {
  try {
    await dataIngestion.forceRefresh();
    cache.clear();

    res.json({
      success: true,
      message: 'Data refresh triggered',
      timestamp: Date.now()
    });

  } catch (err) {
    console.error('[API] /refresh error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY API COMPATIBILITY (v1)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/meteora/analytics
 * Legacy endpoint - maps to new API
 */
app.get('/api/v1/meteora/analytics', async (req, res) => {
  try {
    const pools = db.getPools({
      limit: 200,
      sortBy: 'score',
      minTvl: 10000
    });

    res.json({
      success: true,
      count: pools.length,
      data: pools.map(p => ({
        address: p.address,
        name: p.name,
        protocol: p.protocol,
        tvl: p.tvl,
        volume24h: p.volume,
        fees24h: p.fees,
        apr: parseFloat(p.apr),
        score: p.score
      }))
    });

  } catch (err) {
    console.error('[API] Legacy /analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════

const PORT = Number(process.env.PORT) || 8080;

async function start() {
  try {
    console.log('[Server] Initializing...');

    // Initialize database
    db.initDatabase();
    console.log('[Server] Database initialized');

    // Initialize WebSocket server
    wsServer.init(server);
    console.log('[Server] WebSocket server initialized');

    // Register for data updates to broadcast to clients
    dataIngestion.onPoolUpdate((type, data) => {
      if (type === 'pools') {
        wsServer.broadcastPoolUpdate(data);
        cache.invalidatePattern('^pools_');
        cache.invalidatePattern('^opportunities_');
        cache.invalidate('stats_global');
      } else if (type === 'transaction') {
        wsServer.broadcastTransaction(data);
        cache.invalidatePattern(`^transactions_${data.poolAddress}`);
      }
    });

    // Start data ingestion service
    await dataIngestion.start();
    console.log('[Server] Data ingestion service started');

    // Start HTTP server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
      console.log(`[Server] WebSocket available at ws://0.0.0.0:${PORT}/ws`);
    });

  } catch (err) {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  dataIngestion.stop();
  wsServer.shutdown();
  db.closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down...');
  dataIngestion.stop();
  wsServer.shutdown();
  db.closeDatabase();
  process.exit(0);
});

start();
