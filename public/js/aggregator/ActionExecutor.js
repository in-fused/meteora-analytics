export const ActionExecutor = {
  execute(action, pool) {
    window.open(`https://meteora.ag/pools/${pool.poolId}`, "_blank");
  }
};
