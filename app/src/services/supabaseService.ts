// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE SERVICE — Persistence layer for alerts, preferences, snapshots
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config';
import { useAppState } from '@/hooks/useAppState';
import type {
  Alert, TriggeredAlert, FilterState,
  DbUserAlert, DbTriggeredAlert, DbUserPreferences,
  DbPoolSnapshot, DbWalletBalance, Pool,
} from '@/types';

// ─── Client singleton ────────────────────────────────────────────────────

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (client) return client;
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    console.warn('[Supabase] Missing URL or anon key — persistence disabled');
    return null;
  }
  client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return client;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function walletAddress(): string | null {
  return useAppState.getState().wallet.publicKey;
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS
// ═══════════════════════════════════════════════════════════════════════════

async function loadAlerts(): Promise<Alert[]> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return [];

  try {
    const { data, error } = await sb
      .from('user_alerts')
      .select('*')
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false });

    if (error) { console.error('[Supabase] loadAlerts:', error.message); return []; }

    return (data as DbUserAlert[]).map(row => ({
      id: row.id,
      poolId: row.pool_id,
      poolName: row.pool_name,
      metric: row.metric,
      condition: row.condition,
      value: row.value,
      enabled: row.enabled,
      createdAt: row.created_at,
    }));
  } catch (err) {
    console.error('[Supabase] loadAlerts exception:', err);
    return [];
  }
}

async function saveAlert(alert: Alert): Promise<void> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return;

  try {
    const row: DbUserAlert = {
      id: alert.id,
      wallet_address: wallet,
      pool_id: alert.poolId,
      pool_name: alert.poolName,
      metric: alert.metric,
      condition: alert.condition,
      value: alert.value,
      enabled: alert.enabled,
      created_at: alert.createdAt,
    };

    const { error } = await sb.from('user_alerts').upsert(row);
    if (error) console.error('[Supabase] saveAlert:', error.message);
  } catch (err) {
    console.error('[Supabase] saveAlert exception:', err);
  }
}

async function deleteAlert(alertId: string): Promise<void> {
  const sb = getClient();
  if (!sb) return;

  try {
    const { error } = await sb.from('user_alerts').delete().eq('id', alertId);
    if (error) console.error('[Supabase] deleteAlert:', error.message);
  } catch (err) {
    console.error('[Supabase] deleteAlert exception:', err);
  }
}

