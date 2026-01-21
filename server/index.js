/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LIQUIDITY PRO - x402 PAID API SERVER
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This server exposes LiquidityPro data via paid API endpoints using the x402
 * HTTP 402 Payment Required protocol. Trading bots and AI agents can access
 * real-time Meteora pool analytics by paying micropayments per request.
 * 
 * ARCHITECTURE:
 * ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │   Trading Bot   │────▶│  x402 Server    │────▶│   Facilitator   │
 * │   / AI Agent    │◀────│  (This File)    │◀────│   (Coinbase)    │
 * └─────────────────┘     └─────────────────┘     └─────────────────┘
 *         │                       │                       │
 *         │  1. Request /pools    │                       │
 *         │◀──────────────────────│                       │
 *         │  2. 402 + Payment Req │                       │
 *         │──────────────────────▶│                       │
 *         │  3. Sign Payment      │                       │
 *         │──────────────────────▶│                       │
 *         │  4. Retry w/ X-PAYMENT│                       │
 *         │                       │──────────────────────▶│
 *         │                       │  5. Verify Payment    │
 *         │                       │◀──────────────────────│
 *         │◀──────────────────────│  6. Return Data       │
 *         │  7. Pool Data         │                       │
 *         └───────────────────────┴───────────────────────┘
 * 
 * PRICING TIERS:
 * - GET /api/v1/pools (basic list)     - FREE (rate limited)
 * - GET /api/v1/pools/premium          - $0.001 USDC per request
 * - GET /api/v1/opportunities          - $0.002 USDC per request
 * - GET /api/v1/pool/:address/analytics- $0.005 USDC per request
 * - WS /api/v1/stream                  - $0.01 USDC per connection
 * 
 * SETUP:
 * 1. npm install express @x402/express @x402/core dotenv cors
 * 2. Set environment variables (see below)
 * 3. node liquidity-pro-api-server.js
 * 
 * ENVIRONMENT VARIABLES:
 * - PORT=4021
 * - PAY_TO_ADDRESS=inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo (your SOL wallet)
 * - FACILITATOR_URL=https://x402.org/facilitator (testnet)
 * - METEORA_API=https://dlmm-api.meteora.ag
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import cors from 'cors';
import { paymentMiddleware } from '@x402/express';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
// For Solana support (when available):
// import { registerExactSvmScheme } from '@x402/svm/exact/server';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  port: process.env.PORT || 4021,
  
  // Your receiving wallet address (Solana)
  // This is where payments will be sent
  payToAddress: process.env.PAY_TO_ADDRESS || 'inFuseD3ZaP1m8raFeDDYyAGfA3QCmy71QGsoRcfvuo',
  
  // x402 Facilitator (handles payment verification)
  // Testnet: https://x402.org/facilitator
  // Mainnet: https://api.cdp.coinbase.com/platform/v2/x402
  facilitatorUrl: process.env.FACILITATOR_URL || 'https://x402.org/facilitator',
  
  // Network for payments
  // Base Sepolia (testnet): eip155:84532
  // Base Mainnet: eip155:8453
  // Solana Devnet: solana:devnet (when supported)
  // Solana Mainnet: solana:mainnet (when supported)
  network: process.env.PAYMENT_NETWORK || 'eip155:84532',
  
  // Meteora API for real data
  meteoraApi: process.env.METEORA_API || 'https://dlmm-api.meteora.ag',
  
  // Rate limits for free tier
  freeRateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,     // 10 requests per minute
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const PRICING = {
  // Prices in USD (will be paid in USDC)
  poolsPremium: '$0.001',      // Full pool list with analytics
  opportunities: '$0.002',     // Curated opportunities
  poolAnalytics: '$0.005',     // Deep analytics for specific pool
  streamAccess: '$0.01',       // WebSocket stream access
  bulkExport: '$0.05',         // Full data export
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════════════════════════════

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// X402 PAYMENT MIDDLEWARE SETUP
// ═══════════════════════════════════════════════════════════════════════════════

// Create facilitator client
const facilitatorClient = new HTTPFacilitatorClient({
  url: CONFIG.facilitatorUrl,
});

// Create resource server and register payment schemes
const x402Server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(x402Server);
// When Solana support is added:
// registerExactSvmScheme(x402Server);

// Define paid routes with x402 payment requirements
const paidRoutes = {
  'GET /api/v1/pools/premium': {
    accepts: [{
      scheme: 'exact',
      price: PRICING.poolsPremium,
      network: CONFIG.network,
      payTo: CONFIG.payToAddress,
    }],
    description: 'Premium pool data with full analytics, scores, and real-time metrics',
    mimeType: 'application/json',
  },
  
  'GET /api/v1/opportunities': {
    accepts: [{
      scheme: 'exact',
      price: PRICING.opportunities,
      network: CONFIG.network,
      payTo: CONFIG.payToAddress,
    }],
    description: 'Curated LP opportunities ranked by score with reasons',
    mimeType: 'application/json',
  },
  
  'GET /api/v1/pool/:address/analytics': {
    accepts: [{
      scheme: 'exact',
      price: PRICING.poolAnalytics,
      network: CONFIG.network,
      payTo: CONFIG.payToAddress,
    }],
    description: 'Deep analytics for a specific pool including bin distribution and transactions',
    mimeType: 'application/json',
  },
  
  'GET /api/v1/export': {
    accepts: [{
      scheme: 'exact',
      price: PRICING.bulkExport,
      network: CONFIG.network,
      payTo: CONFIG.payToAddress,
    }],
    description: 'Full data export of all pools and opportunities',
    mimeType: 'application/json',
  },
};

// Apply x402 payment middleware to paid routes
app.use(paymentMiddleware(paidRoutes, x402Server));

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING FOR FREE TIER
// ═══════════════════════════════════════════════════════════════════════════════

const rateLimitStore = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - CONFIG.freeRateLimit.windowMs;
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(ip);
  if (!entry || entry.windowStart < windowStart) {
    entry = { windowStart: now, count: 0 };
  }
  
  entry.count++;
  rateLimitStore.set(ip, entry);
  
  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', CONFIG.freeRateLimit.maxRequests);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, CONFIG.freeRateLimit.maxRequests - entry.count));
  res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + CONFIG.freeRateLimit.windowMs) / 1000));
  
  if (entry.count > CONFIG.freeRateLimit.maxRequests) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Upgrade to paid API for unlimited access',
      paidEndpoint: '/api/v1/pools/premium',
      retryAfter: Math.ceil((entry.windowStart + CONFIG.freeRateLimit.windowMs - now) / 1000),
    });
  }
  
  next();
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  const windowStart = now - CONFIG.freeRateLimit.windowMs;
  for (const [ip, entry] of rateLimitStore) {
    if (entry.windowStart < windowStart) {
      rateLimitStore.delete(ip);
    }
  }
}, 60000);

