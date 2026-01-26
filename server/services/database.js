// server/services/database.js
// SQLite database for storing pools, transactions, and historical metrics
// Provides institutional-grade data persistence without external dependencies

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file location
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/meteora.db');

let db = null;

/**
 * Initialize the database with all required tables
 */
export function initDatabase() {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = 10000');

  // Create tables
  db.exec(`
    -- Pools table: stores all Meteora pool data
    CREATE TABLE IF NOT EXISTS pools (
      address TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      protocol TEXT NOT NULL,
      mint_x TEXT,
      mint_y TEXT,
      tvl REAL DEFAULT 0,
      volume_24h REAL DEFAULT 0,
      fees_24h REAL DEFAULT 0,
      fees_1h REAL DEFAULT 0,
      apr REAL DEFAULT 0,
      apy REAL DEFAULT 0,
      score INTEGER DEFAULT 50,
      safety TEXT DEFAULT 'warning',
      has_farm INTEGER DEFAULT 0,
      farm_active INTEGER DEFAULT 0,
      farm_apr REAL DEFAULT 0,
      bin_step INTEGER DEFAULT 1,
      current_price REAL DEFAULT 0,
      fee_tvl_ratio REAL DEFAULT 0,
      fee_tvl_ratio_1h REAL DEFAULT 0,
      volume_to_tvl REAL DEFAULT 0,
      is_hot INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 0,
      is_blacklisted INTEGER DEFAULT 0,
      raw_data TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Transactions table: stores recent pool transactions
    CREATE TABLE IF NOT EXISTS transactions (
      signature TEXT PRIMARY KEY,
      pool_address TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      raw_data TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (pool_address) REFERENCES pools(address)
    );

    -- Pool metrics history: stores hourly snapshots for trend analysis
    CREATE TABLE IF NOT EXISTS pool_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_address TEXT NOT NULL,
      tvl REAL,
      volume REAL,
      fees REAL,
      apr REAL,
      snapshot_time INTEGER NOT NULL,
      FOREIGN KEY (pool_address) REFERENCES pools(address)
    );

    -- Verified tokens cache
    CREATE TABLE IF NOT EXISTS verified_tokens (
      mint TEXT PRIMARY KEY,
      symbol TEXT,
      name TEXT,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- User alerts (server-side for persistence)
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_address TEXT,
      pool_name TEXT,
      condition TEXT NOT NULL,
      value REAL NOT NULL,
      active INTEGER DEFAULT 1,
      triggered INTEGER DEFAULT 0,
      triggered_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- System metadata
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    -- Create indexes for fast queries
    CREATE INDEX IF NOT EXISTS idx_pools_score ON pools(score DESC);
    CREATE INDEX IF NOT EXISTS idx_pools_tvl ON pools(tvl DESC);
    CREATE INDEX IF NOT EXISTS idx_pools_volume ON pools(volume_24h DESC);
    CREATE INDEX IF NOT EXISTS idx_pools_apr ON pools(apr DESC);
    CREATE INDEX IF NOT EXISTS idx_pools_fees ON pools(fees_24h DESC);
    CREATE INDEX IF NOT EXISTS idx_pools_updated ON pools(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pools_safety ON pools(safety);
    CREATE INDEX IF NOT EXISTS idx_pools_protocol ON pools(protocol);
    CREATE INDEX IF NOT EXISTS idx_pools_hot ON pools(is_hot);

    CREATE INDEX IF NOT EXISTS idx_tx_pool ON transactions(pool_address);
    CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_pool_time ON transactions(pool_address, timestamp DESC);

    CREATE INDEX IF NOT EXISTS idx_metrics_pool_time ON pool_metrics(pool_address, snapshot_time DESC);
  `);

  console.log('[DB] Database initialized at', DB_PATH);
  return db;
}

/**
 * Get database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ═══════════════════════════════════════════════════════════════════════════
// POOL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upsert a pool (insert or update)
 */