async function toggleAlert(alertId: string, enabled: boolean): Promise<void> {
  const sb = getClient();
  if (!sb) return;

  try {
    const { error } = await sb
      .from('user_alerts')
      .update({ enabled })
      .eq('id', alertId);
    if (error) console.error('[Supabase] toggleAlert:', error.message);
  } catch (err) {
    console.error('[Supabase] toggleAlert exception:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGERED ALERTS
// ═══════════════════════════════════════════════════════════════════════════

async function loadTriggeredAlerts(): Promise<TriggeredAlert[]> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return [];

  try {
    const { data, error } = await sb
      .from('triggered_alerts')
      .select('*')
      .eq('wallet_address', wallet)
      .order('triggered_at', { ascending: false })
      .limit(50);

    if (error) { console.error('[Supabase] loadTriggeredAlerts:', error.message); return []; }

    return (data as DbTriggeredAlert[]).map(row => ({
      id: row.alert_id,
      poolId: row.pool_id,
      poolName: row.pool_name,
      metric: row.metric as Alert['metric'],
      condition: row.condition as Alert['condition'],
      value: row.value,
      enabled: true,
      createdAt: row.triggered_at,
      triggeredAt: row.triggered_at,
      currentValue: row.current_value,
      read: row.read,
    }));
  } catch (err) {
    console.error('[Supabase] loadTriggeredAlerts exception:', err);
    return [];
  }
}

async function saveTriggeredAlert(alert: TriggeredAlert): Promise<void> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return;

  try {
    const row: DbTriggeredAlert = {
      alert_id: alert.id,
      wallet_address: wallet,
      pool_id: alert.poolId,
      pool_name: alert.poolName,
      metric: alert.metric,
      condition: alert.condition,
      value: alert.value,
      current_value: alert.currentValue,
      triggered_at: alert.triggeredAt,
      read: alert.read,
    };

    const { error } = await sb.from('triggered_alerts').insert(row);
    if (error) console.error('[Supabase] saveTriggeredAlert:', error.message);
  } catch (err) {
    console.error('[Supabase] saveTriggeredAlert exception:', err);
  }
}

async function markTriggeredAlertsRead(): Promise<void> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return;

  try {
    const { error } = await sb
      .from('triggered_alerts')
      .update({ read: true })
      .eq('wallet_address', wallet)
      .eq('read', false);
    if (error) console.error('[Supabase] markRead:', error.message);
  } catch (err) {
    console.error('[Supabase] markRead exception:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// USER PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════

async function loadPreferences(): Promise<Partial<{
  activeTab: string;
  jupshieldEnabled: boolean;
  filters: FilterState;
}> | null> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return null;

  try {
    const { data, error } = await sb
      .from('user_preferences')
      .select('*')
      .eq('wallet_address', wallet)
      .single();

    if (error || !data) return null;

    const row = data as DbUserPreferences;
    return {
      activeTab: row.active_tab,
      jupshieldEnabled: row.jupshield,
      filters: {
        minTvl: row.min_tvl,
        minVolume: row.min_volume,
        safeOnly: row.safe_only,
        farmOnly: row.farm_only,
        poolType: row.pool_type as FilterState['poolType'],
        sortBy: row.sort_by as FilterState['sortBy'],
        searchQuery: '',
      },
    };
  } catch (err) {
    console.error('[Supabase] loadPreferences exception:', err);
    return null;
  }
}

async function savePreferences(): Promise<void> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return;

  const state = useAppState.getState();

  try {
    const row: DbUserPreferences = {
      wallet_address: wallet,
      active_tab: state.activeTab,
      jupshield: state.jupshieldEnabled,
      min_tvl: state.filters.minTvl,
      min_volume: state.filters.minVolume,
      safe_only: state.filters.safeOnly,
      farm_only: state.filters.farmOnly,
      pool_type: state.filters.poolType,
      sort_by: state.filters.sortBy,
      updated_at: new Date().toISOString(),
    };

    const { error } = await sb.from('user_preferences').upsert(row);
    if (error) console.error('[Supabase] savePreferences:', error.message);
  } catch (err) {
    console.error('[Supabase] savePreferences exception:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POOL SNAPSHOTS (for historical charts)
// ═══════════════════════════════════════════════════════════════════════════

async function savePoolSnapshots(pools: Pool[]): Promise<void> {
  const sb = getClient();
  if (!sb) return;

  // Only snapshot top 50 pools to keep storage reasonable
  const top = pools.slice(0, 50);
  if (top.length === 0) return;

  try {
    const rows: DbPoolSnapshot[] = top.map(p => ({
      pool_address: p.address || p.id,
      pool_name: p.name,
      protocol: p.protocol,
      tvl: p.tvl,
      volume: p.volume,
      apr: p.apr,
      fees: p.fees,
      score: p.score,
    }));

    const { error } = await sb.from('pool_snapshots').insert(rows);
    if (error) console.error('[Supabase] savePoolSnapshots:', error.message);
  } catch (err) {
    console.error('[Supabase] savePoolSnapshots exception:', err);
  }
}

async function loadPoolHistory(poolAddress: string, hours = 24): Promise<DbPoolSnapshot[]> {
  const sb = getClient();
  if (!sb) return [];

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('pool_snapshots')
      .select('*')
      .eq('pool_address', poolAddress)
      .gte('captured_at', since)
      .order('captured_at', { ascending: true });

    if (error) { console.error('[Supabase] loadPoolHistory:', error.message); return []; }
    return data as DbPoolSnapshot[];
  } catch (err) {
    console.error('[Supabase] loadPoolHistory exception:', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WALLET BALANCE HISTORY
// ═══════════════════════════════════════════════════════════════════════════

async function saveWalletBalance(balanceSol: number): Promise<void> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet || balanceSol <= 0) return;

  try {
    const { error } = await sb.from('wallet_balances').insert({
      wallet_address: wallet,
      balance_sol: balanceSol,
    } satisfies Omit<DbWalletBalance, 'id' | 'captured_at'>);
    if (error) console.error('[Supabase] saveWalletBalance:', error.message);
  } catch (err) {
    console.error('[Supabase] saveWalletBalance exception:', err);
  }
}

async function loadWalletBalanceHistory(hours = 24): Promise<DbWalletBalance[]> {
  const sb = getClient();
  const wallet = walletAddress();
  if (!sb || !wallet) return [];

  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('wallet_balances')
      .select('*')
      .eq('wallet_address', wallet)
      .gte('captured_at', since)
      .order('captured_at', { ascending: true });

    if (error) { console.error('[Supabase] loadWalletBalanceHistory:', error.message); return []; }
    return data as DbWalletBalance[];
  } catch (err) {
    console.error('[Supabase] loadWalletBalanceHistory exception:', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION — Hydrate store from Supabase after wallet connect
// ═══════════════════════════════════════════════════════════════════════════

async function hydrate(): Promise<void> {
  const wallet = walletAddress();
  if (!wallet) return;

  console.log('[Supabase] Hydrating data for', wallet.slice(0, 8) + '...');

  const [alerts, triggered, prefs] = await Promise.all([
    loadAlerts(),
    loadTriggeredAlerts(),
    loadPreferences(),
  ]);

  const store = useAppState.getState();

  if (alerts.length > 0) store.setAlerts(alerts);
  if (triggered.length > 0) {
    // Set state directly — do NOT use addTriggeredAlert() which re-inserts to Supabase
    useAppState.setState({ triggeredAlerts: triggered.slice(0, 50) });
  }
  if (prefs) {
    if (prefs.activeTab) store.setActiveTab(prefs.activeTab);
    if (prefs.jupshieldEnabled !== undefined) store.setJupshieldEnabled(prefs.jupshieldEnabled);
    if (prefs.filters) store.setFilters(prefs.filters);
  }

  console.log('[Supabase] Hydrated:', alerts.length, 'alerts,', triggered.length, 'triggered, prefs:', !!prefs);
}

// ═══════════════════════════════════════════════════════════════════════════
// DEBOUNCED PREFERENCE SAVE
// ═══════════════════════════════════════════════════════════════════════════

let prefsSaveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSavePreferences(): void {
  if (prefsSaveTimer) clearTimeout(prefsSaveTimer);
  prefsSaveTimer = setTimeout(() => savePreferences(), 2000);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const supabaseService = {
  // Lifecycle
  isEnabled: () => !!getClient(),
  hydrate,

  // Alerts
  loadAlerts,
  saveAlert,
  deleteAlert,
  toggleAlert,

  // Triggered alerts
  loadTriggeredAlerts,
  saveTriggeredAlert,
  markTriggeredAlertsRead,

  // Preferences
  loadPreferences,
  savePreferences,
  debouncedSavePreferences,

  // Pool snapshots
  savePoolSnapshots,
  loadPoolHistory,

  // Wallet balance
  saveWalletBalance,
  loadWalletBalanceHistory,
};
