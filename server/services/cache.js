// server/services/cache.js
// In-memory cache layer for ultra-fast API responses
// Reduces database queries and provides instant data access

// Cache configuration
const CACHE_TTL = {
  pools: 15000,           // 15 seconds
  opportunities: 15000,   // 15 seconds
  transactions: 5000,     // 5 seconds
  poolDetails: 30000,     // 30 seconds
  stats: 60000            // 1 minute
};

// Cache storage
const cache = new Map();
const cacheTimestamps = new Map();

/**
 * Get item from cache if not expired
 */
export function get(key) {
  const timestamp = cacheTimestamps.get(key);
  const ttl = getCacheTTL(key);

  if (timestamp && Date.now() - timestamp < ttl) {
    return cache.get(key);
  }

  return null;
}

/**
 * Set item in cache
 */
export function set(key, value) {
  cache.set(key, value);
  cacheTimestamps.set(key, Date.now());
  return value;
}

/**
 * Invalidate specific cache key
 */
export function invalidate(key) {
  cache.delete(key);
  cacheTimestamps.delete(key);
}

/**
 * Invalidate all caches matching a pattern
 */
export function invalidatePattern(pattern) {
  const regex = new RegExp(pattern);
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      cacheTimestamps.delete(key);
    }
  }
}

/**
 * Clear all caches
 */
export function clear() {
  cache.clear();
  cacheTimestamps.clear();
}

/**
 * Get cache TTL for a key type
 */
function getCacheTTL(key) {
  if (key.startsWith('pools')) return CACHE_TTL.pools;
  if (key.startsWith('opportunities')) return CACHE_TTL.opportunities;
  if (key.startsWith('transactions')) return CACHE_TTL.transactions;
  if (key.startsWith('pool_')) return CACHE_TTL.poolDetails;
  if (key.startsWith('stats')) return CACHE_TTL.stats;
  return 30000; // Default 30 seconds
}

/**
 * Get or compute cached value
 * If cache miss, calls computeFn and caches the result
 */
export async function getOrCompute(key, computeFn) {
  const cached = get(key);
  if (cached !== null) {
    return cached;
  }

  const value = await computeFn();
  return set(key, value);
}

/**
 * Get cache statistics
 */
export function getStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const [key, timestamp] of cacheTimestamps) {
    if (now - timestamp < getCacheTTL(key)) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: cache.size,
    validEntries,
    expiredEntries,
    memoryUsage: process.memoryUsage().heapUsed
  };
}

/**
 * Cleanup expired entries periodically
 */
export function cleanup() {
  const now = Date.now();
  const keysToDelete = [];

  for (const [key, timestamp] of cacheTimestamps) {
    if (now - timestamp > getCacheTTL(key) * 2) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    cache.delete(key);
    cacheTimestamps.delete(key);
  }

  return keysToDelete.length;
}

// Run cleanup every 5 minutes
setInterval(cleanup, 300000);

export default {
  get,
  set,
  invalidate,
  invalidatePattern,
  clear,
  getOrCompute,
  getStats,
  cleanup
};
