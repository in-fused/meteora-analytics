// server/index.js
// LiquidityPro backend — Helius Gatekeeper beta + Enhanced WebSockets + DLMM SDK
// All existing API contracts preserved; zero frontend regression.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

// DLMM SDK + Solana web3 use CJS internals (Anchor) that break with ESM directory imports.
// Use createRequire to load them in CJS mode, which resolves all nested imports correctly.
const require = createRequire(import.meta.url);
const { Connection, PublicKey } = require('@solana/web3.js');
const DLMM = require('@meteora-ag/dlmm');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION — Helius Gatekeeper Beta (4.6-7.8x faster)
// ═══════════════════════════════════════════════════════════════════════════
const HELIUS_KEY = process.env.HELIUS_KEY || '66097387-f0e6-4f93-a800-dbaac4a4c113';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '59819a46-e0b4-46c3-9d1d-1654cf850419';

// Gatekeeper beta endpoint — same API key, dramatically lower latency
// Cold: 26ms vs 122ms (4.6x), Warm: 0.5ms vs 35ms (7.8x)
const HELIUS_RPC = `https://beta.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const HELIUS_RPC_FALLBACK = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// Public RPC fallbacks — used when both Helius endpoints fail
const SOLANA_PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';
const ANKR_SOLANA_RPC = 'https://rpc.ankr.com/solana';

// Solana connection for DLMM SDK (reuses Helius RPC)
const solanaConnection = new Connection(HELIUS_RPC_FALLBACK, 'confirmed');

// Enhanced WebSockets — Geyser-powered, server-side filtering, LaserStream infra
const HELIUS_ENHANCED_WS = `wss://atlas-mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const HELIUS_WS_FALLBACK = `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// ═══════════════════════════════════════════════════════════════════════════
// LRU CACHE — Proper eviction by last-access time, bounded size
// ═══════════════════════════════════════════════════════════════════════════
class LRUCache {
  constructor(maxSize = 200) {
    this.maxSize = maxSize;
    this.cache = new Map();  // Map preserves insertion order; we re-insert on access
    this.hits = 0;
    this.misses = 0;
  }

  get(key, ttl) {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return null;
    }
    if (Date.now() - item.timestamp > ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    this.hits++;
    return item.data;
  }

  set(key, data) {
    // Delete first to update position
    this.cache.delete(key);
    // Evict oldest entries if over capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : 'N/A',
    };
  }
}

const cache = new LRUCache(200);

const CACHE_TTLS = {
  dlmm: 30_000,         // 30s — pool list
  damm: 30_000,         // 30s
  raydium: 30_000,      // 30s — Raydium CLMM pools
  jupiter: 300_000,     // 5min — token list rarely changes
  balance: 10_000,      // 10s
  signatures: 5_000,    // 5s — recent transactions
  tx: 60_000,           // 1min — finalized tx details don't change
  analytics: 30_000,    // 30s — legacy endpoint
};

// ═══════════════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER — Protects against cascading failures from upstream APIs
// ═══════════════════════════════════════════════════════════════════════════
class CircuitBreaker {
  constructor(name, { failThreshold = 5, resetTimeout = 30_000 } = {}) {
    this.name = name;
    this.failThreshold = failThreshold;
    this.resetTimeout = resetTimeout;
    this.failures = 0;
    this.state = 'closed';  // closed = normal, open = blocking, half-open = testing
    this.nextRetryAt = 0;
  }

  canRequest() {
    if (this.state === 'closed') return true;
    if (this.state === 'open' && Date.now() >= this.nextRetryAt) {
      this.state = 'half-open';
      return true;
    }
    return this.state === 'half-open';
  }

  recordSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  recordFailure() {
    this.failures++;
    if (this.failures >= this.failThreshold) {
      this.state = 'open';
      this.nextRetryAt = Date.now() + this.resetTimeout;
      console.warn(`[CircuitBreaker] ${this.name} OPEN — ${this.failures} consecutive failures`);
    }
  }

  status() {
    return { state: this.state, failures: this.failures };
  }
}

