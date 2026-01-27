// server/index.js
// Optimized server - serves frontend + secure API proxy
// Helius API key is kept server-side for security

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const HELIUS_KEY = process.env.HELIUS_KEY || '66097387-f0e6-4f93-a800-dbaac4a4c113';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const HELIUS_WS = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// ═══════════════════════════════════════════════════════════════════════════
// SMART CACHING with TTLs
// ═══════════════════════════════════════════════════════════════════════════
const cache = new Map();
const CACHE_TTLS = {
  dlmm: 30000,        // 30 seconds - pool list
  damm: 30000,        // 30 seconds
  jupiter: 300000,    // 5 minutes - token list rarely changes
  balance: 10000,     // 10 seconds
  signatures: 5000,   // 5 seconds - recent transactions
  tx: 60000           // 1 minute - individual tx details don't change
};

function getCached(key, ttl) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < ttl) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  // Limit cache size to prevent memory issues
  if (cache.size > 100) {
    // Remove oldest entries
    const keys = Array.from(cache.keys()).slice(0, 20);
    keys.forEach(k => cache.delete(k));
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITING - Prevent 429 errors
// ═══════════════════════════════════════════════════════════════════════════
const requestQueue = [];
let processing = false;
const MIN_REQUEST_INTERVAL = 100; // 100ms between Helius requests (10 req/sec)

async function queuedFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, options, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (processing || requestQueue.length === 0) return;
  processing = true;

  while (requestQueue.length > 0) {
    const { url, options, resolve, reject } = requestQueue.shift();
    try {
      const response = await fetch(url, options);
      resolve(response);
    } catch (err) {
      reject(err);
    }
    // Wait before next request
    await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL));
  }

  processing = false;
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
    cacheSize: cache.size,
    queueLength: requestQueue.length
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// METEORA API PROXIES (with caching)
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/proxy/dlmm', async (req, res) => {
  try {
    const cached = getCached('dlmm', CACHE_TTLS.dlmm);
    if (cached) return res.json(cached);

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
    const cached = getCached('damm', CACHE_TTLS.damm);
    if (cached) return res.json(cached);

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
    const cached = getCached('jupiter', CACHE_TTLS.jupiter);
    if (cached) return res.json(cached);

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
// HELIUS RPC PROXY - Secure API key server-side
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/helius/rpc', async (req, res) => {
  try {
    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({ error: 'Missing method' });
    }

    // Check cache for certain methods
    let cacheKey = null;
    let cacheTTL = 0;

    if (method === 'getBalance' && params?.[0]) {
      cacheKey = `balance:${params[0]}`;
      cacheTTL = CACHE_TTLS.balance;
    } else if (method === 'getSignaturesForAddress' && params?.[0]) {
      cacheKey = `sigs:${params[0]}:${params?.[1]?.limit || 10}`;
      cacheTTL = CACHE_TTLS.signatures;
    } else if (method === 'getTransaction' && params?.[0]) {
      cacheKey = `tx:${params[0]}`;
      cacheTTL = CACHE_TTLS.tx;
    }

    if (cacheKey) {
      const cached = getCached(cacheKey, cacheTTL);
      if (cached) return res.json(cached);
    }

    // Queue the request to prevent rate limiting
    const response = await queuedFetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: params || []
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Helius] RPC error:', response.status, text);
      return res.status(response.status).json({ error: 'Helius RPC error' });
    }

    const data = await response.json();

    if (cacheKey && data.result) {
      setCache(cacheKey, data);
    }

    res.json(data);
  } catch (err) {
    console.error('[Helius] RPC error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Batch RPC endpoint - more efficient for multiple requests
app.post('/api/helius/batch', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: 'Invalid batch request' });
    }

    // Limit batch size
    const limitedRequests = requests.slice(0, 20);

    const response = await queuedFetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(limitedRequests.map((r, i) => ({
        jsonrpc: '2.0',
        id: i,
        method: r.method,
        params: r.params || []
      })))
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Helius batch error' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[Helius] Batch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVER - Proxy to Helius WebSocket
// ═══════════════════════════════════════════════════════════════════════════

const wss = new WebSocketServer({ server, path: '/ws' });

// Store client subscriptions
const clientSubscriptions = new Map();
let heliusWs = null;
let heliusConnected = false;
let reconnectTimeout = null;

function connectToHelius() {
  if (heliusWs && heliusWs.readyState === WebSocket.OPEN) return;

  console.log('[WS] Connecting to Helius...');
  heliusWs = new WebSocket(HELIUS_WS);

  heliusWs.on('open', () => {
    console.log('[WS] Connected to Helius');
    heliusConnected = true;

    // Resubscribe all active subscriptions
    clientSubscriptions.forEach((clients, address) => {
      if (clients.size > 0) {
        subscribeToAddress(address);
      }
    });
  });

  heliusWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Broadcast to interested clients
      if (message.params?.result?.value?.accountId) {
        const address = message.params.result.value.accountId;
        const clients = clientSubscriptions.get(address);
        if (clients) {
          const broadcast = JSON.stringify(message);
          clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(broadcast);
            }
          });
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  heliusWs.on('close', () => {
    console.log('[WS] Helius connection closed');
    heliusConnected = false;

    // Reconnect after delay
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connectToHelius, 5000);
  });

  heliusWs.on('error', (err) => {
    console.error('[WS] Helius error:', err.message);
    heliusConnected = false;
  });
}

function subscribeToAddress(address) {
  if (!heliusWs || heliusWs.readyState !== WebSocket.OPEN) return;

  heliusWs.send(JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'logsSubscribe',
    params: [
      { mentions: [address] },
      { commitment: 'confirmed' }
    ]
  }));
}

// Handle client connections
wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  // Ensure Helius connection is active
  connectToHelius();

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (message.type === 'subscribe' && message.address) {
        // Add client to subscription list
        if (!clientSubscriptions.has(message.address)) {
          clientSubscriptions.set(message.address, new Set());
          // Subscribe to Helius if connected
          if (heliusConnected) {
            subscribeToAddress(message.address);
          }
        }
        clientSubscriptions.get(message.address).add(ws);
        ws.send(JSON.stringify({ type: 'subscribed', address: message.address }));
      }

      if (message.type === 'unsubscribe' && message.address) {
        const clients = clientSubscriptions.get(message.address);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            clientSubscriptions.delete(message.address);
          }
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  ws.on('close', () => {
    // Remove client from all subscriptions
    clientSubscriptions.forEach((clients, address) => {
      clients.delete(ws);
      if (clients.size === 0) {
        clientSubscriptions.delete(address);
      }
    });
  });

  // Send initial connected message
  ws.send(JSON.stringify({ type: 'connected' }));
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY API (for compatibility)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/v1/meteora/analytics', async (req, res) => {
  try {
    const cached = getCached('analytics', 30000);
    if (cached) return res.json(cached);

    const response = await fetch('https://dlmm-api.meteora.ag/pair/all');
    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const pools = await response.json();

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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] WebSocket: ws://0.0.0.0:${PORT}/ws`);
  console.log(`[Server] Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

  // Start Helius connection
  connectToHelius();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  if (heliusWs) heliusWs.close();
  wss.close();
  server.close(() => {
    process.exit(0);
  });
});
