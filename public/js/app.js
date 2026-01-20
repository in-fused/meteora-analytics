/***********************
 * BOOTSTRAP SAFETY
 ***********************/
window.State = {
  pools: [],
  filteredPools: [],
  opportunities: [],
  wallet: { connected: false }
};

window.CONFIG = {
  METEORA_API: "https://api.meteora.ag/pools",
  HELIUS_RPC: "https://rpc.helius.xyz/?api-key=66097387-f0e6-4f93-a800-dbaac4a4c113",
  REFRESH_INTERVAL: 30000
};

/***********************
 * UTILITIES
 ***********************/
const log = (...args) => console.log("[LiquidityPro]", ...args);

/***********************
 * DATA AGGREGATOR
 ***********************/
const Aggregator = {
  async fetchLivePools() {
    const res = await fetch(CONFIG.METEORA_API);
    const data = await res.json();
    log("Loaded pools:", data.length);
    return data.map(Normalizer.normalizePool);
  }
};

/***********************
 * NORMALIZATION
 ***********************/
const Normalizer = {
  normalizePool(p) {
    return {
      id: p.address,
      tvl: Number(p.tvl || 0),
      fee: Number(p.fee || 0.003),
      volume24h: Number(p.volume_24h || 0),
      bins: p.bins || [],
      raw: p
    };
  }
};

/***********************
 * BIN-LEVEL LP OPTIMIZER
 ***********************/
const BinOptimizer = {
  estimateYield(pool) {
    if (!pool.bins.length) return 0;
    const activeBins = pool.bins.filter(b => b.liquidity > 0);
    const feeYield = pool.volume24h * pool.fee;
    return feeYield / Math.max(pool.tvl, 1);
  }
};

/***********************
 * MEV-AWARE DETECTOR
 ***********************/
const MEVDetector = {
  assess(pool) {
    if (pool.volume24h > pool.tvl * 0.5) return "HIGH";
    if (pool.volume24h > pool.tvl * 0.2) return "MEDIUM";
    return "LOW";
  }
};

/***********************
 * OPPORTUNITY ENGINE
 ***********************/
const OpportunityEngine = {
  evaluate(pools) {
    return pools
      .filter(p => p.tvl > 100000)
      .map(pool => {
        const yieldEst = BinOptimizer.estimateYield(pool);
        const mevRisk = MEVDetector.assess(pool);

        const score =
          yieldEst * 100 -
          (mevRisk === "HIGH" ? 5 : mevRisk === "MEDIUM" ? 2 : 0);

        return {
          id: pool.id,
          pool,
          score: Number(score.toFixed(2)),
          reason: `Est. yield ${(yieldEst * 100).toFixed(2)}% | MEV ${mevRisk}`,
          actions: [
            { type: "VIEW_POOL" },
            { type: "PROVIDE_LP" }
          ],
          pnlModel: {
            expectedDaily: yieldEst * pool.tvl / 365
          }
        };
      })
      .sort((a, b) => b.score - a.score);
  }
};

/***********************
 * ACTION EXECUTOR
 ***********************/
const ActionExecutor = {
  execute(action, opp) {
    log("Action:", action.type, opp.id);
    alert(`Action "${action.type}" executed for pool ${opp.id}`);
  }
};

/***********************
 * UI RENDERERS
 ***********************/
const PoolsUI = {
  render(pools) {
    const el = document.getElementById("pools");
    el.innerHTML = pools.slice(0, 10).map(p =>
      `<div class="card">Pool ${p.id}<br>TVL: $${Math.round(p.tvl)}</div>`
    ).join("");
  }
};

const OpportunitiesUI = {
  render(opps) {
    const el = document.getElementById("opps");
    el.innerHTML = opps.slice(0, 10).map(o =>
      `<div class="card">
        <b>Score:</b> ${o.score}<br>
        ${o.reason}<br>
        <button onclick='ActionExecutor.execute({type:"VIEW_POOL"}, ${JSON.stringify(o)})'>View</button>
      </div>`
    ).join("");
  }
};

/***********************
 * APP CORE
 ***********************/
window.App = {
  async refresh() {
    try {
      const pools = await Aggregator.fetchLivePools();
      State.pools = pools;
      State.filteredPools = pools;

      const opps = OpportunityEngine.evaluate(pools);
      State.opportunities = opps;

      PoolsUI.render(pools);
      OpportunitiesUI.render(opps);

      log("Refresh complete");
    } catch (e) {
      console.error("Refresh failed", e);
    }
  },

  start() {
    log("App started");
    this.refresh();
    setInterval(() => this.refresh(), CONFIG.REFRESH_INTERVAL);
  }
};

/***********************
 * HEADLESS API
 ***********************/
window.LiquidityProAPI = {
  getPools: () => State.pools,
  getOpportunities: () => State.opportunities,
  refresh: () => App.refresh()
};

window.addEventListener("load", () => App.start());
