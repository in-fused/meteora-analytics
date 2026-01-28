import { useEffect, useCallback } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { dataService } from '@/services/dataService';
import { wsService } from '@/services/wsService';
import { walletService } from '@/services/walletService';
import { detectOpportunities } from '@/lib/utils';
import { CONFIG } from '@/config';

import { Particles } from '@/components/Particles';
import { Header } from '@/components/Header';
import { HeroSection } from '@/components/HeroSection';
import { OpportunitiesSection } from '@/components/OpportunitiesSection';
import { SearchAlertsSection } from '@/components/SearchAlertsSection';
import { GuideSection } from '@/components/GuideSection';

export default function App() {
  const activeTab = useAppState((s) => s.activeTab);
  const isInitializing = useAppState((s) => s.isInitializing);
  const loadProgress = useAppState((s) => s.loadProgress);
  const loadMessage = useAppState((s) => s.loadMessage);
  const pools = useAppState((s) => s.pools);

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const init = async () => {
      const store = useAppState.getState();
      try {
        store.setLoadProgress(10, 'Loading token data...');
        await dataService.fetchJupiterTokens();

        store.setLoadProgress(25, 'Fetching pool data...');
        await dataService.fetchPools();

        store.setLoadProgress(60, 'Detecting opportunities...');
        const opps = detectOpportunities(store.pools);
        store.setOpportunities(opps);

        store.setLoadProgress(75, 'Applying filters...');
        dataService.applyFilters();

        store.setLoadProgress(90, 'Connecting services...');
        wsService.connect();
        walletService.autoConnect().catch(() => {});

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
      // Skip if user is interacting or page hidden
      if (store.expandedPoolId || store.expandedOppId || document.hidden) return;
      if (Date.now() - store.lastRefresh < 30000) return;

      try {
        await dataService.fetchPools();
        const opps = detectOpportunities(store.pools);
        store.setOpportunities(opps);
        dataService.applyFilters();
        store.setLastRefresh(Date.now());
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
      const opps = detectOpportunities(store.pools);
      store.setOpportunities(opps);
      dataService.applyFilters();
      store.setLastRefresh(Date.now());
    } catch (err) {
      console.error('[App] Refresh failed:', err);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  if (isInitializing) {
    return (
      <div className="loader-overlay">
        <Particles />
        <div className="bg-overlay" />
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

  return (
    <div className="app">
      <Particles />
      <div className="bg-overlay" />

      <Header onRefresh={handleRefresh} />
      <HeroSection />

      {/* Tab Content */}
      <div className={`tab-content ${activeTab === 'opportunities' ? 'active' : ''}`} id="opportunities-tab">
        <OpportunitiesSection />
      </div>

      <div className={`tab-content ${activeTab === 'alerts' ? 'active' : ''}`} id="alerts-tab">
        <SearchAlertsSection />
      </div>

      <div className={`tab-content ${activeTab === 'guide' ? 'active' : ''}`} id="guide-tab">
        <GuideSection />
      </div>

      {/* Toast Container */}
      <div id="toastContainer" className="toast-container" />
    </div>
  );
}
