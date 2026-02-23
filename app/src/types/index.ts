// ═══════════════════════════════════════════════════════════════════════════
// CORE DATA TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface Bin {
  id: number;
  price: number;
  liquidity: number;
  isActive: boolean;
}

export type SafetyLevel = 'safe' | 'warning' | 'danger';
export type PoolProtocol = 'Meteora DLMM' | 'Meteora DAMM v2' | 'Raydium CLMM';

export interface Pool {
  id: string;
  address: string;
  name: string;
  protocol: PoolProtocol;
  mintX: string;
  mintY: string;
  tvl: number;
  volume: number;
  apr: string;
  apy?: string;
  fees: number;
  feeBps: number;
  binStep: number;
  currentPrice: number;
  safety: SafetyLevel;
  score: number;
  bins: Bin[];
  activeBin: number;
  icon1: string;
  icon2: string;
  icon1Url?: string;
  icon2Url?: string;
  volumeToTvl: number;
  feeTvlRatio?: number;
  feeTvlRatio1h?: number;
  fees1h?: number;
  fees4h?: number;
  fees12h?: number;
  fees24h?: number;
  todayFees?: number;
  projectedFees24h?: number;
  hasFarm?: boolean;
  farmActive?: boolean;
  farmApr?: number;
  farmApy?: number;
  isHot?: boolean;
  tags?: string[];
  isVerified?: boolean;
  permanentLockLiquidity?: number;
  creator?: string;
  createdAt?: string;
  updatedAt?: string;
  cumulativeFeeVolume?: number;
  cumulativeTradeVolume?: number;
  tokenAmountA?: number;
  tokenAmountB?: number;
  tokenAmountAUsd?: number;
  tokenAmountBUsd?: number;
  virtualPrice?: number;
  minPrice?: number;
  maxPrice?: number;
}

export type OppType = 'hot' | 'active' | 'standard';

export interface Opportunity extends Pool {
  reason: string;
  oppType: OppType;
  suggestion: string;
  suggestionDetail: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════

export type AlertCondition = 'above' | 'below';
export type AlertMetric = 'apr' | 'tvl' | 'volume' | 'score' | 'fees';

export interface Alert {
  id: string;
  poolId: string;
  poolName: string;
  metric: AlertMetric;
  condition: AlertCondition;
  value: number;
  enabled: boolean;
  createdAt: number;
}

export interface TriggeredAlert extends Alert {
  triggeredAt: number;
  currentValue: number;
  read: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// WALLET
// ═══════════════════════════════════════════════════════════════════════════

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  provider: WalletProvider | null;
  name: string | null;
  balance: number;
}

export interface WalletProvider {
  name: string;
  icon: string;
  getProvider: () => unknown;
  downloadUrl: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export type TxType = 'add' | 'remove' | 'swap';

export interface PoolTransaction {
  signature: string;
  type: TxType;
  amount: string;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// API STATUS
// ═══════════════════════════════════════════════════════════════════════════

export interface ApiStatus {
  meteora: boolean;
  jupiter: boolean;
  helius: boolean;
  raydium: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTER STATE
// ═══════════════════════════════════════════════════════════════════════════

export type SortField = 'score' | 'tvl' | 'volume' | 'apr' | 'fees' | 'fees1h' | 'feeTvl1h' | 'feeTvl';

export interface FilterState {
  minTvl: number;
  minVolume: number;
  safeOnly: boolean;
  farmOnly: boolean;
  poolType: 'all' | 'dlmm' | 'damm' | 'raydium';
  sortBy: SortField;
  searchQuery: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// AI SUGGESTION
// ═══════════════════════════════════════════════════════════════════════════

export interface AiSuggestion {
  id: string;
  pool: Pool;
  reason: string;
  score: number;
  timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE ROW TYPES (match schema.sql)
// ═══════════════════════════════════════════════════════════════════════════

export interface DbUserAlert {
  id: string;
  wallet_address: string;
  pool_id: string;
  pool_name: string;
  metric: AlertMetric;
  condition: AlertCondition;
  value: number;
  enabled: boolean;
  created_at: number;
}

export interface DbTriggeredAlert {
  id?: string;
  alert_id: string;
  wallet_address: string;
  pool_id: string;
  pool_name: string;
  metric: string;
  condition: string;
  value: number;
  current_value: number;
  triggered_at: number;
  read: boolean;
}

export interface DbUserPreferences {
  wallet_address: string;
  active_tab: string;
  jupshield: boolean;
  min_tvl: number;
  min_volume: number;
  safe_only: boolean;
  farm_only: boolean;
  pool_type: string;
  sort_by: string;
  updated_at?: string;
}

export interface DbPoolSnapshot {
  id?: number;
  pool_address: string;
  pool_name: string;
  protocol: string;
  tvl: number;
  volume: number;
  apr: string;
  fees: number;
  score: number;
  captured_at?: string;
}

export interface DbWalletBalance {
  id?: number;
  wallet_address: string;
  balance_sol: number;
  captured_at?: string;
}