const breakers = {
  helius: new CircuitBreaker('helius', { failThreshold: 10, resetTimeout: 10_000 }),
  dlmm: new CircuitBreaker('dlmm', { failThreshold: 3, resetTimeout: 30_000 }),
  damm: new CircuitBreaker('damm', { failThreshold: 3, resetTimeout: 30_000 }),
  raydium: new CircuitBreaker('raydium', { failThreshold: 3, resetTimeout: 30_000 }),
  jupiter: new CircuitBreaker('jupiter', { failThreshold: 3, resetTimeout: 60_000 }),
};

// ═══════════════════════════════════════════════════════════════════════════
// RATE LIMITER — Concurrent-aware with retry + exponential backoff
// ═══════════════════════════════════════════════════════════════════════════
const MAX_CONCURRENT_RPC = 6;   // Gatekeeper handles higher concurrency
const MIN_INTERVAL_MS = 50;     // 50ms min between sends (20 req/sec, up from 10)
let activeRequests = 0;
let lastRequestTime = 0;

async function rpcFetch(url, options = {}, { breaker = null, retries = 2, backoff = 500, timeout = 15_000 } = {}) {
  if (breaker && !breaker.canRequest()) {
    throw new Error(`Circuit breaker ${breaker.name} is open`);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Concurrency gate
    while (activeRequests >= MAX_CONCURRENT_RPC) {
      await new Promise(r => setTimeout(r, 20));
    }

    // Minimum interval
    const now = Date.now();
    const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestTime));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequestTime = Date.now();

    activeRequests++;
    try {
      // Add timeout via AbortController to prevent hanging requests
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const fetchOptions = { ...options, signal: controller.signal };

      const response = await fetch(url, fetchOptions);
      clearTimeout(timer);

      if (response.status === 429) {
        activeRequests--;
        if (attempt < retries) {
          const delay = backoff * Math.pow(2, attempt);
          console.warn(`[RPC] 429 from ${new URL(url).hostname}, retry in ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        if (breaker) breaker.recordFailure();
        throw new Error('Rate limited (429)');
      }

      if (!response.ok) {
        activeRequests--;
        if (breaker) breaker.recordFailure();
        throw new Error(`HTTP ${response.status}`);
      }

      activeRequests--;
      if (breaker) breaker.recordSuccess();
      return response;
    } catch (err) {
      activeRequests--;
      if (attempt < retries && err.name !== 'AbortError') {
        const delay = backoff * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      if (breaker) breaker.recordFailure();
      throw err;
    }
  }
}

// Helius RPC with automatic fallback
// Key may work on Gatekeeper beta but not standard RPC — track separately
let standardRpcDisabled = false; // Standard RPC returns 401 for this key — skip it

async function heliusFetch(body) {
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };

  // Always try Gatekeeper beta first — it's the fastest and the key works here
  // The circuit breaker handles temporary failures with auto-recovery (15s reset)
  try {
    return await rpcFetch(HELIUS_RPC, options, { breaker: breakers.helius, timeout: 10_000 });
  } catch (err) {
    // Only log if it's not just the circuit breaker blocking
    if (breakers.helius.state !== 'open') {
      console.warn('[RPC] Gatekeeper failed:', err.message);
    }
  }

  // Standard endpoint — skip if known to reject this key
  if (!standardRpcDisabled) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12_000);
      const response = await fetch(HELIUS_RPC_FALLBACK, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (response.status === 401 || response.status === 403) {
        standardRpcDisabled = true;
        console.warn(`[RPC] Helius standard rejected key (${response.status}), skipping for future requests`);
      } else if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      } else {
        return response;
      }
    } catch (err) {
      console.warn('[RPC] Helius standard failed:', err.message);
    }
  }

  // Public Solana RPC
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(SOLANA_PUBLIC_RPC, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (err) {
    console.warn('[RPC] Public Solana RPC failed:', err.message);
  }

  // Ankr Solana RPC
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const response = await fetch(ANKR_SOLANA_RPC, { ...options, signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (err) {
    console.error('[RPC] All RPC endpoints failed:', err.message);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH CHECK — Includes cache stats, circuit breaker state, RPC mode
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    rpc: {
      primary: 'beta.helius-rpc.com (Gatekeeper)',
      fallback: standardRpcDisabled ? 'disabled (401)' : 'mainnet.helius-rpc.com',
      ws: useEnhancedWs ? 'atlas-mainnet.helius-rpc.com (Enhanced)' : 'mainnet.helius-rpc.com (standard)',
      standardRpcDisabled,
    },
    cache: cache.stats(),
    circuitBreakers: Object.fromEntries(
      Object.entries(breakers).map(([k, b]) => [k, b.status()])
    ),
    activeRpcRequests: activeRequests,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POOL DATA PROXIES — Cached, circuit-broken, with structured errors
// ═══════════════════════════════════════════════════════════════════════════

// In-flight request dedup — prevents warmup + client from fetching the same 150MB twice
const inflightRequests = new Map(); // key -> Promise<result>

async function proxyFetch(req, res, { key, ttl, url, breaker, transform, headers, retries = 2 }) {
  try {
    const cached = cache.get(key, ttl);
    if (cached) return res.json(cached);

    if (!breaker.canRequest()) {
      const stale = cache.get(key, Infinity);
      if (stale) {
        res.set('X-Cache-Stale', 'true');
        return res.json(stale);
      }
      return res.status(503).json({
        error: `${key} service temporarily unavailable`,
        retryAfter: Math.ceil(breaker.resetTimeout / 1000),
      });
    }

    // If another request for this key is already in-flight, wait for it
    if (inflightRequests.has(key)) {
      const result = await inflightRequests.get(key);
      return res.json(result);
    }

    // Start the fetch and register as in-flight
    const fetchPromise = (async () => {
      const response = await rpcFetch(url, headers ? { headers } : {}, { breaker, retries, timeout: 45_000 });
      const data = await response.json();
      const result = transform ? transform(data) : data;
      cache.set(key, result);
      return result;
    })();

    inflightRequests.set(key, fetchPromise);
    try {
      const result = await fetchPromise;
      res.json(result);
    } finally {
      inflightRequests.delete(key);
    }
  } catch (err) {
    inflightRequests.delete(key);
    console.error(`[Proxy] ${key} error:`, err.message);
    const stale = cache.get(key, Infinity);
    if (stale) {
      res.set('X-Cache-Stale', 'true');
      return res.json(stale);
    }
    res.status(502).json({ error: `Failed to fetch ${key} data` });
  }
}

app.get('/api/proxy/dlmm', (req, res) => proxyFetch(req, res, {
  key: 'dlmm',
  ttl: CACHE_TTLS.dlmm,
  url: 'https://dlmm-api.meteora.ag/pair/all',
  breaker: breakers.dlmm,
  retries: 3,  // Extra retries — DLMM is the most important data source
  // Transform: strip unused fields to reduce ~150MB → ~5-10MB response
  // The raw API returns 50+ fields per pool; the frontend only uses ~25
  transform: (data) => {
    if (!Array.isArray(data)) return data;
    return data
      .filter(p => p.name && p.address && !p.hide && !p.is_blacklisted && parseFloat(p.liquidity || 0) > 100)
      .map(p => ({
        address: p.address,
        name: p.name,
        mint_x: p.mint_x,
        mint_y: p.mint_y,
        liquidity: p.liquidity,
        trade_volume_24h: p.trade_volume_24h,
        apr: p.apr,
        apy: p.apy,
        fees_24h: p.fees_24h,
        today_fees: p.today_fees,
        current_price: p.current_price,
        bin_step: p.bin_step,
        active_id: p.active_id,
        base_fee_percentage: p.base_fee_percentage,
        fee_tvl_ratio: p.fee_tvl_ratio,
        fees: p.fees,
        farm_apr: p.farm_apr,
        farm_apy: p.farm_apy,
        reward_mint_x: p.reward_mint_x,
        reward_mint_y: p.reward_mint_y,
        is_verified: p.is_verified,
        cumulative_fee_volume: p.cumulative_fee_volume,
        cumulative_trade_volume: p.cumulative_trade_volume,
        tags: p.tags,
      }));
  },
}));

app.get('/api/proxy/damm', (req, res) => proxyFetch(req, res, {
  key: 'damm',
  ttl: CACHE_TTLS.damm,
  url: 'https://dammv2-api.meteora.ag/pools?limit=200&order_by=tvl&order=desc',
  breaker: breakers.damm,
}));

app.get('/api/proxy/raydium', (req, res) => proxyFetch(req, res, {
  key: 'raydium',
  ttl: CACHE_TTLS.raydium,
  url: 'https://api-v3.raydium.io/pools/info/list?poolType=concentrated&poolSortField=liquidity&sortType=desc&pageSize=200&page=1',
  breaker: breakers.raydium,
}));

app.get('/api/proxy/jupiter-tokens', (req, res) => proxyFetch(req, res, {
  key: 'jupiter',
  ttl: CACHE_TTLS.jupiter,
  url: 'https://api.jup.ag/tokens/v2/tag?query=verified',
  breaker: breakers.jupiter,
  headers: { 'x-api-key': JUPITER_API_KEY },
}));

// ═══════════════════════════════════════════════════════════════════════════
// HELIUS RPC PROXY — Gatekeeper beta with automatic fallback
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/helius/rpc', async (req, res) => {
  try {
    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({ error: 'Missing method' });
    }

    // Cache lookup for cacheable methods
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
      const cached = cache.get(cacheKey, cacheTTL);
      if (cached) return res.json(cached);
    }

    const rpcBody = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params: params || [],
    };

    const response = await heliusFetch(rpcBody);

    if (!response.ok) {
      const text = await response.text();
      console.error('[Helius] RPC error:', response.status, text);
      return res.status(response.status).json({ error: 'Helius RPC error' });
    }

    const data = await response.json();

    if (cacheKey && data.result) {
      cache.set(cacheKey, data);
    }

    res.json(data);
  } catch (err) {
    console.error('[Helius] RPC error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Batch RPC endpoint — more efficient for multiple requests
app.post('/api/helius/batch', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({ error: 'Invalid batch request' });
    }

    // Limit batch size
    const limitedRequests = requests.slice(0, 20);

    const batchBody = limitedRequests.map((r, i) => ({
      jsonrpc: '2.0',
      id: i,
      method: r.method,
      params: r.params || [],
    }));

    const response = await heliusFetch(batchBody);

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
// WEBSOCKET SERVER — Enhanced WebSockets with transactionSubscribe
//
// Enhanced WebSockets (atlas endpoint) provide:
//   - transactionSubscribe with server-side filtering
//   - accountSubscribe with up to 50,000 address filters
//   - Built on LaserStream infra for lower latency
//   - Automatic failover to standard WS if Enhanced unavailable
// ═══════════════════════════════════════════════════════════════════════════

const wss = new WebSocketServer({ server, path: '/ws' });

const clientSubscriptions = new Map();  // address -> Set<ws>
let heliusWs = null;
let heliusConnected = false;
let reconnectTimeout = null;
let wsHeartbeat = null;
let useEnhancedWs = true;  // Start with Enhanced, fall back to standard
let wsReconnectAttempts = 0;
let wsAuthFailed = false;   // Set true on 401 — stops reconnect loop
const WS_MAX_RECONNECT = 8;

function getWsEndpoint() {
  return useEnhancedWs ? HELIUS_ENHANCED_WS : HELIUS_WS_FALLBACK;
}

function connectToHelius() {
  if (heliusWs && heliusWs.readyState === WebSocket.OPEN) return;
  if (wsAuthFailed) return; // Don't retry with an invalid key

  if (wsReconnectAttempts >= WS_MAX_RECONNECT) {
    console.warn('[WS] Max reconnect attempts reached — using HTTP polling only');
    console.warn('[WS] Live transaction push via WebSocket is disabled. Expanded pool cards will still show transactions via HTTP polling.');
    return;
  }

  const endpoint = getWsEndpoint();
  const mode = useEnhancedWs ? 'Enhanced' : 'Standard';
  console.log(`[WS] Connecting to Helius ${mode}...`);

  try {
    heliusWs = new WebSocket(endpoint);
  } catch (err) {
    console.error('[WS] Failed to create WebSocket:', err.message);
    wsReconnectAttempts++;
    scheduleReconnect();
    return;
  }

  heliusWs.on('open', () => {
    console.log(`[WS] Connected to Helius ${mode}`);
    heliusConnected = true;
    wsReconnectAttempts = 0; // Reset on successful connection

    // Start heartbeat to detect stale connections
    clearInterval(wsHeartbeat);
    wsHeartbeat = setInterval(() => {
      if (heliusWs?.readyState === WebSocket.OPEN) {
        heliusWs.ping();
      }
    }, 30_000);

    // Resubscribe all active addresses
    clientSubscriptions.forEach((clients, address) => {
      if (clients.size > 0) {
        subscribeToAddress(address);
      }
    });
  });

  heliusWs.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      if (useEnhancedWs) {
        handleEnhancedMessage(message);
      } else {
        handleStandardMessage(message);
      }
    } catch (e) {
      // Ignore parse errors
    }
  });

  heliusWs.on('close', (code) => {
    console.log(`[WS] Helius connection closed (code: ${code})`);
    heliusConnected = false;
    clearInterval(wsHeartbeat);

    // If Enhanced WS failed to establish, fall back to standard
    if (useEnhancedWs && code !== 1000) {
      console.warn('[WS] Enhanced WebSocket failed, falling back to standard');
      useEnhancedWs = false;
    }

    wsReconnectAttempts++;
    scheduleReconnect();
  });

  heliusWs.on('error', (err) => {
    console.error('[WS] Helius error:', err.message);
    heliusConnected = false;

    // Detect auth failures — stop infinite reconnect loop
    if (err.message?.includes('401')) {
      wsAuthFailed = true;
      console.error('[WS] Helius API key rejected (401). WebSocket disabled.');
      console.error('[WS] Set HELIUS_KEY env var with a valid key, or the app will use HTTP polling only.');
      console.error('[WS] Get a free key at https://dev.helius.xyz');
    }
  });

  heliusWs.on('pong', () => {
    // Connection is alive
  });

  // Unexpected server response (like 401/403) triggers 'error' before 'close',
  // but the error message format varies. Also detect from the upgrade response.
  heliusWs.on('unexpected-response', (req, res) => {
    if (res.statusCode === 401) {
      wsAuthFailed = true;
      console.error(`[WS] Helius returned HTTP ${res.statusCode} — API key is invalid or expired.`);
      console.error('[WS] WebSocket disabled. Set HELIUS_KEY env var with a valid key.');
      console.error('[WS] Get a free key at https://dev.helius.xyz');
    } else if (res.statusCode === 403 && useEnhancedWs) {
      // Enhanced WS not available for this key — immediately try standard
      console.warn('[WS] Enhanced WS unavailable (403), switching to standard immediately');
      useEnhancedWs = false;
      wsReconnectAttempts = 0; // Don't count 403 as a failure
      heliusWs?.terminate();
      heliusWs = null;
      // Skip the close handler's reconnect — connect immediately
      setTimeout(connectToHelius, 100);
      return;
    } else {
      console.warn(`[WS] Unexpected HTTP ${res.statusCode} from Helius WS endpoint`);
    }
    // Destroy the socket to prevent the 'close' handler from also reconnecting
    heliusWs?.terminate();
    heliusWs = null;
  });
}

function handleEnhancedMessage(message) {
  // Enhanced WS transactionSubscribe returns richer data
  // The notification includes account keys involved in the transaction
  if (message.params?.result) {
    const result = message.params.result;
    const accountKeys = result.transaction?.transaction?.message?.accountKeys
      || result.transaction?.meta?.loadedAddresses?.writable
      || [];

    // Broadcast to any client subscribed to accounts in this transaction
    const notified = new Set();
    for (const key of accountKeys) {
      const addr = typeof key === 'string' ? key : key?.pubkey;
      if (!addr) continue;
      const clients = clientSubscriptions.get(addr);
      if (clients) {
        const broadcast = JSON.stringify({
          type: 'transaction',
          address: addr,
          data: result,
        });
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN && !notified.has(client)) {
            client.send(broadcast);
            notified.add(client);
          }
        });
      }
    }

    // Also broadcast via signature match if the result has a signature
    const sig = result.signature;
    if (sig) {
      broadcastToAllSubscribers({
        type: 'transaction_notification',
        signature: sig,
        slot: result.slot,
      });
    }
  }
}

function handleStandardMessage(message) {
  // Standard logsSubscribe: message.params.result.value has logs
  if (message.params?.result?.value) {
    const logs = message.params.result.value.logs || [];
    const signature = message.params.result.value.signature;

    // Broadcast to all active subscribers (standard WS doesn't filter by address well)
    broadcastToAllSubscribers({
      type: 'log_notification',
      signature,
      logs,
    });
  }
}

function broadcastToAllSubscribers(data) {
  const broadcast = JSON.stringify(data);
  clientSubscriptions.forEach((clients) => {
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(broadcast);
      }
    });
  });
}

function subscribeToAddress(address) {
  if (!heliusWs || heliusWs.readyState !== WebSocket.OPEN) return;

  try {
    if (useEnhancedWs) {
      // Enhanced WebSocket: use transactionSubscribe with account filters
      heliusWs.send(JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'transactionSubscribe',
        params: [{
          accountInclude: [address],
          failed: false,
        }, {
          commitment: 'confirmed',
          encoding: 'jsonParsed',
          transactionDetails: 'full',
          maxSupportedTransactionVersion: 0,
        }],
      }));
    } else {
      // Standard WebSocket: use logsSubscribe
      heliusWs.send(JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'logsSubscribe',
        params: [
          { mentions: [address] },
          { commitment: 'confirmed' },
        ],
      }));
    }
  } catch (err) {
    console.warn('[WS] subscribeToAddress send failed:', err.message);
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimeout);
  if (wsAuthFailed) return; // Don't retry with an invalid key
  if (wsReconnectAttempts >= WS_MAX_RECONNECT) return;

  // Exponential backoff: 2s, 4s, 8s, 16s, 30s, 30s...
  const delay = Math.min(2000 * Math.pow(2, wsReconnectAttempts - 1), 30_000);
  console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${wsReconnectAttempts}/${WS_MAX_RECONNECT})`);
  reconnectTimeout = setTimeout(connectToHelius, delay);
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
        if (!clientSubscriptions.has(message.address)) {
          // Cap subscriptions to prevent unbounded memory growth
          if (clientSubscriptions.size >= 100) {
            // Evict entries with 0 active clients
            for (const [addr, clients] of clientSubscriptions) {
              if (clients.size === 0) clientSubscriptions.delete(addr);
              if (clientSubscriptions.size < 100) break;
            }
          }
          clientSubscriptions.set(message.address, new Set());
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
    // Keep Helius WS alive even with no clients — eliminates cold-start delay
  });

  // Send initial connection message with WS mode info
  ws.send(JSON.stringify({
    type: 'connected',
    mode: useEnhancedWs ? 'enhanced' : 'standard',
  }));
});

