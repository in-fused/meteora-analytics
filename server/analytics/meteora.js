export async function fetchMeteoraPools() {
  const res = await fetch('https://dlmm-api.meteora.ag/pair/all');
  if (!res.ok) throw new Error('Meteora API failed');
  return res.json();
}

export function scorePool(pool) {
  const tvl = Number(pool.liquidity || 0);
  const volume = Number(pool.trade_volume_24h || 0);

  return {
    ...pool,
    score: Math.min(100, (volume / (tvl + 1)) * 10)
  };
}
