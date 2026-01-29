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
  // Deterministic pseudo-random variation seeded by bin index and basePrice
  // Avoids Math.random() which causes chart flicker on every refresh
  const seed = Math.abs(basePrice * 1000) % 1000;
  for (let i = 0; i < 21; i++) {
    const dist = Math.abs(i - 10);
    const variation = ((seed + i * 37) % 12); // deterministic 0-11 per bin
    bins.push({
      id: 1000 + i,
      price: basePrice + (i - 10) * basePrice * 0.0025,
      liquidity: Math.max(5, 100 - dist * 6 + variation),
      isActive: i === 10,
    });
  }
  return bins;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPPORTUNITY DETECTION — matches original monolith logic exactly
// ═══════════════════════════════════════════════════════════════════════════

export function detectOpportunities(filteredPools: Pool[]): Opportunity[] {
  const opps: Opportunity[] = filteredPools
    .filter(
      (p) =>
        (p.isHot && p.safety === 'safe' && p.tvl > 5000) ||
        ((p.fees1h ?? 0) > 0 && p.tvl > 0 && ((p.fees1h ?? 0) / p.tvl) > 0.001 && p.safety === 'safe') ||
        (p.volumeToTvl > 0.3 && p.safety === 'safe' && p.tvl > 20000) ||
        (parseFloat(p.apr) > 30 && p.safety === 'safe' && p.score >= 65) ||
        (p.score >= 80 && p.safety === 'safe') ||
        (p.farmActive && p.safety === 'safe' && p.tvl > 10000) ||
        ((p.feeTvlRatio ?? 0) > 0.01 && p.safety === 'safe')
    )
    .slice(0, 12)
    .map((p) => {
      let reason = '';
      let oppType: OppType = 'standard';

      if (p.isHot && (p.fees1h ?? 0) > 0) {
        oppType = 'hot';
        const projected = (p.fees1h ?? 0) * 24;
        reason = `🔥 FEE SPIKE: 1h fees ${formatNumber(p.fees1h)} → projected ${formatNumber(projected)}/day`;
      } else if ((p.fees1h ?? 0) > 0 && p.tvl > 0 && ((p.fees1h ?? 0) / p.tvl) > 0.001) {
        oppType = 'active';
        reason = `⚡ ACTIVE: ${formatNumber(p.fees1h)} fees in last hour`;
      } else if (p.farmActive) {
        reason = `🌾 FARM: ${p.apr}% APR + farm rewards`;
      } else if (p.volumeToTvl > 0.5) {
        reason = `📈 HIGH VOLUME: ${(p.volumeToTvl * 100).toFixed(0)}% vol/TVL ratio`;
      } else if (parseFloat(p.apr) > 50) {
        reason = `💰 HIGH APR: ${p.apr}%`;
      } else if ((p.feeTvlRatio ?? 0) > 0.01) {
        reason = `📊 EFFICIENT: ${((p.feeTvlRatio ?? 0) * 100).toFixed(2)}% fee/TVL`;
      } else {
        reason = `⭐ TOP SCORER: ${p.score} points`;
      }

      return { ...p, reason, oppType };
    });

  opps.sort((a, b) => {
    const typeOrder: Record<OppType, number> = { hot: 0, active: 1, standard: 2 };
    return (typeOrder[a.oppType] ?? 2) - (typeOrder[b.oppType] ?? 2);
  });

  return opps;
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