// ═══════════════════════════════════════════════════════════════════════════════
// DATA FETCHING FROM METEORA
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchMeteoraPoolsFromAPI() {
  try {
    const response = await fetch(`${CONFIG.meteoraApi}/pair/all_with_pagination?page=0&limit=100&sort_key=volume&order_by=desc`);
    if (!response.ok) throw new Error('Meteora API error');
    return response.json();
  } catch (error) {
    console.error('[Meteora API] Error:', error);
    return null;
  }
}

async function fetchPoolBins(poolAddress) {
  try {
    const response = await fetch(`${CONFIG.meteoraApi}/pair/${poolAddress}/bins`);
    if (!response.ok) throw new Error('Meteora bins API error');
    return response.json();
  } catch (error) {
    console.error('[Meteora Bins] Error:', error);
    return null;
  }
}

// Score calculation (same algorithm as frontend)
function calculatePoolScore(pool) {
  let score = 50;
  
  // APR factor (max 25 points)
  const apr = parseFloat(pool.apr) || 0;
  if (apr > 500) score += 25;
  else if (apr > 200) score += 20;
  else if (apr > 100) score += 15;
  else if (apr > 50) score += 10;
  else if (apr > 20) score += 5;
  
  // Volume/TVL ratio (max 15 points)
  const tvl = parseFloat(pool.liquidity) || 1;
  const volume = parseFloat(pool.trade_volume_24h) || 0;
  const volTvl = volume / tvl;
  if (volTvl > 5) score += 15;
  else if (volTvl > 2) score += 12;
  else if (volTvl > 1) score += 8;
  else if (volTvl > 0.5) score += 5;
  
  // Fee generation (max 10 points)
  const fees = parseFloat(pool.fees_24h) || 0;
  const feeTvl = fees / tvl;
  if (feeTvl > 0.01) score += 10;
  else if (feeTvl > 0.005) score += 7;
  else if (feeTvl > 0.001) score += 4;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

// Transform Meteora data to our format
function transformPoolData(meteoraPool, includeAnalytics = false) {
  const score = calculatePoolScore(meteoraPool);
  
  const base = {
    id: meteoraPool.address,
    address: meteoraPool.address,
    name: meteoraPool.name,
    protocol: meteoraPool.is_dlmm ? 'Meteora DLMM' : 'Meteora DAMM',
    tvl: parseFloat(meteoraPool.liquidity) || 0,
    volume: parseFloat(meteoraPool.trade_volume_24h) || 0,
    fees: parseFloat(meteoraPool.fees_24h) || 0,
    apr: parseFloat(meteoraPool.apr) || 0,
    score,
  };
  
  if (includeAnalytics) {
    base.analytics = {
      volumeToTvl: base.tvl > 0 ? base.volume / base.tvl : 0,
      feeTvlRatio: base.tvl > 0 ? base.fees / base.tvl : 0,
      binStep: meteoraPool.bin_step || null,
      baseFee: meteoraPool.base_fee_percentage || null,
      activeBin: meteoraPool.active_bin_id || null,
      mintX: meteoraPool.mint_x,
      mintY: meteoraPool.mint_y,
      reserveX: meteoraPool.reserve_x,
      reserveY: meteoraPool.reserve_y,
      cumulativeVolume: meteoraPool.cumulative_trade_volume,
      cumulativeFees: meteoraPool.cumulative_fee_volume,
    };
  }
  
  return base;
}

// Generate opportunities from pools
function generateOpportunities(pools) {
  return pools
    .filter(p => p.score >= 80)
    .map(pool => {
      let oppType = 'volume';
      let reason = 'High score pool with good fundamentals';
      
      if (pool.analytics) {
        if (pool.analytics.volumeToTvl > 2) {
          oppType = 'volume';
          reason = `HIGH VOLUME: ${(pool.analytics.volumeToTvl * 100).toFixed(0)}% vol/TVL ratio. Strong fee generation.`;
        } else if (pool.analytics.feeTvlRatio > 0.005) {
          oppType = 'active';
          reason = `ACTIVE: ${(pool.analytics.feeTvlRatio * 100).toFixed(3)}% fee/TVL. High short-term fee potential.`;
        }
      }
      
      return {
        ...pool,
        oppType,
        reason,
        opportunity: true,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES - FREE TIER (Rate Limited)
// ═══════════════════════════════════════════════════════════════════════════════

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    x402: {
      enabled: true,
      network: CONFIG.network,
      facilitator: CONFIG.facilitatorUrl,
    },
  });
});

// API documentation
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'LiquidityPro API',
    version: '1.0.0',
    description: 'Real-time Meteora liquidity pool analytics powered by x402 micropayments',
    documentation: 'https://github.com/your-repo/liquidity-pro-api',
    endpoints: {
      free: {
        'GET /api/v1/health': 'Health check',
        'GET /api/v1/pools': 'Basic pool list (rate limited: 10 req/min)',
      },
      paid: {
        'GET /api/v1/pools/premium': {
          price: PRICING.poolsPremium,
          description: 'Full pool data with analytics and scores',
        },
        'GET /api/v1/opportunities': {
          price: PRICING.opportunities,
          description: 'Curated LP opportunities',
        },
        'GET /api/v1/pool/:address/analytics': {
          price: PRICING.poolAnalytics,
          description: 'Deep analytics for specific pool',
        },
        'GET /api/v1/export': {
          price: PRICING.bulkExport,
          description: 'Full data export',
        },
      },
    },
    payment: {
      protocol: 'x402',
      network: CONFIG.network,
      currency: 'USDC',
      facilitator: CONFIG.facilitatorUrl,
    },
  });
});

