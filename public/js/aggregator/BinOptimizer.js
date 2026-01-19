export const BinOptimizer = {
  optimize(pool) {
    const bins = pool.liquidityDistribution;
    if (!bins.length) return null;

    return {
      lowerBin: bins[0].price,
      upperBin: bins[bins.length - 1].price,
      expectedDailyFeesUSD: pool.volume24hUSD * 0.002
    };
  }
};
