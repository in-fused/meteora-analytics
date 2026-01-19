export const Normalizer = {
  async normalizePool(p) {
    const now = Date.now();

    return {
      poolId: p.address,
      protocol: "meteora",
      tokenA: p.tokenA,
      tokenB: p.tokenB,
      price: p.price,
      tvlUSD: p.tvl,
      volume24hUSD: p.volume24h,
      feeAPR: p.apr,
      liquidityDistribution: p.bins || [],
      activeLiquidityRatio: 0.5,
      flowMetrics: {
        netInflow15m: p.inflow15m || 0,
        netInflow1h: p.inflow1h || 0,
        swapVelocity: p.swapCount15m || 0
      },
      risk: {
        verifiedTokens: true,
        concentrationRisk: 0.2,
        volatility: p.volatility24h || 0.3
      },
      freshness: {
        ageMs: now - (p.updatedAt || now)
      }
    };
  }
};