export function upsertPool(pool) {
  const stmt = db.prepare(`
    INSERT INTO pools (
      address, name, protocol, mint_x, mint_y, tvl, volume_24h, fees_24h, fees_1h,
      apr, apy, score, safety, has_farm, farm_active, farm_apr, bin_step,
      current_price, fee_tvl_ratio, fee_tvl_ratio_1h, volume_to_tvl, is_hot,
      is_verified, is_blacklisted, raw_data, updated_at
    ) VALUES (
      @address, @name, @protocol, @mint_x, @mint_y, @tvl, @volume_24h, @fees_24h, @fees_1h,
      @apr, @apy, @score, @safety, @has_farm, @farm_active, @farm_apr, @bin_step,
      @current_price, @fee_tvl_ratio, @fee_tvl_ratio_1h, @volume_to_tvl, @is_hot,
      @is_verified, @is_blacklisted, @raw_data, strftime('%s', 'now')
    )
    ON CONFLICT(address) DO UPDATE SET
      name = @name,
      tvl = @tvl,
      volume_24h = @volume_24h,
      fees_24h = @fees_24h,
      fees_1h = @fees_1h,
      apr = @apr,
      apy = @apy,
      score = @score,
      safety = @safety,
      has_farm = @has_farm,
      farm_active = @farm_active,
      farm_apr = @farm_apr,
      current_price = @current_price,
      fee_tvl_ratio = @fee_tvl_ratio,
      fee_tvl_ratio_1h = @fee_tvl_ratio_1h,
      volume_to_tvl = @volume_to_tvl,
      is_hot = @is_hot,
      is_verified = @is_verified,
      raw_data = @raw_data,
      updated_at = strftime('%s', 'now')
  `);

  return stmt.run({
    address: pool.address || pool.id,
    name: pool.name || 'Unknown',
    protocol: pool.protocol || 'Meteora',
    mint_x: pool.mintX || null,
    mint_y: pool.mintY || null,
    tvl: pool.tvl || 0,
    volume_24h: pool.volume || 0,
    fees_24h: pool.fees || 0,
    fees_1h: pool.fees1h || 0,
    apr: parseFloat(pool.apr) || 0,
    apy: parseFloat(pool.apy) || 0,
    score: pool.score || 50,
    safety: pool.safety || 'warning',
    has_farm: pool.hasFarm ? 1 : 0,
    farm_active: pool.farmActive ? 1 : 0,
    farm_apr: parseFloat(pool.farmApr) || 0,
    bin_step: pool.binStep || 1,
    current_price: pool.currentPrice || 0,
    fee_tvl_ratio: pool.feeTvlRatio || 0,
    fee_tvl_ratio_1h: pool.feeTvlRatio1h || 0,
    volume_to_tvl: pool.volumeToTvl || 0,
    is_hot: pool.isHot ? 1 : 0,
    is_verified: pool.tokensVerified ? 1 : 0,
    is_blacklisted: pool.isBlacklisted ? 1 : 0,
    raw_data: JSON.stringify(pool)
  });
}

/**
 * Bulk upsert pools (transaction for performance)
 */
export function upsertPools(pools) {
  const insert = db.transaction((pools) => {
    for (const pool of pools) {
      upsertPool(pool);
    }
  });
  return insert(pools);
}

/**
 * Get all pools with optional filters
 */
export function getPools(options = {}) {
  const {
    limit = 500,
    offset = 0,
    sortBy = 'score',
    sortOrder = 'DESC',
    minTvl = 0,
    minVolume = 0,
    safety = null,
    protocol = null,
    farmOnly = false,
    hotOnly = false,
    search = null
  } = options;

  let where = ['1=1'];
  const params = {};

  if (minTvl > 0) {
    where.push('tvl >= @minTvl');
    params.minTvl = minTvl;
  }

  if (minVolume > 0) {
    where.push('volume_24h >= @minVolume');
    params.minVolume = minVolume;
  }

  if (safety && safety !== 'all') {
    if (safety === 'safe') {
      where.push("safety = 'safe'");
    } else if (safety === 'exclude-danger') {
      where.push("safety != 'danger'");
    }
  }

  if (protocol && protocol !== 'all') {
    where.push('protocol LIKE @protocol');
    params.protocol = `%${protocol}%`;
  }

  if (farmOnly) {
    where.push('farm_active = 1');
  }

  if (hotOnly) {
    where.push('is_hot = 1');
  }

  if (search) {
    where.push('(name LIKE @search OR address LIKE @search OR mint_x LIKE @search OR mint_y LIKE @search)');
    params.search = `%${search}%`;
  }

  // Validate sortBy to prevent SQL injection
  const validSortColumns = ['score', 'tvl', 'volume_24h', 'fees_24h', 'fees_1h', 'apr', 'updated_at', 'fee_tvl_ratio'];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'score';
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const sql = `
    SELECT * FROM pools
    WHERE ${where.join(' AND ')}
    ORDER BY ${sortColumn} ${order}
    LIMIT @limit OFFSET @offset
  `;

  params.limit = limit;
  params.offset = offset;

  const stmt = db.prepare(sql);
  const rows = stmt.all(params);

  // Parse raw_data JSON for full pool objects
  return rows.map(row => {
    try {
      const pool = JSON.parse(row.raw_data);
      // Override with latest DB values
      pool.tvl = row.tvl;
      pool.volume = row.volume_24h;
      pool.fees = row.fees_24h;
      pool.fees1h = row.fees_1h;
      pool.apr = row.apr.toFixed(2);
      pool.score = row.score;
      pool.safety = row.safety;
      pool.isHot = row.is_hot === 1;
      return pool;
    } catch {
      return row;
    }
  });
}

