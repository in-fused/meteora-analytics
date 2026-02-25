import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { Pool, Opportunity, PoolTransaction } from '@/types';
import {
  formatNumber,
  formatPrice,
  formatTime,
  truncate,
  shortenAddress,
  getPoolUrl,
  getPoolDexName,
  getPoolTypeLabel,
} from '@/lib/utils';
import { useAppState } from '@/hooks/useAppState';
import { wsService } from '@/services/wsService';

interface PoolCardProps {
  pool: Pool;
  rank: number;
  isOpp?: boolean;
}

export function PoolCard({ pool, rank, isOpp = false }: PoolCardProps) {
  const [copied, setCopied] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [loadingTooLong, setLoadingTooLong] = useState(false);
  const togglingRef = useRef(false);

  const expandedPoolId = useAppState((s) => s.expandedPoolId);
  const expandedOppId = useAppState((s) => s.expandedOppId);
  const poolTransactions = useAppState((s) => s.poolTransactions[pool.id] ?? []);
  const wsConnected = useAppState((s) => s.wsConnected);
  const togglePool = useAppState((s) => s.togglePool);
  const toggleOpp = useAppState((s) => s.toggleOpp);

  const opp = isOpp ? (pool as Opportunity) : null;
  const isExpanded = isOpp
    ? expandedOppId === pool.id
    : expandedPoolId === pool.id;

  const addr = pool.address || pool.id;
  const sc = pool.score >= 75 ? 'high' : pool.score >= 55 ? 'medium' : 'low';
  const typeLabel = getPoolTypeLabel(pool);
  const poolUrl = getPoolUrl(pool);
  const dexName = getPoolDexName(pool);
  const solscanUrl = `https://solscan.io/account/${addr}`;

  // Farm badge
  const farmBadge = pool.farmActive
    ? { label: '🌾 Active', cls: 'farm' }
    : pool.hasFarm
      ? { label: '🌾 Farm', cls: 'farm' }
      : null;

  // Subscribe to pool when expanded
  useEffect(() => {
    if (isExpanded && addr) {
      wsService.subscribeToPool(addr);
    }
    return () => {
      if (addr) {
        wsService.unsubscribeFromPool(addr);
      }
    };
  }, [isExpanded, addr]);

  // Track if loading is taking too long (show message after 10s)
  useEffect(() => {
    if (!isExpanded || poolTransactions.length > 0) {
      setLoadingTooLong(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTooLong(true), 10_000);
    return () => clearTimeout(timer);
  }, [isExpanded, poolTransactions.length]);

  // Debounced click handler
  const handleToggle = useCallback(() => {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setTimeout(() => { togglingRef.current = false; }, 200);

    if (isOpp) {
      toggleOpp(pool.id);
    } else {
      togglePool(pool.id);
    }
  }, [isOpp, pool.id, togglePool, toggleOpp]);

  const handleQuickDeposit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      // Open ExecutionLayer modal via store
      useAppState.getState().setShowExecModal?.(true);
      useAppState.getState().setExecPool?.(pool);
    },
    [pool]
  );

  const handleCopyAddress = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(addr).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [addr]
  );

  // Bins — real on-chain data from DLMM SDK (fetched on pool expand)
  const bins = pool.bins && pool.bins.length > 0 ? pool.bins : [];
  const maxLiquidity = bins.length > 0 ? Math.max(...bins.map((b) => b.liquidity)) : 1;
  const totalLiquidity = bins.length > 0 ? bins.reduce((s, b) => s + b.liquidity, 0) : 1;
  const hasRealBins = bins.length > 0; // All bins are now real (no more synthetic)
  const activeBinIndex = pool.activeBin >= 0 && pool.activeBin < bins.length ? pool.activeBin : Math.floor(bins.length / 2);
  const isDLMM = pool.protocol === 'Meteora DLMM';
  const binsLoading = isExpanded && bins.length === 0 && isDLMM;

  // Opp type class
  const oppTypeClass = opp
    ? opp.oppType === 'hot'
      ? 'opp-hot'
      : opp.oppType === 'active'
        ? 'opp-active'
        : 'opp-standard'
    : '';

  // Transaction type icons
  const txIcons: Record<string, string> = { add: '+', remove: '-', swap: '⇄' };

  // Advanced info items (matches monolith renderAdvancedInfo exactly)
  const advItems: { label: string; value: string; highlight: boolean }[] = [];

  if ((pool.fees1h ?? 0) > 0) {
    advItems.push({ label: 'Fees 1h:', value: formatNumber(pool.fees1h), highlight: true });
  }
  if ((pool.fees1h ?? 0) > 0 && pool.fees > 0) {
    const projected = (pool.fees1h ?? 0) * 24;
    const vs24h = ((projected / pool.fees - 1) * 100).toFixed(0);
    advItems.push({
      label: 'Projected 24h:',
      value: `${formatNumber(projected)} (${Number(vs24h) > 0 ? '+' : ''}${vs24h}%)`,
      highlight: Number(vs24h) > 0,
    });
  }
  if ((pool.feeTvlRatio1h ?? 0) > 0) {
    advItems.push({ label: 'Fee/TVL 1h:', value: `${((pool.feeTvlRatio1h ?? 0) * 100).toFixed(4)}%`, highlight: true });
  }
  if (pool.fees > 0) {
    advItems.push({ label: 'Fees 24h:', value: formatNumber(pool.fees), highlight: false });
  }
  if (pool.feeBps) {
    advItems.push({ label: 'Base Fee:', value: `${pool.feeBps}%`, highlight: false });
  }
  if (pool.binStep > 1) {
    advItems.push({ label: 'Bin Step:', value: `${pool.binStep}`, highlight: false });
  }
  if (pool.farmApr && pool.farmApr > 0) {
    advItems.push({ label: 'Farm APR:', value: `+${pool.farmApr}%`, highlight: false });
  }
  if ((pool.feeTvlRatio ?? 0) > 0) {
    advItems.push({ label: 'Fee/TVL 24h:', value: `${((pool.feeTvlRatio ?? 0) * 100).toFixed(3)}%`, highlight: false });
  }
  if (pool.volumeToTvl > 0) {
    advItems.push({ label: 'Vol/TVL:', value: `${(pool.volumeToTvl * 100).toFixed(0)}%`, highlight: false });
  }
  if ((pool.cumulativeTradeVolume ?? 0) > 0) {
    advItems.push({ label: 'All-time Vol:', value: formatNumber(pool.cumulativeTradeVolume), highlight: false });
  }

  // --- Render for Opportunity card ---
  if (isOpp && opp) {
    return (
      <div
        className={`opp-card ${oppTypeClass} ${isExpanded ? 'expanded' : ''}`}
        data-opp-id={pool.id}
      >
        {rank > 0 && <div className={`opp-rank ${rank <= 3 ? 'top3' : ''}`}>{rank}</div>}
        <div className="opp-card-main" onClick={handleToggle}>
          <div className="opp-header">
            <div className="opp-pool">
              <div className="opp-pool-icons">
                <div className="opp-pool-icon">{pool.icon1}</div>
                <div className="opp-pool-icon">{pool.icon2}</div>
              </div>
              <div className="opp-pool-info">
                <h3>{pool.name}<span className="pool-type-badge">{typeLabel}</span></h3>
              </div>
            </div>
            <div className="opp-score">
              <div className="opp-score-value">{pool.score}</div>
              <div className="opp-score-label">Score</div>
            </div>
          </div>
          <div className="opp-metrics">
            <div className="opp-metric">
              <div className="opp-metric-value">{formatNumber(pool.tvl)}</div>
              <div className="opp-metric-label">TVL</div>
            </div>
            <div className="opp-metric">
              <div className="opp-metric-value">{formatNumber(pool.volume)}</div>
              <div className="opp-metric-label">Volume</div>
            </div>
            <div className="opp-metric">
              <div className="opp-metric-value positive">{pool.apr}%</div>
              <div className="opp-metric-label">APR</div>
            </div>
            <div className="opp-metric">
              <div className="opp-metric-value">{(pool.volumeToTvl * 100).toFixed(0)}%</div>
              <div className="opp-metric-label">Vol/TVL</div>
            </div>
          </div>
          <div className="opp-reason">
            <div className="opp-reason-title">
              {opp.oppType === 'hot' ? '🔥' : opp.oppType === 'active' ? '⚡' : '💡'} Opportunity
            </div>
            <div className="opp-reason-text">{opp.reason}</div>
            {opp.suggestion && <div className="opp-suggestion">{opp.suggestion}</div>}
            {opp.suggestionDetail && (
              <button className="opp-detail-toggle" onClick={(e) => { e.stopPropagation(); setShowDetail(!showDetail); }}>
                {showDetail ? 'Hide details' : 'Strategy details'}
              </button>
            )}
            {showDetail && opp.suggestionDetail && (
              <div className="opp-suggestion-detail">{opp.suggestionDetail}</div>
            )}
          </div>
          <div className="opp-expand-hint">Click to expand</div>
        </div>
        <div className="opp-expanded">
          <div className="opp-expanded-inner">
            {/* Action buttons */}
            <div className="pool-actions">
              <button className="pool-action-btn primary" onClick={handleQuickDeposit}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20" /></svg>
                Quick Deposit
              </button>
              <a href={`https://jup.ag/swap/SOL-${pool.mintX}`} target="_blank" rel="noopener noreferrer" className="pool-action-btn" onClick={(e) => e.stopPropagation()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                Swap
              </a>
              <a href={poolUrl} target="_blank" rel="noopener noreferrer" className="pool-action-btn" onClick={(e) => e.stopPropagation()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15,3 21,3 21,9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                {dexName}
              </a>
              <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="pool-action-btn" onClick={(e) => e.stopPropagation()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                Solscan
              </a>
              <button className="pool-action-btn" onClick={handleCopyAddress}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Liquidity chart */}
            {bins.length > 0 ? (
              <div className="chart-section">
                <div className="chart-header">
                  <span className="chart-title">Liquidity Distribution ({bins.length} Bins)</span>
                  <div className="chart-legend">
                    <div className="legend-item"><div className="legend-dot liquidity" />Liquidity</div>
                    <div className="legend-item"><div className="legend-dot active" />Active Bin</div>
                    <div className="legend-item" style={{ fontSize: 9, opacity: 0.7 }}>On-chain</div>
                  </div>
                </div>
                <div className="bins-container">
                  {bins.map((bin, i) => (
                    <div
                      key={bin.id}
                      className={`bin ${i === activeBinIndex ? 'active-bin' : ''}`}
                      style={{ height: `${(bin.liquidity / maxLiquidity) * 100}%` }}
                    >
                      <div className="bin-tooltip">
                        <div className="bin-tooltip-row"><span className="bin-tooltip-label">Price</span><span className="bin-tooltip-value">${formatPrice(bin.price)}</span></div>
                        <div className="bin-tooltip-row"><span className="bin-tooltip-label">Liq</span><span className="bin-tooltip-value">{((bin.liquidity / totalLiquidity) * 100).toFixed(1)}%</span></div>
                        <div className="bin-tooltip-row"><span className="bin-tooltip-label">Bin</span><span className="bin-tooltip-value">#{bin.id}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="chart-axis">
                  <span className="axis-label">${formatPrice(bins[0].price)}</span>
                  <span className="axis-label active">${formatPrice(bins[activeBinIndex]?.price ?? pool.currentPrice)}</span>
                  <span className="axis-label">${formatPrice(bins[bins.length - 1]?.price)}</span>
                </div>
              </div>
            ) : binsLoading ? (
              <div className="chart-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                <div className="loading-spinner" style={{ marginRight: 8 }} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading on-chain bin data...</span>
              </div>
            ) : null}

            {/* Transaction feed */}
            <div className="pool-tx-section">
              <div className="pool-tx-header">
                <span className="pool-tx-title"><span className={`status-dot ${wsConnected ? 'live' : ''}`} />Live Transactions</span>
                <span className="pool-tx-status" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{poolTransactions.length > 0 ? `${poolTransactions.length} txs` : (wsConnected ? 'Listening...' : 'Connecting...')}</span>
              </div>
              <div className="pool-tx-list">
                {poolTransactions.length > 0 ? (
                  poolTransactions.map((tx: PoolTransaction) => (
                    <div key={tx.signature} className="pool-tx-item">
                      <div className={`pool-tx-type ${tx.type}`}>{txIcons[tx.type]}</div>
                      <div className="pool-tx-info">
                        <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noopener noreferrer">{truncate(tx.signature)}</a>
                      </div>
                      <div className={`pool-tx-amount ${tx.type === 'add' ? 'positive' : tx.type === 'remove' ? 'negative' : ''}`}>
                        {formatNumber(parseFloat(tx.amount))}
                      </div>
                      <div className="pool-tx-time">{formatTime(tx.timestamp)}</div>
                    </div>
                  ))
                ) : (
                  <div className="pool-tx-empty">
                    {loadingTooLong ? (
                      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>No recent activity on this pool — watching for new transactions...</span>
                    ) : (
                      <>
                        <div className="loading-spinner" style={{ marginBottom: 8 }} />
                        <span>Loading transactions...</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Render for Pool card ---
  return (
    <div
      className={`pool-card score-${sc} ${isExpanded ? 'expanded' : ''} ${pool.isHot ? 'is-hot' : ''}`}
      data-pool-id={pool.id}
    >
      <div className={`pool-rank ${rank <= 3 ? 'top3' : ''}`}>{rank}</div>
      {pool.isHot && <div className="hot-indicator">🔥</div>}
      <div className="pool-card-main" onClick={handleToggle}>
        <div className="pool-header">
          <div className="pool-pair">
            <div className="pool-icons">
              <div className="pool-icon">{pool.icon1}</div>
              <div className="pool-icon">{pool.icon2}</div>
            </div>
            <div className="pool-info">
              <h3>{pool.name}<span className="pool-type-badge">{typeLabel}</span></h3>
            </div>
          </div>
          <div className="pool-badges">
            <span className={`score-badge ${sc}`}>{pool.score}</span>
            <span className={`safety-dot ${pool.safety}`} title={pool.safety} />
          </div>
        </div>
        <div className="pool-stats">
          <div className="pool-stat">
            <div className="pool-stat-label">TVL</div>
            <div className="pool-stat-value">{formatNumber(pool.tvl)}</div>
          </div>
          <div className="pool-stat">
            <div className="pool-stat-label">Vol 24h</div>
            <div className="pool-stat-value">{formatNumber(pool.volume)}</div>
          </div>
          <div className="pool-stat">
            <div className="pool-stat-label">APR</div>
            <div className="pool-stat-value accent">{pool.apr}%</div>
          </div>
          <div className={`pool-stat ${(pool.fees1h ?? 0) > 0 ? 'has-1h' : ''}`}>
            <div className="pool-stat-label">{(pool.fees1h ?? 0) > 0 ? 'Fees 1h' : 'Fees 24h'}</div>
            <div className="pool-stat-value">{(pool.fees1h ?? 0) > 0 ? formatNumber(pool.fees1h) : formatNumber(pool.fees)}</div>
          </div>
        </div>
        {(pool.isHot || farmBadge) && (
          <div className="pool-badges-row">
            {pool.isHot && <span className="mini-badge hot">🔥 Hot</span>}
            {farmBadge && <span className={`mini-badge ${farmBadge.cls}`}>{farmBadge.label}</span>}
          </div>
        )}
        <div className="pool-expand-hint">Click to expand</div>
      </div>
      <div className="pool-expanded">
        <div className="pool-expanded-inner">
          {/* Action buttons */}
          <div className="pool-actions">
            <button className="pool-action-btn primary" onClick={handleQuickDeposit}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20" /></svg>
              Quick Deposit
            </button>
            <a href={poolUrl} target="_blank" rel="noopener noreferrer" className="pool-action-btn" onClick={(e) => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15,3 21,3 21,9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
              {dexName}
            </a>
            <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="pool-action-btn" onClick={(e) => e.stopPropagation()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              Solscan
            </a>
            <button className="pool-action-btn" onClick={handleCopyAddress}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Liquidity chart */}
          {bins.length > 0 ? (
            <div className="chart-section">
              <div className="chart-header">
                <span className="chart-title">Liquidity Distribution ({bins.length} Bins)</span>
                <div className="chart-legend">
                  <div className="legend-item"><div className="legend-dot liquidity" />Liquidity</div>
                  <div className="legend-item"><div className="legend-dot active" />Active Bin</div>
                  <div className="legend-item" style={{ fontSize: 9, opacity: 0.7 }}>On-chain</div>
                </div>
              </div>
              <div className="bins-container">
                {bins.map((bin, i) => (
                  <div
                    key={bin.id}
                    className={`bin ${i === activeBinIndex ? 'active-bin' : ''}`}
                    style={{ height: `${(bin.liquidity / maxLiquidity) * 100}%` }}
                  >
                    <div className="bin-tooltip">
                      <div className="bin-tooltip-row"><span className="bin-tooltip-label">Price</span><span className="bin-tooltip-value">${formatPrice(bin.price)}</span></div>
                      <div className="bin-tooltip-row"><span className="bin-tooltip-label">Liq</span><span className="bin-tooltip-value">{((bin.liquidity / totalLiquidity) * 100).toFixed(1)}%</span></div>
                      <div className="bin-tooltip-row"><span className="bin-tooltip-label">Bin</span><span className="bin-tooltip-value">#{bin.id}</span></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="chart-axis">
                <span className="axis-label">${formatPrice(bins[0].price)}</span>
                <span className="axis-label active">${formatPrice(bins[activeBinIndex]?.price ?? pool.currentPrice)}</span>
                <span className="axis-label">${formatPrice(bins[bins.length - 1]?.price)}</span>
              </div>
            </div>
          ) : binsLoading ? (
            <div className="chart-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              <div className="loading-spinner" style={{ marginRight: 8 }} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading on-chain bin data...</span>
            </div>
          ) : null}

          {/* Transaction feed */}
          <div className="pool-tx-section">
            <div className="pool-tx-header">
              <span className="pool-tx-title"><span className={`status-dot ${wsConnected ? 'live' : ''}`} />Live Transactions</span>
              <span className="pool-tx-status" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{poolTransactions.length > 0 ? `${poolTransactions.length} txs` : (wsConnected ? 'Listening...' : 'Connecting...')}</span>
            </div>
            <div className="pool-tx-list">
              {poolTransactions.length > 0 ? (
                poolTransactions.map((tx: PoolTransaction) => (
                  <div key={tx.signature} className="pool-tx-item">
                    <div className={`pool-tx-type ${tx.type}`}>{txIcons[tx.type]}</div>
                    <div className="pool-tx-info">
                      <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noopener noreferrer">{truncate(tx.signature)}</a>
                    </div>
                    <div className={`pool-tx-amount ${tx.type === 'add' ? 'positive' : tx.type === 'remove' ? 'negative' : ''}`}>
                      {formatNumber(parseFloat(tx.amount))}
                    </div>
                    <div className="pool-tx-time">{formatTime(tx.timestamp)}</div>
                  </div>
                ))
              ) : (
                <div className="pool-tx-empty">
                  {loadingTooLong ? (
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>No recent activity on this pool — watching for new transactions...</span>
                  ) : (
                    <>
                      <div className="loading-spinner" style={{ marginBottom: 8 }} />
                      <span>Loading transactions...</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Advanced info */}
          {advItems.length > 0 && (
            <div className="pool-advanced-info">
              <h4>Details</h4>
              <div className="advanced-grid">
                {advItems.map((item) => (
                  <div key={item.label} className={`adv-item ${item.highlight ? 'highlight' : ''}`}>
                    <span>{item.label}</span> {item.value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
