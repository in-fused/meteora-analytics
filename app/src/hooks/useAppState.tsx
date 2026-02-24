import { create } from 'zustand';
import type {
  Pool, Opportunity, Alert, TriggeredAlert, AiSuggestion,
  WalletState, ApiStatus, FilterState, PoolTransaction, SortField, Bin
} from '@/types';
import { supabaseService } from '@/services/supabaseService';

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

  // Modals
  showWalletModal: boolean;
  showExecModal: boolean;
  execPool: Pool | null;

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
  setShowWalletModal: (show: boolean) => void;
  setShowExecModal: (show: boolean) => void;
  setExecPool: (pool: Pool | null) => void;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (id: string) => void;
  addTriggeredAlert: (alert: TriggeredAlert) => void;
  clearTriggeredAlerts: () => void;
  markTriggeredAlertsRead: () => void;
  setAiSuggestions: (suggestions: AiSuggestion[]) => void;
  setPoolTransactions: (poolId: string, txs: PoolTransaction[]) => void;
  addPoolTransaction: (poolId: string, tx: PoolTransaction) => void;
  setPoolBins: (poolId: string, bins: Bin[], activeBinIndex: number, activePrice: number) => void;
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

  // Alert checking
  checkAlerts: () => void;
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
  showWalletModal: false,
  showExecModal: false,
  execPool: null,
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
  setActiveTab: (activeTab) => {
    const prev = get().activeTab;
    // Free search results memory when leaving the search tab
    if (prev === 'search-alerts' && activeTab !== 'search-alerts') {
      set({ activeTab, searchResults: [] });
    } else {
      set({ activeTab });
    }
    supabaseService.debouncedSavePreferences();
  },
  setIsInitializing: (isInitializing) => set({ isInitializing }),
  setLoadProgress: (loadProgress, loadMessage) => set({ loadProgress, loadMessage }),
  setShowWalletModal: (showWalletModal) => set({ showWalletModal }),
  setShowExecModal: (showExecModal) => set({ showExecModal }),
  setExecPool: (execPool) => set({ execPool }),
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => {
    set((s) => ({ alerts: [...s.alerts, alert] }));
    supabaseService.saveAlert(alert);
  },
  removeAlert: (id) => {
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
    supabaseService.deleteAlert(id);
  },
  addTriggeredAlert: (alert) => {
    set((s) => ({ triggeredAlerts: [alert, ...s.triggeredAlerts].slice(0, 50) }));
    supabaseService.saveTriggeredAlert(alert);
  },
  clearTriggeredAlerts: () => set({ triggeredAlerts: [] }),
  markTriggeredAlertsRead: () => {
    set((s) => ({
      triggeredAlerts: s.triggeredAlerts.map(a => ({ ...a, read: true })),
    }));
    supabaseService.markTriggeredAlertsRead();
  },
  setAiSuggestions: (aiSuggestions) => set({ aiSuggestions }),
  setPoolTransactions: (poolId, txs) =>
    set((s) => {
      const updated = { ...s.poolTransactions, [poolId]: txs };
      // Cap to 8 tracked pools max — evict oldest entries beyond that
      const keys = Object.keys(updated);
      if (keys.length > 8) {
        const activeIds = new Set([s.expandedPoolId, s.expandedOppId].filter(Boolean));
        for (const k of keys) {
          if (Object.keys(updated).length <= 8) break;
          if (!activeIds.has(k) && k !== poolId) delete updated[k];
        }
      }
      return { poolTransactions: updated };
    }),
  addPoolTransaction: (poolId, tx) =>
    set((s) => ({
      poolTransactions: {
        ...s.poolTransactions,
        [poolId]: [tx, ...(s.poolTransactions[poolId] || [])].slice(0, 15),
      },
    })),
  setPoolBins: (poolId, bins, activeBinIndex, activePrice) =>
    set((s) => {
      const update = (p: Pool) =>
        p.id === poolId
          ? { ...p, bins, activeBin: activeBinIndex, currentPrice: activePrice }
          : p;
      return {
        pools: s.pools.map(update),
        filteredPools: s.filteredPools.map(update),
        opportunities: s.opportunities.map(update) as Opportunity[],
      };
    }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setJupshieldEnabled: (jupshieldEnabled) => {
    set({ jupshieldEnabled });
    supabaseService.debouncedSavePreferences();
  },
  setLastRefresh: (lastRefresh) => set({ lastRefresh }),
  setWallet: (wallet) => set((s) => ({ wallet: { ...s.wallet, ...wallet } })),
  setApiStatus: (api, status) =>
    set((s) => ({ apiStatus: { ...s.apiStatus, [api]: status } })),
  setFilters: (filters) => {
    set((s) => ({ filters: { ...s.filters, ...filters } }));
    supabaseService.debouncedSavePreferences();
  },
  setSearchResults: (searchResults) => set({ searchResults }),

  // Toggle pool with mutual exclusion + memory cleanup
  togglePool: (poolId) => {
    const { expandedPoolId, poolTransactions } = get();
    if (expandedPoolId === poolId) {
      // Collapsing — evict transactions to free memory
      const cleaned = { ...poolTransactions };
      delete cleaned[poolId];
      set({ expandedPoolId: null, poolTransactions: cleaned });
    } else {
      // Expanding — also evict the previously expanded pool's txs
      const cleaned = { ...poolTransactions };
      if (expandedPoolId) delete cleaned[expandedPoolId];
      set({ expandedPoolId: poolId, expandedOppId: null, poolTransactions: cleaned });
    }
  },

  toggleOpp: (oppId) => {
    const { expandedOppId, poolTransactions } = get();
    if (expandedOppId === oppId) {
      const cleaned = { ...poolTransactions };
      delete cleaned[oppId];
      set({ expandedOppId: null, poolTransactions: cleaned });
    } else {
      const cleaned = { ...poolTransactions };
      if (expandedOppId) delete cleaned[expandedOppId];
      set({ expandedOppId: oppId, expandedPoolId: null, poolTransactions: cleaned });
    }
  },

  // Check alerts against current pool data (with deduplication)
  checkAlerts: () => {
    const { alerts, pools, triggeredAlerts, addTriggeredAlert } = get();
    if (alerts.length === 0 || pools.length === 0) return;

    // Prevent the same alert from firing more than once per 10 minutes
    const recentlyTriggered = new Set(
      triggeredAlerts
        .filter(t => Date.now() - t.triggeredAt < 600_000)
        .map(t => t.id)
    );

    for (const alert of alerts) {
      if (!alert.enabled) continue;
      if (recentlyTriggered.has(alert.id)) continue;

      const pool = pools.find(p => p.id === alert.poolId);
      if (!pool) continue;

      let currentValue = 0;
      switch (alert.metric) {
        case 'apr': currentValue = parseFloat(pool.apr); break;
        case 'tvl': currentValue = pool.tvl; break;
        case 'volume': currentValue = pool.volume; break;
        case 'score': currentValue = pool.score; break;
        case 'fees': currentValue = pool.fees; break;
      }

      const triggered =
        (alert.condition === 'above' && currentValue > alert.value) ||
        (alert.condition === 'below' && currentValue < alert.value);

      if (triggered) {
        addTriggeredAlert({
          ...alert,
          triggeredAt: Date.now(),
          currentValue,
          read: false,
        });
      }
    }
  },
}));