/**
 * Get pool by address
 */
export function getPoolByAddress(address) {
  const stmt = db.prepare('SELECT * FROM pools WHERE address = ?');
  const row = stmt.get(address);
  if (!row) return null;

  try {
    return JSON.parse(row.raw_data);
  } catch {
    return row;
  }
}

/**
 * Get pool count
 */
export function getPoolCount(options = {}) {
  let where = ['1=1'];
  const params = {};

  if (options.minTvl > 0) {
    where.push('tvl >= @minTvl');
    params.minTvl = options.minTvl;
  }

  if (options.safety && options.safety !== 'all') {
    if (options.safety === 'safe') {
      where.push("safety = 'safe'");
    } else if (options.safety === 'exclude-danger') {
      where.push("safety != 'danger'");
    }
  }

  const stmt = db.prepare(`SELECT COUNT(*) as count FROM pools WHERE ${where.join(' AND ')}`);
  return stmt.get(params).count;
}

/**
 * Get opportunities (hot/high-performing pools)
 */
export function getOpportunities(limit = 12) {
  const stmt = db.prepare(`
    SELECT * FROM pools
    WHERE (
      (is_hot = 1 AND safety = 'safe' AND tvl > 5000) OR
      (fees_1h > 0 AND tvl > 0 AND (fees_1h / tvl) > 0.001 AND safety = 'safe') OR
      (volume_to_tvl > 0.3 AND safety = 'safe' AND tvl > 20000) OR
      (apr > 30 AND safety = 'safe' AND score >= 65) OR
      (score >= 80 AND safety = 'safe') OR
      (farm_active = 1 AND safety = 'safe' AND tvl > 10000) OR
      (fee_tvl_ratio > 0.01 AND safety = 'safe')
    )
    ORDER BY
      CASE
        WHEN is_hot = 1 THEN 0
        WHEN fees_1h > 0 AND tvl > 0 AND (fees_1h / tvl) > 0.001 THEN 1
        ELSE 2
      END,
      score DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit);
  return rows.map(row => {
    try {
      const pool = JSON.parse(row.raw_data);
      pool.isHot = row.is_hot === 1;
      pool.score = row.score;
      pool.tvl = row.tvl;
      pool.fees1h = row.fees_1h;
      return pool;
    } catch {
      return row;
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Insert a transaction
 */
export function insertTransaction(tx) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO transactions (signature, pool_address, type, amount, timestamp, raw_data)
    VALUES (@signature, @pool_address, @type, @amount, @timestamp, @raw_data)
  `);

  return stmt.run({
    signature: tx.signature,
    pool_address: tx.poolAddress || tx.pool_address,
    type: tx.type || 'swap',
    amount: parseFloat(tx.amount) || 0,
    timestamp: tx.timestamp || Date.now(),
    raw_data: JSON.stringify(tx)
  });
}

/**
 * Bulk insert transactions
 */
export function insertTransactions(transactions) {
  const insert = db.transaction((txs) => {
    for (const tx of txs) {
      insertTransaction(tx);
    }
  });
  return insert(transactions);
}

/**
 * Get transactions for a pool
 */
export function getPoolTransactions(poolAddress, limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM transactions
    WHERE pool_address = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  return stmt.all(poolAddress, limit).map(row => {
    try {
      return JSON.parse(row.raw_data);
    } catch {
      return {
        id: row.signature,
        signature: row.signature,
        type: row.type,
        amount: row.amount.toFixed(2),
        timestamp: row.timestamp
      };
    }
  });
}

