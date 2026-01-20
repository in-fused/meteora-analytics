import { Normalizer } from "./Normalizer.js";

export const Aggregator = {
  async fetchLivePools() {
    const res = await fetch("https://api.meteora.ag/v1/pools");
    const raw = await res.json();

    const out = [];
    for (const p of raw) {
      const n = await Normalizer.normalizePool(p);
      if (n && n.freshness.ageMs < 30000) out.push(n);
    }
    return out;
  }
};
