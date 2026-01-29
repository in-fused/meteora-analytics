import { useState, useCallback } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { walletService } from '@/services/walletService';
import { shortenAddress } from '@/lib/utils';
import type { ApiStatus } from '@/types';

interface HeaderProps {
  onRefresh: () => void;
}

const API_LABELS: { key: keyof ApiStatus; label: string }[] = [
  { key: 'meteora', label: 'Meteora' },
  { key: 'jupiter', label: 'Jupiter' },
  { key: 'helius', label: 'Helius' },
  { key: 'raydium', label: 'Raydium' },
];

const TAB_CONFIG = [
  { id: 'opportunities', label: 'AI Opportunities', hasBadge: true },
  { id: 'all-pools', label: 'All Pools', hasBadge: false },
  { id: 'search-alerts', label: 'Search & Alerts', hasBadge: false },
  { id: 'guide', label: 'Guide', hasBadge: false },
] as const;

export function Header({ onRefresh }: HeaderProps) {
  const wallet = useAppState((s) => s.wallet);
  const apiStatus = useAppState((s) => s.apiStatus);
  const activeTab = useAppState((s) => s.activeTab);
  const setActiveTab = useAppState((s) => s.setActiveTab);
  const triggeredAlerts = useAppState((s) => s.triggeredAlerts);
  const markTriggeredAlertsRead = useAppState((s) => s.markTriggeredAlertsRead);
  const opportunities = useAppState((s) => s.opportunities);
  const jupshieldEnabled = useAppState((s) => s.jupshieldEnabled);
  const setJupshieldEnabled = useAppState((s) => s.setJupshieldEnabled);
  const lastRefresh = useAppState((s) => s.lastRefresh);
  const setShowWalletModal = useAppState((s) => s.setShowWalletModal);

  const [alertDropdownOpen, setAlertDropdownOpen] = useState(false);

  const unreadAlerts = triggeredAlerts.filter((a) => !a.read).length;

  const formatLastRefresh = useCallback(() => {
    if (!lastRefresh) return 'Never';
    const seconds = Math.floor((Date.now() - lastRefresh) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  }, [lastRefresh]);

  const handleWalletClick = () => {
    if (wallet.connected) {
      walletService.disconnect();
    } else {
      setShowWalletModal(true);
    }
  };

  const handleMarkAllRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markTriggeredAlertsRead();
  };

  const toggleAlertDropdown = () => {
    setAlertDropdownOpen((prev) => !prev);
  };

  return (
    <header className="header">
      <div className="logo">
        <div className="logo-mark">LP</div>
        <div className="logo-text">
          Liquidity<span>Pro</span>
        </div>
      </div>

      <nav className="nav-tabs">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
            data-tab={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.hasBadge && (
              <span className="tab-badge">{opportunities.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="header-status">
        <div className="api-badges">
          {API_LABELS.map(({ key, label }) => (
            <span
              key={key}
              className={`api-badge ${apiStatus[key] ? 'active' : 'error'}`}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="header-actions">
        {/* Alert Bell */}
        <div className="alert-bell-wrapper" style={{ position: 'relative' }}>
          <button
            className="alert-bell"
            title="Alert Notifications"
            onClick={toggleAlertDropdown}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unreadAlerts > 0 && (
              <span className="alert-bell-count">{unreadAlerts}</span>
            )}
          </button>

          {alertDropdownOpen && (
            <div className="alert-dropdown">
              <div className="alert-dropdown-header">
                <span>Notifications</span>
                {unreadAlerts > 0 && (
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={handleMarkAllRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="alert-dropdown-list">
                {triggeredAlerts.length === 0 ? (
                  <div className="alert-dropdown-empty">No alerts yet</div>
                ) : (
                  triggeredAlerts.map((alert) => (
                    <div
                      key={`${alert.id}-${alert.triggeredAt}`}
                      className={`alert-dropdown-item ${!alert.read ? 'unread' : ''}`}
                    >
                      <div className="alert-dropdown-item-title">
                        {alert.poolName}
                      </div>
                      <div className="alert-dropdown-item-detail">
                        {alert.metric.toUpperCase()} {alert.condition}{' '}
                        {alert.value} (current: {alert.currentValue.toFixed(2)})
                      </div>
                      <div className="alert-dropdown-item-time">
                        {new Date(alert.triggeredAt).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* JupShield Toggle */}
        <button
          className={`btn btn--sm ${jupshieldEnabled ? 'btn--success' : 'btn--secondary'}`}
          onClick={() => setJupshieldEnabled(!jupshieldEnabled)}
          title="JupShield: Filter unverified tokens"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          JupShield
        </button>

        {/* Wallet Button */}
        <button
          className={`btn btn--wallet ${wallet.connected ? 'connected' : ''}`}
          onClick={handleWalletClick}
        >
          {wallet.connected ? (
            <>
              <span className="wallet-dot" style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#00e676',
                display: 'inline-block',
                marginRight: 6,
              }} />
              {shortenAddress(wallet.publicKey)}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <path d="M19 7V4a1 1 0 00-1-1H5a2 2 0 000 4h15a1 1 0 011 1v4h-3a2 2 0 000 4h3a1 1 0 001-1v-3" />
              </svg>
              Connect Wallet
            </>
          )}
        </button>

        {/* Refresh Button */}
        <button
          className="btn btn--secondary btn--sm"
          onClick={onRefresh}
          title={`Last refresh: ${formatLastRefresh()}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          <span className="refresh-time">{formatLastRefresh()}</span>
        </button>
      </div>
    </header>
  );
}
