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
