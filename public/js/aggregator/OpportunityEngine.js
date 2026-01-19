import { BinOptimizer } from "./BinOptimizer.js";
import { MEVDetector } from "./MEVDetector.js";

export const OpportunityEngine = {
  evaluate(pools) {
    const out = [];

    for (const p of pools) {
      if (!p.risk.verifiedTokens) continue;

      const mev = MEVDetector.analyze(p);
      if (mev?.unsafe) continue;

      const opt = BinOptimizer.optimize(p);

      out.push({
        id: p.poolId,
        pool: p,
        score: 0.8,
        reason: "Efficient liquidity + safe flow",
        actions: opt ? [{
          type: "ADD_LIQUIDITY",
          range: `${opt.lowerBin} → ${opt.upperBin}`,
          expectedFeesUSD: opt.expectedDailyFeesUSD.toFixed(2)
        }] : []
      });
    }

    return out;
  }
};
