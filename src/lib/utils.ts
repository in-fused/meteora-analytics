import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATTING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export const formatNumber = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '$0';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
};

export const formatPrice = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1000) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
};

export const formatTime = (ts: number): string => {
  const d = Date.now() - ts;
  if (d < 60000) return Math.floor(d / 1000) + 's';
  if (d < 3600000) return Math.floor(d / 60000) + 'm';
  return Math.floor(d / 3600000) + 'h';
};

export const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const truncate = (s: string | null | undefined, l = 8): string => {
  return s ? (s.length > l ? s.slice(0, l) + '...' : s) : '';
};

export const shortenAddress = (a: string | null | undefined, c = 4): string => {
  return a ? `${a.slice(0, c)}...${a.slice(-c)}` : '';
};

export const copyIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;

// ═══════════════════════════════════════════════════════════════════════════
// SCORING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export const calculateScore = (pool: {
  tvl: number;
  volume: number;
  apr: number | string;
  fees: number;
  safety: string;
  hasFarm?: boolean;
  farmActive?: boolean;
  tokensVerified?: boolean;
}): number => {
  let score = 50;
  const tvl = pool.tvl;
  const volume = pool.volume;
  const apr = typeof pool.apr === 'string' ? parseFloat(pool.apr) : pool.apr;
  
  // TVL scoring
  if (tvl > 500000) score += 20;
  else if (tvl > 100000) score += 15;
  else if (tvl > 10000) score += 10;
  
  // Volume scoring
  if (volume > 100000) score += 15;
  else if (volume > 10000) score += 10;
  else if (volume > 1000) score += 5;
  
  // APR scoring
  if (apr > 100) score += 10;
  else if (apr > 50) score += 7;
  else if (apr > 20) score += 4;
  
  // Safety scoring
  if (pool.safety === 'safe') score += 5;
  else if (pool.safety === 'danger') score -= 15;
  
  // Farm bonus
  if (pool.hasFarm) score += 3;
  if (pool.farmActive) score += 5;
  if (pool.tokensVerified) score += 3;
  
  return Math.min(99, Math.max(10, Math.round(score)));
};

// ═══════════════════════════════════════════════════════════════════════════
// BIN GENERATION
// ═══════════════════════════════════════════════════════════════════════════

export const generateBins = (basePrice: number) => {
  const bins = [];
  for (let i = 0; i < 21; i++) {
    const dist = Math.abs(i - 10);
    bins.push({
      id: 1000 + i,
      price: basePrice + (i - 10) * basePrice * 0.0025,
      liquidity: Math.max(5, 100 - dist * 6 + Math.random() * 12),
      volume: Math.floor(Math.random() * 30000)
    });
  }
  return bins;
};

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY CHECK
// ═══════════════════════════════════════════════════════════════════════════

export const determineSafety = (
  mintX: string,
  mintY: string,
  verifiedTokens: Set<string>,
  tvl: number,
  isBlacklisted?: boolean
): 'safe' | 'warning' | 'danger' => {
  const xV = verifiedTokens.has(mintX);
  const yV = verifiedTokens.has(mintY);
  
  if (isBlacklisted) return 'danger';
  if (xV && yV) return 'safe';
  if (!xV && !yV && tvl < 10000) return 'danger';
  return 'warning';
};