// ═══════════════════════════════════════════════════════════════════════════
// DLMM SDK ENDPOINTS — Real on-chain bin data + active pricing
//
// These run server-side only (SDK is too heavy for browser).
// Called when a user expands a pool card — not bulk.
// ═══════════════════════════════════════════════════════════════════════════

// Cache DLMM instances briefly to avoid re-fetching on-chain state
const dlmmInstanceCache = new Map(); // address -> { instance, timestamp }
const DLMM_INSTANCE_TTL = 15_000; // 15s

async function getDlmmInstance(address) {
  const cached = dlmmInstanceCache.get(address);
  if (cached && Date.now() - cached.timestamp < DLMM_INSTANCE_TTL) {
    return cached.instance;
  }
  const pubkey = new PublicKey(address);
  const instance = await DLMM.create(solanaConnection, pubkey);
  dlmmInstanceCache.set(address, { instance, timestamp: Date.now() });

  // Evict old entries to prevent memory growth
  if (dlmmInstanceCache.size > 50) {
    const now = Date.now();
    for (const [k, v] of dlmmInstanceCache) {
      if (now - v.timestamp > DLMM_INSTANCE_TTL) dlmmInstanceCache.delete(k);
      if (dlmmInstanceCache.size <= 30) break;
    }
  }

  return instance;
}