/**
 * Get recent transactions across all pools
 */
export function getRecentTransactions(limit = 50) {
  const stmt = db.prepare(`
    SELECT t.*, p.name as pool_name
    FROM transactions t
    LEFT JOIN pools p ON t.pool_address = p.address
    ORDER BY t.timestamp DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

/**
 * Clean old transactions (keep last 24 hours)
 */
export function cleanOldTransactions() {
  const stmt = db.prepare(`
    DELETE FROM transactions
    WHERE timestamp < strftime('%s', 'now', '-24 hours') * 1000
  `);
  return stmt.run();
}

// ═══════════════════════════════════════════════════════════════════════════
// METRICS/HISTORY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Save pool metrics snapshot
 */
export function savePoolMetrics(poolAddress, metrics) {
  const stmt = db.prepare(`
    INSERT INTO pool_metrics (pool_address, tvl, volume, fees, apr, snapshot_time)
    VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'))
  `);

  return stmt.run(
    poolAddress,
    metrics.tvl || 0,
    metrics.volume || 0,
    metrics.fees || 0,
    metrics.apr || 0
  );
}

/**
 * Get pool metrics history
 */
export function getPoolMetricsHistory(poolAddress, hours = 24) {
  const stmt = db.prepare(`
    SELECT * FROM pool_metrics
    WHERE pool_address = ? AND snapshot_time > strftime('%s', 'now', '-' || ? || ' hours')
    ORDER BY snapshot_time ASC
  `);

  return stmt.all(poolAddress, hours);
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFIED TOKENS OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Upsert verified tokens
 */
export function upsertVerifiedTokens(tokens) {
  const stmt = db.prepare(`
    INSERT INTO verified_tokens (mint, symbol, name, updated_at)
    VALUES (@mint, @symbol, @name, strftime('%s', 'now'))
    ON CONFLICT(mint) DO UPDATE SET
      symbol = @symbol,
      name = @name,
      updated_at = strftime('%s', 'now')
  `);

  const insert = db.transaction((tokens) => {
    for (const token of tokens) {
      stmt.run({
        mint: typeof token === 'string' ? token : token.address || token.mint,
        symbol: token.symbol || null,
        name: token.name || null
      });
    }
  });

  return insert(tokens);
}

/**
 * Get all verified token mints
 */
export function getVerifiedTokens() {
  const stmt = db.prepare('SELECT mint FROM verified_tokens');
  return new Set(stmt.all().map(row => row.mint));
}

/**
 * Check if token is verified
 */
export function isTokenVerified(mint) {
  const stmt = db.prepare('SELECT 1 FROM verified_tokens WHERE mint = ?');
  return stmt.get(mint) !== undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// METADATA OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Set metadata value
 */
export function setMetadata(key, value) {
  const stmt = db.prepare(`
    INSERT INTO metadata (key, value, updated_at)
    VALUES (?, ?, strftime('%s', 'now'))
    ON CONFLICT(key) DO UPDATE SET
      value = ?,
      updated_at = strftime('%s', 'now')
  `);
  return stmt.run(key, value, value);
}

/**
 * Get metadata value
 */
export function getMetadata(key) {
  const stmt = db.prepare('SELECT value FROM metadata WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP & MAINTENANCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clean up old data
 */
export function cleanup() {
  // Remove transactions older than 24 hours
  cleanOldTransactions();

  // Remove metrics older than 7 days
  db.prepare(`
    DELETE FROM pool_metrics
    WHERE snapshot_time < strftime('%s', 'now', '-7 days')
  `).run();

  // Vacuum to reclaim space
  db.pragma('vacuum');

  console.log('[DB] Cleanup completed');
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database closed');
  }
}

export default {
  initDatabase,
  getDb,
  upsertPool,
  upsertPools,
  getPools,
  getPoolByAddress,
  getPoolCount,
  getOpportunities,
  insertTransaction,
  insertTransactions,
  getPoolTransactions,
  getRecentTransactions,
  cleanOldTransactions,
  savePoolMetrics,
  getPoolMetricsHistory,
  upsertVerifiedTokens,
  getVerifiedTokens,
  isTokenVerified,
  setMetadata,
  getMetadata,
  cleanup,
  closeDatabase
};