// Free pools endpoint (rate limited, basic data only)
app.get('/api/v1/pools', rateLimit, async (req, res) => {
  try {
    const meteoraData = await fetchMeteoraPoolsFromAPI();
    
    if (!meteoraData || !meteoraData.pairs) {
      return res.status(503).json({ error: 'Unable to fetch pool data' });
    }
    
    // Return limited data for free tier
    const pools = meteoraData.pairs
      .slice(0, 20) // Only top 20 for free
      .map(p => ({
        address: p.address,
        name: p.name,
        tvl: parseFloat(p.liquidity) || 0,
        volume24h: parseFloat(p.trade_volume_24h) || 0,
        apr: parseFloat(p.apr) || 0,
      }));
    
    res.json({
      success: true,
      count: pools.length,
      note: 'Free tier limited to 20 pools. Use /api/v1/pools/premium for full data.',
      data: pools,
    });
  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES - PAID TIER (x402 Protected)
// ═══════════════════════════════════════════════════════════════════════════════

// Premium pools endpoint - Full data with analytics
app.get('/api/v1/pools/premium', async (req, res) => {
  try {
    // Payment was verified by x402 middleware if we reach here
    const paymentDetails = req.x402Payment;
    console.log('[PAID] Premium pools accessed, payment:', paymentDetails?.transactionHash);
    
    const meteoraData = await fetchMeteoraPoolsFromAPI();
    
    if (!meteoraData || !meteoraData.pairs) {
      return res.status(503).json({ error: 'Unable to fetch pool data' });
    }
    
    const pools = meteoraData.pairs.map(p => transformPoolData(p, true));
    
    res.json({
      success: true,
      count: pools.length,
      timestamp: new Date().toISOString(),
      payment: {
        verified: true,
        txHash: paymentDetails?.transactionHash || 'N/A',
      },
      data: pools,
    });
  } catch (error) {
    console.error('[API] Premium pools error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Opportunities endpoint - Curated high-score pools
app.get('/api/v1/opportunities', async (req, res) => {
  try {
    const paymentDetails = req.x402Payment;
    console.log('[PAID] Opportunities accessed, payment:', paymentDetails?.transactionHash);
    
    const meteoraData = await fetchMeteoraPoolsFromAPI();
    
    if (!meteoraData || !meteoraData.pairs) {
      return res.status(503).json({ error: 'Unable to fetch pool data' });
    }
    
    const pools = meteoraData.pairs.map(p => transformPoolData(p, true));
    const opportunities = generateOpportunities(pools);
    
    res.json({
      success: true,
      count: opportunities.length,
      timestamp: new Date().toISOString(),
      payment: {
        verified: true,
        txHash: paymentDetails?.transactionHash || 'N/A',
      },
      data: opportunities,
    });
  } catch (error) {
    console.error('[API] Opportunities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Single pool analytics - Deep dive
app.get('/api/v1/pool/:address/analytics', async (req, res) => {
  try {
    const { address } = req.params;
    const paymentDetails = req.x402Payment;
    console.log(`[PAID] Pool analytics for ${address}, payment:`, paymentDetails?.transactionHash);
    
    // Fetch pool data and bins
    const [meteoraData, bins] = await Promise.all([
      fetch(`${CONFIG.meteoraApi}/pair/${address}`).then(r => r.json()).catch(() => null),
      fetchPoolBins(address),
    ]);
    
    if (!meteoraData) {
      return res.status(404).json({ error: 'Pool not found' });
    }
    
    const pool = transformPoolData(meteoraData, true);
    
    // Add bin distribution if available
    if (bins) {
      pool.analytics.binDistribution = bins;
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      payment: {
        verified: true,
        txHash: paymentDetails?.transactionHash || 'N/A',
      },
      data: pool,
    });
  } catch (error) {
    console.error('[API] Pool analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk export - All data
app.get('/api/v1/export', async (req, res) => {
  try {
    const paymentDetails = req.x402Payment;
    console.log('[PAID] Full export accessed, payment:', paymentDetails?.transactionHash);
    
    const meteoraData = await fetchMeteoraPoolsFromAPI();
    
    if (!meteoraData || !meteoraData.pairs) {
      return res.status(503).json({ error: 'Unable to fetch pool data' });
    }
    
    const pools = meteoraData.pairs.map(p => transformPoolData(p, true));
    const opportunities = generateOpportunities(pools);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      payment: {
        verified: true,
        txHash: paymentDetails?.transactionHash || 'N/A',
      },
      data: {
        pools: {
          count: pools.length,
          items: pools,
        },
        opportunities: {
          count: opportunities.length,
          items: opportunities,
        },
        metadata: {
          source: 'Meteora',
          lastUpdated: new Date().toISOString(),
          scoringVersion: '1.0',
        },
      },
    });
  } catch (error) {
    console.error('[API] Export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'Endpoint does not exist',
    documentation: '/api/v1',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════════════════════════════

app.listen(CONFIG.port, () => {
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
  LIQUIDITY PRO API SERVER - x402 ENABLED
═══════════════════════════════════════════════════════════════════════════════

  Server running at:     http://localhost:${CONFIG.port}
  API Documentation:     http://localhost:${CONFIG.port}/api/v1
  Health Check:          http://localhost:${CONFIG.port}/api/v1/health
  
  Payment Configuration:
  - Network:             ${CONFIG.network}
  - Pay To:              ${CONFIG.payToAddress}
  - Facilitator:         ${CONFIG.facilitatorUrl}
  
  Pricing:
  - /pools/premium       ${PRICING.poolsPremium} per request
  - /opportunities       ${PRICING.opportunities} per request
  - /pool/:addr/analytics ${PRICING.poolAnalytics} per request
  - /export              ${PRICING.bulkExport} per request
  
  Free Tier:
  - /pools               ${CONFIG.freeRateLimit.maxRequests} requests per minute
  
═══════════════════════════════════════════════════════════════════════════════
`);
});

export default app;