// GET /api/pool/:address/bins — Real liquidity distribution from on-chain
app.get('/api/pool/:address/bins', async (req, res) => {
  const { address } = req.params;

  // Validate Solana public key format (32-44 base58 chars)
  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid pool address' });
  }

  // Check cache first
  const cacheKey = `bins:${address}`;
  const cached = cache.get(cacheKey, 10_000); // 10s cache
  if (cached) return res.json(cached);

  try {
    const dlmm = await getDlmmInstance(address);

    // Get active bin (real-time price from chain)
    const activeBin = await dlmm.getActiveBin();

    // Get bins around active bin (±35 bins for a nice chart)
    const binsData = await dlmm.getBinsAroundActiveBin(35, 35);

    // Transform bins into chart-friendly format
    const bins = (binsData?.bins || []).map(bin => ({
      id: bin.binId,
      price: parseFloat(bin.price) || 0,
      xAmount: bin.xAmount?.toString() || '0',
      yAmount: bin.yAmount?.toString() || '0',
      liquidity: parseFloat(bin.xAmount?.toString() || '0') + parseFloat(bin.yAmount?.toString() || '0'),
      supply: bin.supply?.toString() || '0',
      isActive: bin.binId === activeBin.binId,
    }));

    // Get dynamic fee info
    let dynamicFee = null;
    try {
      dynamicFee = dlmm.getDynamicFee();
    } catch { /* not all pools support dynamic fee */ }

    const result = {
      activeBin: {
        binId: activeBin.binId,
        price: parseFloat(activeBin.price) || 0,
        pricePerToken: activeBin.pricePerToken || activeBin.price,
      },
      bins,
      binStep: dlmm.lbPair?.binStep || 0,
      dynamicFee: dynamicFee ? dynamicFee.toString() : null,
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[DLMM SDK] Error fetching bins for ${address}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch bin data', detail: err.message });
  }
});

