import { create } from 'zustand';
import type {
  Pool, Opportunity, Alert, TriggeredAlert, AiSuggestion,
  WalletState, ApiStatus, FilterState, PoolTransaction, SortField
} from '@/types';

interface AppState {
  // Pool data
  pools: Pool[];
  filteredPools: Pool[];
  opportunities: Opportunity[];
  verifiedTokens: Set<string>;
  sources: string[];

  // UI state
  expandedPoolId: string | null;
  expandedOppId: string | null;
  activeTab: string;
  isInitializing: boolean;
  loadProgress: number;
  loadMessage: string;

  // Alerts
  alerts: Alert[];
  triggeredAlerts: TriggeredAlert[];
  aiSuggestions: AiSuggestion[];

  // Transactions
  poolTransactions: Record<string, PoolTransaction[]>;

  // WebSocket
  wsConnected: boolean;

  // Settings
  jupshieldEnabled: boolean;
  lastRefresh: number;

  // Wallet
  wallet: WalletState;

  // API status
  apiStatus: ApiStatus;

  // Filters
  filters: FilterState;

  // Search
  searchResults: Pool[];

  // Actions
  setPools: (pools: Pool[]) => void;
  setFilteredPools: (pools: Pool[]) => void;
  setOpportunities: (opps: Opportunity[]) => void;
  setVerifiedTokens: (tokens: Set<string>) => void;
  setSources: (sources: string[]) => void;
  setExpandedPoolId: (id: string | null) => void;
  setExpandedOppId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  setIsInitializing: (init: boolean) => void;
  setLoadProgress: (progress: number, message: string) => void;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (id: string) => void;
  addTriggeredAlert: (alert: TriggeredAlert) => void;
  clearTriggeredAlerts: () => void;
  setAiSuggestions: (suggestions: AiSuggestion[]) => void;
  setPoolTransactions: (poolId: string, txs: PoolTransaction[]) => void;
  addPoolTransaction: (poolId: string, tx: PoolTransaction) => void;
  setWsConnected: (connected: boolean) => void;
  setJupshieldEnabled: (enabled: boolean) => void;
  setLastRefresh: (ts: number) => void;
  setWallet: (wallet: Partial<WalletState>) => void;
  setApiStatus: (api: keyof ApiStatus, status: boolean) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setSearchResults: (results: Pool[]) => void;

  // Toggle pool expansion (handles mutual exclusion)
  togglePool: (poolId: string) => void;
  toggleOpp: (oppId: string) => void;
}

export const useAppState = create<AppState>((set, get) => ({
  // Initial state
  pools: [],
  filteredPools: [],
  opportunities: [],
  verifiedTokens: new Set(),
  sources: [],
  expandedPoolId: null,
  expandedOppId: null,
  activeTab: 'opportunities',
  isInitializing: true,
  loadProgress: 0,
  loadMessage: 'Initializing...',
  alerts: [],
  triggeredAlerts: [],
  aiSuggestions: [],
  poolTransactions: {},
  wsConnected: false,
  jupshieldEnabled: true,
  lastRefresh: 0,
  wallet: {
    connected: false,
    publicKey: null,
    provider: null,
    name: null,
    balance: 0,
  },
  apiStatus: {
    meteora: false,
    jupiter: false,
    helius: false,
    raydium: false,
  },
  filters: {
    minTvl: 0,
    minVolume: 0,
    safeOnly: false,
    farmOnly: false,
    poolType: 'all',
    sortBy: 'score',
    searchQuery: '',
  },
  searchResults: [],

  // Actions
  setPools: (pools) => set({ pools }),
  setFilteredPools: (filteredPools) => set({ filteredPools }),
  setOpportunities: (opportunities) => set({ opportunities }),
  setVerifiedTokens: (verifiedTokens) => set({ verifiedTokens }),
  setSources: (sources) => set({ sources }),
  setExpandedPoolId: (expandedPoolId) => set({ expandedPoolId }),
  setExpandedOppId: (expandedOppId) => set({ expandedOppId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setIsInitializing: (isInitializing) => set({ isInitializing }),
  setLoadProgress: (loadProgress, loadMessage) => set({ loadProgress, loadMessage }),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((s) => ({ alerts: [...s.alerts, alert] })),
  removeAlert: (id) => set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) })),
  addTriggeredAlert: (alert) => set((s) => ({ triggeredAlerts: [alert, ...s.triggeredAlerts].slice(0, 50) })),
  clearTriggeredAlerts: () => set({ triggeredAlerts: [] }),
  setAiSuggestions: (aiSuggestions) => set({ aiSuggestions }),
  setPoolTransactions: (poolId, txs) =>
    set((s) => ({ poolTransactions: { ...s.poolTransactions, [poolId]: txs } })),
  addPoolTransaction: (poolId, tx) =>
    set((s) => ({
      poolTransactions: {
        ...s.poolTransactions,
        [poolId]: [tx, ...(s.poolTransactions[poolId] || [])].slice(0, 15),
      },
    })),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setJupshieldEnabled: (jupshieldEnabled) => set({ jupshieldEnabled }),
  setLastRefresh: (lastRefresh) => set({ lastRefresh }),
  setWallet: (wallet) => set((s) => ({ wallet: { ...s.wallet, ...wallet } })),
  setApiStatus: (api, status) =>
    set((s) => ({ apiStatus: { ...s.apiStatus, [api]: status } })),
  setFilters: (filters) =>
    set((s) => ({ filters: { ...s.filters, ...filters } })),
  setSearchResults: (searchResults) => set({ searchResults }),

  // Toggle pool with mutual exclusion
  togglePool: (poolId) => {
    const { expandedPoolId } = get();
    if (expandedPoolId === poolId) {
      set({ expandedPoolId: null });
    } else {
      set({ expandedPoolId: poolId, expandedOppId: null });
    }
  },

  toggleOpp: (oppId) => {
    const { expandedOppId } = get();
    if (expandedOppId === oppId) {
      set({ expandedOppId: null });
    } else {
      set({ expandedOppId: oppId, expandedPoolId: null });
    }
  },
}));
