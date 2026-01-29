import { useEffect, useCallback, useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { dataService } from '@/services/dataService';
import { wsService } from '@/services/wsService';
import { walletService } from '@/services/walletService';
import { metricsService } from '@/services/metricsService';
import { detectOpportunities } from '@/lib/utils';
import { formatNumber, shortenAddress } from '@/lib/utils';
import { CONFIG } from '@/config';

import { Particles } from '@/components/Particles';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { PoolCard } from '@/components/PoolCard';
import { OpportunitiesSection } from '@/components/OpportunitiesSection';
import { SearchAlertsSection } from '@/components/SearchAlertsSection';
import { GuideSection } from '@/components/GuideSection';

export default function App() {
  const activeTab = useAppState((s) => s.activeTab);
  const isInitializing = useAppState((s) => s.isInitializing);
  const loadProgress = useAppState((s) => s.loadProgress);
  const loadMessage = useAppState((s) => s.loadMessage);
  const filteredPools = useAppState((s) => s.filteredPools);
  const showWalletModal = useAppState((s) => s.showWalletModal);
  const showExecModal = useAppState((s) => s.showExecModal);
  const execPool = useAppState((s) => s.execPool);
  const wallet = useAppState((s) => s.wallet);

  // Execution modal local state
  const [execAmount, setExecAmount] = useState('');
  const [execQuote, setExecQuote] = useState<string | null>(null);
  const [execLoading, setExecLoading] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const init = async () => {
      const store = useAppState.getState();
      try {
        store.setLoadProgress(5, 'Connecting wallet...');
        await walletService.autoConnect().catch(() => {});

        store.setLoadProgress(15, 'Loading token data...');
        await dataService.fetchJupiterTokens();

        store.setLoadProgress(35, 'Fetching pool data...');
        await dataService.fetchPools();

        store.setLoadProgress(55, 'Applying filters...');
        dataService.applyFilters();

        store.setLoadProgress(70, 'Detecting opportunities...');
        const opps = detectOpportunities(useAppState.getState().filteredPools.length > 0
          ? useAppState.getState().filteredPools
          : useAppState.getState().pools);
        store.setOpportunities(opps);

        store.setLoadProgress(85, 'Connecting live feed...');
        wsService.connect();

        store.setLoadProgress(92, 'Initializing metrics...');
        metricsService.init();

        store.setLoadProgress(100, 'Ready');
        store.setIsInitializing(false);
        store.setLastRefresh(Date.now());
      } catch (err) {
        console.error('[App] Init failed:', err);
        store.setLoadProgress(100, 'Error - Retrying...');
        setTimeout(init, 3000);
      }
    };

    init();

    return () => {
      wsService.disconnect();
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // BACKGROUND REFRESH
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isInitializing) return;

    const interval = setInterval(async () => {
      const store = useAppState.getState();
      if (store.expandedPoolId || store.expandedOppId || document.hidden) return;
      if (Date.now() - store.lastRefresh < 30000) return;

      try {
        await dataService.fetchPools();
        dataService.applyFilters();

        const currentPools = useAppState.getState().filteredPools.length > 0
          ? useAppState.getState().filteredPools
          : useAppState.getState().pools;
        const opps = detectOpportunities(currentPools);
        store.setOpportunities(opps);

        store.checkAlerts();
        store.setLastRefresh(Date.now());

        // Fetch wallet balance if connected
        if (useAppState.getState().wallet.connected) {
          await walletService.fetchBalance();
        }
      } catch (err) {
        console.warn('[App] Background refresh failed:', err);
      }
    }, CONFIG.REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [isInitializing]);

  // ═══════════════════════════════════════════════════════════════════════
  // KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const store = useAppState.getState();
        if (store.expandedPoolId) store.setExpandedPoolId(null);
        if (store.expandedOppId) store.setExpandedOppId(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // MANUAL REFRESH
  // ═══════════════════════════════════════════════════════════════════════

  const handleRefresh = useCallback(async () => {
    const store = useAppState.getState();
    try {
      await dataService.fetchPools();
      dataService.applyFilters();
      const currentPools = useAppState.getState().filteredPools.length > 0
        ? useAppState.getState().filteredPools
        : useAppState.getState().pools;
      const opps = detectOpportunities(currentPools);
      store.setOpportunities(opps);
      store.checkAlerts();
      store.setLastRefresh(Date.now());
    } catch (err) {
      console.error('[App] Refresh failed:', err);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // WALLET MODAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handleWalletConnect = useCallback(async (walletKey: string) => {
    const success = await walletService.connect(walletKey);
    if (success) {
      useAppState.getState().setShowWalletModal(false);
    }
  }, []);

  const handleWalletDisconnect = useCallback(async () => {
    await walletService.disconnect();
    useAppState.getState().setShowWalletModal(false);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // EXECUTION MODAL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  const handleExecQuote = useCallback(async () => {
    if (!execPool || !execAmount || parseFloat(execAmount) <= 0) return;
    setExecLoading(true);
    try {
      const amountLamports = Math.floor(parseFloat(execAmount) * 1e9);
      const resp = await fetch(
        `${CONFIG.JUPITER_ULTRA_API}/order`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputMint: CONFIG.MINTS.SOL,
            outputMint: execPool.mintX,
            amount: amountLamports,
          }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        setExecQuote(
          `Output: ${data.outAmount ? (data.outAmount / 1e6).toFixed(4) : 'N/A'} | ` +
          `Price impact: ${data.priceImpactPct ? (data.priceImpactPct * 100).toFixed(3) + '%' : 'N/A'}`
        );
      } else {
        setExecQuote('Quote unavailable');
      }
    } catch {
      setExecQuote('Quote failed');
    } finally {
      setExecLoading(false);
    }
  }, [execPool, execAmount]);

  const handleExecClose = useCallback(() => {
    useAppState.getState().setShowExecModal(false);
    useAppState.getState().setExecPool(null);
    setExecAmount('');
    setExecQuote(null);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — LOADING SCREEN
  // ═══════════════════════════════════════════════════════════════════════

  if (isInitializing) {
    return (
      <div className="loader-overlay">
        <Particles />
        <div className="bg-overlay" />
        <div id="toastContainer" className="toast-container" />
        <div className="loader-content">
          <div className="loader-logo">
            <div className="logo-mark" style={{ width: 60, height: 60, fontSize: 22 }}>LP</div>
          </div>
          <div className="loader-title">LiquidityPro</div>
          <div className="loader-subtitle">Institutional-Grade DeFi Analytics</div>
          <div className="loader-progress">
            <div className="loader-progress-bar" style={{ width: `${loadProgress}%` }} />
          </div>
          <div className="loader-status">{loadMessage}</div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER — MAIN APP
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="app">
      <div id="toastContainer" className="toast-container" />
      <Particles />
      <div className="bg-overlay" />

      <Header onRefresh={handleRefresh} />

      {/* Tab: Opportunities */}
      {activeTab === 'opportunities' && (
        <>
          <HeroSection />
          <OpportunitiesSection />
        </>
      )}

      {/* Tab: All Pools */}
      {activeTab === 'all-pools' && (
        <section className="section" style={{ padding: '2rem 1.5rem' }}>
          <div className="section-header">
            <h2>All Pools ({filteredPools.length})</h2>
          </div>
          <div className="pool-grid">
            {filteredPools.map((pool, index) => (
              <PoolCard key={pool.id} pool={pool} rank={index + 1} />
            ))}
          </div>
          {filteredPools.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
              No pools match current filters.
            </div>
          )}
        </section>
      )}

      {/* Tab: Search & Alerts */}
      {activeTab === 'search-alerts' && <SearchAlertsSection />}

      {/* Tab: Guide */}
      {activeTab === 'guide' && <GuideSection />}

      {/* Wallet Modal */}
      {showWalletModal && (
        <div className="modal-overlay" onClick={() => useAppState.getState().setShowWalletModal(false)}>
          <div className="modal-content wallet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{wallet.connected ? 'Wallet Connected' : 'Connect Wallet'}</h3>
              <button
                className="modal-close"
                onClick={() => useAppState.getState().setShowWalletModal(false)}
              >
                &times;
              </button>
            </div>

            {wallet.connected ? (
              <div className="wallet-connected-info">
                <div className="wallet-address">
                  <span className="wallet-label">Address</span>
                  <span className="wallet-value">{shortenAddress(wallet.publicKey)}</span>
                </div>
                <div className="wallet-balance-row">
                  <span className="wallet-label">Balance</span>
                  <span className="wallet-value">{wallet.balance.toFixed(4)} SOL</span>
                </div>
                <div className="wallet-provider-row">
                  <span className="wallet-label">Provider</span>
                  <span className="wallet-value">{wallet.name}</span>
                </div>
                <button className="btn btn-danger wallet-disconnect" onClick={handleWalletDisconnect}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="wallet-list">
                {Object.entries(CONFIG.WALLETS).map(([key, w]) => (
                  <button
                    key={key}
                    className="wallet-option"
                    onClick={() => handleWalletConnect(key)}
                  >
                    <img src={w.icon} alt={w.name} width={32} height={32} />
                    <span>{w.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Execution Modal */}
      {showExecModal && execPool && (
        <div className="modal-overlay" onClick={handleExecClose}>
          <div className="modal-content exec-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Execute — {execPool.name}</h3>
              <button className="modal-close" onClick={handleExecClose}>&times;</button>
            </div>

            <div className="exec-pool-info">
              <div className="exec-row">
                <span>Protocol</span>
                <span>{execPool.protocol}</span>
              </div>
              <div className="exec-row">
                <span>TVL</span>
                <span>{formatNumber(execPool.tvl)}</span>
              </div>
              <div className="exec-row">
                <span>APR</span>
                <span>{execPool.apr}%</span>
              </div>
              <div className="exec-row">
                <span>24h Fees</span>
                <span>{formatNumber(execPool.fees)}</span>
              </div>
            </div>

            <div className="exec-input-group">
              <label>Amount (SOL)</label>
              <input
                type="number"
                className="exec-input"
                placeholder="0.00"
                value={execAmount}
                onChange={(e) => {
                  setExecAmount(e.target.value);
                  setExecQuote(null);
                }}
                min="0"
                step="0.01"
              />
              {wallet.connected && (
                <div className="exec-balance">
                  Balance: {wallet.balance.toFixed(4)} SOL
                  <button
                    className="exec-max-btn"
                    onClick={() => setExecAmount(String(Math.max(0, wallet.balance - 0.01).toFixed(4)))}
                  >
                    MAX
                  </button>
                </div>
              )}
            </div>

            {execQuote && (
              <div className="exec-quote">{execQuote}</div>
            )}

            <div className="exec-actions">
              <button
                className="btn btn-secondary"
                onClick={handleExecQuote}
                disabled={execLoading || !execAmount}
              >
                {execLoading ? 'Getting Quote...' : 'Get Quote'}
              </button>
              <button
                className="btn btn-primary"
                disabled={!wallet.connected || !execQuote}
                onClick={() => {
                  metricsService.track('execution_attempt', { pool: execPool.id, amount: execAmount });
                  window.open(
                    execPool.protocol === 'Raydium CLMM'
                      ? `https://raydium.io/clmm/create-position/?pool_id=${execPool.address || execPool.id}`
                      : execPool.protocol === 'Meteora DLMM'
                        ? `https://app.meteora.ag/dlmm/${execPool.address || execPool.id}`
                        : `https://app.meteora.ag/dammv2/${execPool.address || execPool.id}`,
                    '_blank'
                  );
                }}
              >
                {wallet.connected ? 'Execute on DEX' : 'Connect Wallet First'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
