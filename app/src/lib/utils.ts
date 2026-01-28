import type { Bin, SafetyLevel, Pool, Opportunity, OppType } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

export function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '$0';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}

export function formatPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

export function formatTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60000) return Math.floor(d / 1000) + 's';
  if (d < 3600000) return Math.floor(d / 60000) + 'm';
  return Math.floor(d / 3600000) + 'h';
}

export function truncate(s: string | null | undefined, l = 8): string {
  if (!s) return '';
  return s.length > l ? s.slice(0, l) + '...' : s;
}

export function shortenAddress(a: string | null | undefined, c = 4): string {
  if (!a) return '';
  return `${a.slice(0, c)}...${a.slice(-c)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING & SAFETY
// ═══════════════════════════════════════════════════════════════════════════

export function calculateSafety(
  mintX: string,
  mintY: string,
  tvl: number,
  verifiedTokens: Set<string>,
  apiVerified?: boolean,
  isBlacklisted?: boolean
): SafetyLevel {
  if (isBlacklisted) return 'danger';
  const xV = verifiedTokens.has(mintX);
  const yV = verifiedTokens.has(mintY);
  if (apiVerified || (xV && yV)) return 'safe';
  if (!xV && !yV && tvl < 10000) return 'danger';
  return 'warning';
}

export function calculateScore(
  tvl: number,
  volume: number,
  apr: number,
  safety: SafetyLevel,
  hasFarm?: boolean,
  farmActive?: boolean,
  permanentLockLiquidity?: number
): number {
  let score = 50;
  if (tvl > 500000) score += 20;
  else if (tvl > 100000) score += 15;
  else if (tvl > 10000) score += 10;

  if (volume > 100000) score += 15;
  else if (volume > 10000) score += 10;
  else if (volume > 1000) score += 5;

  if (apr > 100) score += 10;
  else if (apr > 50) score += 7;
  else if (apr > 20) score += 4;

  if (safety === 'safe') score += 5;
  else if (safety === 'danger') score -= 15;

  if (hasFarm) score += 3;
  if (farmActive) score += 5;
  if ((permanentLockLiquidity ?? 0) > 0) score += 3;

  return Math.min(99, Math.max(10, Math.round(score)));
}

export function getScoreClass(score: number): string {
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

export function isHotPool(pool: Pool): boolean {
  if (!pool.fees1h || !pool.fees24h || pool.fees24h === 0) return false;
  return pool.fees1h * 24 > pool.fees24h * 1.5;
}

// ═══════════════════════════════════════════════════════════════════════════
// BINS / CHART
// ═══════════════════════════════════════════════════════════════════════════

export function generateBins(currentPrice: number): Bin[] {
  const bins: Bin[] = [];
  const spread = currentPrice * 0.1;
  for (let i = 0; i < 21; i++) {
    const price = currentPrice - spread + (spread * 2 * i) / 20;
    const distFromCenter = Math.abs(i - 10) / 10;
    const liquidity = Math.max(5, 80 * (1 - distFromCenter * 0.7) + Math.random() * 20);
    bins.push({ id: i, price, liquidity, isActive: i === 10 });
  }
  return bins;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPPORTUNITY DETECTION
// ═══════════════════════════════════════════════════════════════════════════

export function detectOpportunities(pools: Pool[]): Opportunity[] {
  const opps: Opportunity[] = [];

  for (const pool of pools) {
    if (pool.safety === 'danger') continue;

    let reason = '';
    let oppType: OppType = 'standard';

    // Hot + safe + decent TVL
    if (pool.isHot && pool.safety === 'safe' && pool.tvl > 5000) {
      reason = `Hot pool with ${pool.fees1h ? formatNumber(pool.fees1h) : 'high'} fees/1h and ${formatNumber(pool.tvl)} TVL`;
      oppType = 'hot';
    }
    // High fee velocity
    else if ((pool.feeTvlRatio ?? 0) > 0.001 && pool.safety === 'safe') {
      reason = `Fee/TVL ratio of ${((pool.feeTvlRatio ?? 0) * 100).toFixed(2)}% indicates high fee velocity`;
      oppType = 'active';
    }
    // High volume-to-TVL
    else if (pool.volumeToTvl > 0.3 && pool.safety === 'safe') {
      reason = `Volume/TVL ratio of ${(pool.volumeToTvl * 100).toFixed(0)}% shows strong trading activity`;
      oppType = 'active';
    }
    // High APR + safe + good score
    else if (parseFloat(pool.apr) > 30 && pool.safety === 'safe' && pool.score >= 65) {
      reason = `${pool.apr}% APR with safety verified and score of ${pool.score}`;
      oppType = 'standard';
    }
    // Excellent score
    else if (pool.score >= 80 && pool.safety === 'safe') {
      reason = `Elite score of ${pool.score} with verified tokens and strong metrics`;
      oppType = 'standard';
    }
    // Active farms
    else if (pool.farmActive && pool.safety === 'safe' && pool.tvl > 10000) {
      reason = `Active farming rewards with ${pool.farmApr ? pool.farmApr.toFixed(1) + '% farm APR' : 'boosted yields'}`;
      oppType = 'standard';
    }
    // Excellent fee/TVL
    else if ((pool.feeTvlRatio ?? 0) > 0.01 && pool.safety !== 'danger') {
      reason = `Outstanding fee/TVL ratio generating exceptional returns`;
      oppType = 'active';
    } else {
      continue;
    }

    opps.push({ ...pool, reason, oppType });
  }

  // Sort: hot first, then by score
  return opps.sort((a, b) => {
    const typeOrder: Record<OppType, number> = { hot: 0, active: 1, standard: 2 };
    if (typeOrder[a.oppType] !== typeOrder[b.oppType]) {
      return typeOrder[a.oppType] - typeOrder[b.oppType];
    }
    return b.score - a.score;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// POOL URL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function getPoolUrl(pool: Pool): string {
  const addr = pool.address || pool.id;
  if (pool.protocol === 'Raydium CLMM') {
    return `https://raydium.io/clmm/create-position/?pool_id=${addr}`;
  }
  if (pool.protocol === 'Meteora DLMM') {
    return `https://app.meteora.ag/dlmm/${addr}`;
  }
  return `https://app.meteora.ag/dammv2/${addr}`;
}

export function getPoolDexName(pool: Pool): string {
  return pool.protocol === 'Raydium CLMM' ? 'Raydium' : 'Meteora';
}

export function getPoolTypeLabel(pool: Pool): string {
  if (pool.protocol === 'Raydium CLMM') return 'CLMM';
  if (pool.protocol === 'Meteora DLMM') return 'DLMM';
  return 'DAMM';
}
