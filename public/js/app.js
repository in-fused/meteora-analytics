// ===== BOOTSTRAP SAFETY DEFAULTS =====

window.State = window.State || {
  pools: [],
  filteredPools: [],
  opportunities: [],
  wallet: { connected: false }
};

window.CONFIG = window.CONFIG || {
  METEORA_API: "https://api.meteora.ag",
  JUPITER_PRICE: "https://price.jup.ag/v4/price",
  HELIUS_WS: "wss://rpc.helius.xyz/?api-key=66097387-f0e6-4f93-a800-dbaac4a4c113",
  METEORA_PROGRAM: "Meteora111111111111111111111111111111111",
  REFRESH_INTERVAL: 30000,
  WS_RECONNECT_DELAY: 5000
};

window.StatusUI = window.StatusUI || {
  set: () => {},
  setApi: () => {},
  updateBadges: () => {}
};

window.PoolsUI = window.PoolsUI || {
  render: () => {}
};

window.OpportunitiesUI = window.OpportunitiesUI || {
  render: () => {}
};

window.ToastUI = window.ToastUI || {
  error: console.error
};
import { Aggregator } from "./aggregator/Aggregator.js";
import { OpportunityEngine } from "./aggregator/OpportunityEngine.js";
import { HeliusWS } from "./aggregator/HeliusWS.js";

window.App = {
  async refresh() {
    try {
      StatusUI.set("live", "Fetching live liquidity…");

      const pools = await Aggregator.fetchLivePools();
      State.pools = pools;
      State.filteredPools = pools;

      const opps = OpportunityEngine.evaluate(pools);
      State.opportunities = opps;

      PoolsUI.render(pools);
      OpportunitiesUI.render(opps);

      StatusUI.set("live", "Live");
      StatusUI.updateBadges();
    } catch (e) {
      console.error(e);
      StatusUI.set("error", "Live data unavailable");
    }
  },

  start() {
    console.log("App.start() called");
    this.refresh();
    HeliusWS.connect();
    setInterval(() => this.refresh(), CONFIG.REFRESH_INTERVAL);
  }
};

window.addEventListener("load", () => App.start());

window.LiquidityProAPI = {
  getPools: () => State.pools,
  getOpportunities: () => State.opportunities,
  refresh: () => App.refresh()
};