// GET /api/pool/:address/info — Pool info from SDK (active bin, fee, reserves)
app.get('/api/pool/:address/info', async (req, res) => {
  const { address } = req.params;

  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return res.status(400).json({ error: 'Invalid pool address' });
  }

  const cacheKey = `pool-info:${address}`;
  const cached = cache.get(cacheKey, 10_000);
  if (cached) return res.json(cached);

  try {
    const dlmm = await getDlmmInstance(address);
    const activeBin = await dlmm.getActiveBin();

    let feeInfo = null;
    try {
      feeInfo = dlmm.getFeeInfo();
    } catch { /* ignore */ }

    const result = {
      activeBin: {
        binId: activeBin.binId,
        price: parseFloat(activeBin.price) || 0,
      },
      binStep: dlmm.lbPair?.binStep || 0,
      feeInfo: feeInfo ? {
        baseFee: feeInfo.baseFeeRatePercentage?.toString(),
        maxFee: feeInfo.maxFeeRatePercentage?.toString(),
        protocolFee: feeInfo.protocolFeePercentage?.toString(),
      } : null,
    };

    cache.set(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(`[DLMM SDK] Error fetching pool info for ${address}:`, err.message);
    res.status(500).json({ error: 'Failed to fetch pool info', detail: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY API (preserved for compatibility)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/v1/meteora/analytics', async (req, res) => {
  try {
    const cached = cache.get('analytics', CACHE_TTLS.analytics);
    if (cached) return res.json(cached);

    const response = await rpcFetch(
      'https://dlmm-api.meteora.ag/pair/all',
      {},
      { breaker: breakers.dlmm, retries: 1 }
    );
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
          score: Math.min(99, Math.round(score)),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 200);

    const result = { success: true, count: scored.length, data: scored };
    cache.set('analytics', result);
    res.json(result);
  } catch (err) {
    console.error('[API] Analytics error:', err.message);
    // Serve stale if available
    const stale = cache.get('analytics', Infinity);
    if (stale) {
      res.set('X-Cache-Stale', 'true');
      return res.json(stale);
    }
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
// CACHE WARMING — Pre-fetch pool data on startup so first requests are fast
// ═══════════════════════════════════════════════════════════════════════════
async function warmCache() {
  console.log('[Warmup] Pre-fetching pool data...');

  // DLMM transform — same as the proxy endpoint, strips unused fields (150MB → ~5MB)
  const dlmmTransform = (data) => {
    if (!Array.isArray(data)) return data;
    return data
      .filter(p => p.name && p.address && !p.hide && !p.is_blacklisted && parseFloat(p.liquidity || 0) > 100)
      .map(p => ({
        address: p.address, name: p.name, mint_x: p.mint_x, mint_y: p.mint_y,
        liquidity: p.liquidity, trade_volume_24h: p.trade_volume_24h,
        apr: p.apr, apy: p.apy, fees_24h: p.fees_24h, today_fees: p.today_fees,
        current_price: p.current_price, bin_step: p.bin_step, active_id: p.active_id,
        base_fee_percentage: p.base_fee_percentage, fee_tvl_ratio: p.fee_tvl_ratio,
        fees: p.fees, farm_apr: p.farm_apr, farm_apy: p.farm_apy,
        reward_mint_x: p.reward_mint_x, reward_mint_y: p.reward_mint_y,
        is_verified: p.is_verified, cumulative_fee_volume: p.cumulative_fee_volume,
        cumulative_trade_volume: p.cumulative_trade_volume, tags: p.tags,
      }));
  };

  const sources = [
    { key: 'dlmm', url: 'https://dlmm-api.meteora.ag/pair/all', breaker: breakers.dlmm, transform: dlmmTransform, timeout: 45_000 },
    { key: 'damm', url: 'https://dammv2-api.meteora.ag/pools?limit=200&order_by=tvl&order=desc', breaker: breakers.damm },
    { key: 'raydium', url: 'https://api-v3.raydium.io/pools/info/list?poolType=concentrated&poolSortField=liquidity&sortType=desc&pageSize=200&page=1', breaker: breakers.raydium },
    { key: 'jupiter', url: 'https://api.jup.ag/tokens/v2/tag?query=verified', breaker: breakers.jupiter, headers: { 'x-api-key': JUPITER_API_KEY } },
  ];

  const results = await Promise.allSettled(
    sources.map(async ({ key, url, breaker, headers, transform, timeout }) => {
      try {
        // Register as in-flight so client proxy requests can piggyback
        const fetchPromise = (async () => {
          const response = await rpcFetch(url, headers ? { headers } : {}, { breaker, retries: 1, timeout: timeout || 25_000 });
          let data = await response.json();
          if (transform) {
            const rawCount = Array.isArray(data) ? data.length : '?';
            data = transform(data);
            const trimmedCount = Array.isArray(data) ? data.length : '?';
            console.log(`[Warmup] ${key} cached (${trimmedCount} pools, filtered from ${rawCount})`);
          } else {
            const count = Array.isArray(data) ? data.length + ' items' : (data?.data ? data.data.length + ' items' : 'ok');
            console.log(`[Warmup] ${key} cached (${count})`);
          }
          cache.set(key, data);
          return data;
        })();

        inflightRequests.set(key, fetchPromise);
        await fetchPromise;
        inflightRequests.delete(key);
      } catch (err) {
        inflightRequests.delete(key);
        console.warn(`[Warmup] ${key} failed:`, err.message);
      }
    })
  );

  // Probe Helius endpoints to determine which ones work with this key
  try {
    const probe = await rpcFetch(HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
    }, { breaker: breakers.helius, retries: 0, timeout: 8_000 });
    const health = await probe.json();
    console.log('[Warmup] Helius Gatekeeper beta: OK', health.result || '');
  } catch (err) {
    console.warn('[Warmup] Helius Gatekeeper beta unavailable:', err.message);
  }

  // Probe standard RPC separately — some keys only work on Gatekeeper
  try {
    const probe2 = await fetch(HELIUS_RPC_FALLBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
      signal: AbortSignal.timeout(8_000),
    });
    if (probe2.ok) {
      console.log('[Warmup] Helius standard RPC: OK');
    } else {
      standardRpcDisabled = true;
      console.warn(`[Warmup] Helius standard RPC: HTTP ${probe2.status} — disabled, using Gatekeeper + public fallback`);
    }
  } catch (err2) {
    console.warn('[Warmup] Helius standard RPC probe failed:', err2.message);
  }

  // Check if neither Helius endpoint works
  if (breakers.helius.state === 'open' && standardRpcDisabled) {
    console.warn('[Warmup] Both Helius endpoints unavailable — transactions will use public Solana RPC');
    wsAuthFailed = true;
  }

  console.log('[Warmup] Done');
}

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════
const PORT = Number(process.env.PORT) || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] RPC: beta.helius-rpc.com (Gatekeeper beta)`);
  console.log(`[Server] WS: atlas-mainnet.helius-rpc.com (Enhanced WebSockets)`);
  console.log(`[Server] Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
  // Connect to Helius WS at startup (not lazily on first client)
  connectToHelius();
  // Warm cache in background after server starts accepting connections
  warmCache().catch(err => console.error('[Warmup] Error:', err.message));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down...');
  clearInterval(wsHeartbeat);
  clearTimeout(reconnectTimeout);
  if (heliusWs) heliusWs.close();
  wss.close();
  server.close(() => {
    process.exit(0);
  });
});
