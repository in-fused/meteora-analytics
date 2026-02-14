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

export const copyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

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
  permanentLockLiquidity?: number,
  apiVerified?: boolean
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
  if (apiVerified) score += 3;

  return Math.min(99, Math.max(10, Math.round(score)));
}

export function getScoreClass(score: number): string {
  if (score >= 75) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
}

export function isHotPool(pool: Pool): boolean {
  if (!pool.fees1h || !pool.fees24h || pool.fees24h === 0) return false;
  return pool.fees1h * 24 > pool.fees24h * 1.5;
}

// ═══════════════════════════════════════════════════════════════════════════
// BINS / CHART — matches original monolith formula exactly
// ═══════════════════════════════════════════════════════════════════════════

export function generateBins(basePrice: number): Bin[] {
  const bins: Bin[] = [];
  for (let i = 0; i < 21; i++) {
    const dist = Math.abs(i - 10);
    bins.push({
      id: 1000 + i,
      price: basePrice + (i - 10) * basePrice * 0.0025,
      liquidity: Math.max(5, 100 - dist * 6 + Math.random() * 12),
      isActive: i === 10,
    });
  }
  return bins;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPPORTUNITY DETECTION — Tiered scoring with weighted ranking
// ═══════════════════════════════════════════════════════════════════════════

export function detectOpportunities(filteredPools: Pool[]): Opportunity[] {
  // Only consider safe pools with some activity
  const candidates = filteredPools.filter(p => p.safety === 'safe' && p.tvl > 1000);

  // Score each candidate across multiple opportunity signals
  const scored: { pool: Pool; oppScore: number; reason: string; oppType: OppType }[] = [];

  for (const p of candidates) {
    let oppScore = 0;
    let reason = '';
    let oppType: OppType = 'standard';

    const fees1h = p.fees1h ?? 0;
    const feeTvl = p.feeTvlRatio ?? 0;
    const apr = parseFloat(p.apr);

    // Tier 1: Fee spike detection (HOT)
    if (p.isHot && fees1h > 0 && p.tvl > 5000) {
      oppScore += 50;
      oppType = 'hot';
      const projected = fees1h * 24;
      reason = `FEE SPIKE: 1h fees ${formatNumber(fees1h)} → projected ${formatNumber(projected)}/day`;
    }

    // Tier 2: Active fee generation
    if (fees1h > 0 && p.tvl > 0 && (fees1h / p.tvl) > 0.0005) {
      oppScore += 35;
      if (!reason) {
        oppType = 'active';
        reason = `ACTIVE: ${formatNumber(fees1h)} fees in last hour (${((fees1h / p.tvl) * 100).toFixed(3)}% of TVL)`;
      }
    }

    // Tier 3: High volume/TVL ratio
    if (p.volumeToTvl > 0.3 && p.tvl > 10000) {
      oppScore += 20;
      if (!reason) reason = `HIGH VOLUME: ${(p.volumeToTvl * 100).toFixed(0)}% vol/TVL ratio`;
    }

    // Tier 4: Strong APR
    if (apr > 30 && p.score >= 60) {
      oppScore += 15;
      if (!reason) reason = `HIGH APR: ${p.apr}% with score ${p.score}`;
    }

    // Tier 5: Elite score
    if (p.score >= 80) {
      oppScore += 10;
      if (!reason) reason = `TOP SCORER: ${p.score} points`;
    }

    // Tier 6: Active farm rewards
    if (p.farmActive && p.tvl > 5000) {
      oppScore += 12;
      if (!reason) reason = `FARM: ${p.apr}% APR + farm rewards (${p.farmApr ?? 0}% bonus)`;
    }

    // Tier 7: Efficient fee/TVL
    if (feeTvl > 0.005) {
      oppScore += 8;
      if (!reason) reason = `EFFICIENT: ${(feeTvl * 100).toFixed(2)}% fee/TVL ratio`;
    }

    // Must have at least one signal
    if (oppScore > 0 && reason) {
      scored.push({ pool: p, oppScore, reason, oppType });
    }
  }

  // Sort by opportunity score (highest first), then by pool score
  scored.sort((a, b) => b.oppScore - a.oppScore || b.pool.score - a.pool.score);

  // Take top 15, then group by type
  return scored.slice(0, 15).map(({ pool, reason, oppType }) => ({
    ...pool,
    reason,
    oppType,
  }));
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
