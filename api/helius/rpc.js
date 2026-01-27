// Vercel Serverless Function - Helius RPC Proxy
// API key is stored in Vercel environment variables for security

const HELIUS_KEY = process.env.HELIUS_KEY || '66097387-f0e6-4f93-a800-dbaac4a4c113';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;

// Simple in-memory cache (resets on cold start, but helps with warm invocations)
const cache = new Map();
const CACHE_TTLS = {
  getBalance: 10000,
  getSignaturesForAddress: 5000,
  getTransaction: 60000
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
  if (cache.size > 50) {
    const keys = Array.from(cache.keys()).slice(0, 10);
    keys.forEach(k => cache.delete(k));
  }
  cache.set(key, { data, timestamp: Date.now() });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { method, params } = req.body;

    if (!method) {
      return res.status(400).json({ error: 'Missing method' });
    }

    // Check cache
    let cacheKey = null;
    let cacheTTL = CACHE_TTLS[method] || 0;

    if (cacheTTL && params?.[0]) {
      cacheKey = `${method}:${JSON.stringify(params).slice(0, 100)}`;
      const cached = getCached(cacheKey, cacheTTL);
      if (cached) return res.status(200).json(cached);
    }

    const response = await fetch(HELIUS_RPC, {
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

    res.status(200).json(data);
  } catch (err) {
    console.error('[Helius] RPC error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
