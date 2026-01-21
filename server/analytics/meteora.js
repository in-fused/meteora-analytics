// server/analytics/meteora.js
// This file contains ALL Meteora analytics logic
// It is NEVER exposed to the browser

export async function fetchMeteoraPools() {
  const res = await fetch('https://dlmm-api.meteora.ag/pair/all');

  if (!res.ok) {
    throw new Error('Failed to fetch Meteora pools');
  }

  const pools = await res.json();

  // Basic filtering to avoid junk pools
  return pools.filter(p =>
    p.address &&
    p.name &&
    !p.hide &&
    !p.is_blacklisted &&
    Number(p.liquidity || 0) > 10_000
  );
}

export function scorePool(pool) {
  const tvl = Number(pool.liquidity || 0);
  const volume24h = Number(pool.trade_volume_24h || 0);
  const fees24h = Number(pool.fees_24h || 0);
  const apr = Number(pool.apr || 0);

  // Simple, explainable scoring model
  let score = 0;

  if (tvl > 0) score += Math.min(30, volume24h / tvl * 10);
  score += Math.min(30, fees24h / 1000);
  score += Math.min(40, apr / 5);

  return {
    address: pool.address,
    name: pool.name,
    protocol: 'Meteora DLMM',
    tvl,
    volume24h,
    fees24h,
    apr,
    score: Math.round(score)
  };
}
