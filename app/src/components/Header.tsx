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
  { key: 'helius', label: 'Helius WS' },
  { key: 'raydium', label: 'Raydium' },
];

export function Header({ onRefresh }: HeaderProps) {
  const wallet = useAppState((s) => s.wallet);
  const apiStatus = useAppState((s) => s.apiStatus);
  const activeTab = useAppState((s) => s.activeTab);
  const setActiveTab = useAppState((s) => s.setActiveTab);
  const triggeredAlerts = useAppState((s) => s.triggeredAlerts);
  const opportunities = useAppState((s) => s.opportunities);

  const unreadAlerts = triggeredAlerts.filter((a) => !a.read).length;
  const anyConnected = apiStatus.meteora || apiStatus.raydium;

  const handleWalletClick = async () => {
    if (wallet.connected) {
      await walletService.disconnect();
    } else {
      await walletService.connect('phantom');
    }
  };

  return (
    <header className="header">
      <div className="logo">
        <div className="logo-mark">LP</div>
        <div className="logo-text">
          Liquidity<span>Pro</span>
        </div>
      </div>

      <div className="header-status">
        <div className="status-pill">
          <span className={`status-dot ${anyConnected ? 'live' : 'error'}`} />
          <span>{anyConnected ? 'Live' : 'Connecting...'}</span>
        </div>
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
        <div className="alert-bell-wrapper" style={{ position: 'relative' }}>
          <button className="alert-bell" title="Alert Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unreadAlerts > 0 && (
              <span className="alert-bell-count">{unreadAlerts}</span>
            )}
          </button>
        </div>

        <button
          className={`btn btn--wallet ${wallet.connected ? 'connected' : ''}`}
          onClick={handleWalletClick}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 7V4a1 1 0 00-1-1H5a2 2 0 000 4h15a1 1 0 011 1v4h-3a2 2 0 000 4h3a1 1 0 001-1v-3" />
          </svg>
          {wallet.connected ? shortenAddress(wallet.publicKey) : 'Connect Wallet'}
        </button>

        <button className="btn btn--secondary btn--sm" onClick={onRefresh} title="Refresh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'opportunities' ? 'active' : ''}`}
          data-tab="opportunities"
          onClick={() => setActiveTab('opportunities')}
        >
          AI Opportunities
          <span className="tab-badge">{opportunities.length}</span>
        </button>
        <button
          className={`nav-tab ${activeTab === 'alerts' ? 'active' : ''}`}
          data-tab="alerts"
          onClick={() => setActiveTab('alerts')}
        >
          Search &amp; Alerts
        </button>
        <button
          className={`nav-tab ${activeTab === 'guide' ? 'active' : ''}`}
          data-tab="guide"
          onClick={() => setActiveTab('guide')}
        >
          Guide
        </button>
      </nav>
    </header>
  );
}
