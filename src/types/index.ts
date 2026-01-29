// ═══════════════════════════════════════════════════════════════════════════
// TYPES - LiquidityPro
// ═══════════════════════════════════════════════════════════════════════════

export interface Pool {
  id: string;
  address: string;
  name: string;
  protocol: 'Meteora DLMM' | 'Meteora DAMM v2' | 'Raydium';
  mintX: string;
  mintY: string;
  tvl: number;
  volume: number;
  volume1h?: number;
  apr: string;
  apy?: string;
  fees: number;
  fees1h?: number;
  fees4h?: number;
  fees12h?: number;
  feeBps: number;
  maxFeeBps?: number;
  feeTvlRatio: number;
  feeTvlRatio1h?: number;
  binStep: number;
  currentPrice: number;
  safety: 'safe' | 'warning' | 'danger';
  score: number;
  bins: Bin[];
  activeBin: number;
  icon1: string;
  icon2: string;
  icon1Url?: string;
  icon2Url?: string;
  volumeToTvl: number;
  
  // Farm-related fields
  hasFarm?: boolean;
  farmActive?: boolean;
  farmApr?: string;
  farmApy?: string;
  rewardMintX?: string;
  rewardMintY?: string;
  
  // Short-term metrics
  feeVelocity?: number;
  volumeVelocity?: number;
  isHot?: boolean;
  
  // Metadata
  tags?: string[];
  tokensVerified?: boolean;
  isBlacklisted?: boolean;
  hide?: boolean;
  
  // DAMM v2 specific
  baseFee?: number;
  dynamicFee?: number;
  creator?: string | null;
  alphaVault?: string | null;
  launchpad?: string | null;
  poolType?: string;
  permanentLockLiquidity?: number;
  virtualPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  
  // Opportunity fields
  reason?: string;
  oppType?: 'hot' | 'active' | 'standard';
  
  // Additional fields
  cumulativeTradeVolume?: number;
}

export interface Bin {
  id: number;
  price: number;
  liquidity: number;
  volume?: number;
}

export interface PoolTransaction {
  id: string;
  type: 'add' | 'remove' | 'swap';
  signature: string;
  amount: string;
  timestamp: number;
  // Real-time bin tracking
  affectedBin?: number;
  binLiquidityChange?: number;
}

export interface BinActivity {
  binId: number;
  type: 'add' | 'remove';
  amount: number;
  timestamp: number;
}

export interface Alert {
  id: number;
  poolId: string;
  poolName: string;
  condition: string;
  value: number;
  active: boolean;
  lastTriggered?: number;
}

export interface TriggeredAlert {
  id: number;
  alertId: number;
  poolId: string;
  poolName: string;
  condition: string;
  value: string;
  timestamp: number;
}

export interface AISuggestion {
  pool: Pool;
  reason: string;
  condition: string;
  value: number;
}

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  provider: any;
  name: string | null;
  balance: number;
}

export interface APIStatus {
  meteora: boolean;
  jupiter: boolean;
  helius: boolean;
  birdeye: boolean;
}

export interface MetricsData {
  sessionStart: number;
  pageViews: number;
  poolClicks: number;
  opportunityViews: number;
  expandedPools: string[];
  executionAttempts: number;
  events: MetricEvent[];
}

export interface MetricEvent {
  event: string;
  data: Record<string, any>;
  timestamp: number;
}
