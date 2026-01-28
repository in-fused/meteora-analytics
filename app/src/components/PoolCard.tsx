import React, { useEffect, useCallback, useState } from 'react';
import type { Pool, Opportunity, PoolTransaction } from '@/types';
import {
  getScoreClass,
  formatNumber,
  formatTime,
  formatPrice,
  getPoolUrl,
  getPoolDexName,
  getPoolTypeLabel,
  shortenAddress,
} from '@/lib/utils';
import { useAppState } from '@/hooks/useAppState';
import { wsService } from '@/services/wsService';

interface PoolCardProps {
  pool: Pool;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
  variant?: 'pool' | 'opportunity';
}

export function PoolCard({ pool, rank, isExpanded, onToggle, variant = 'pool' }: PoolCardProps) {
  const [copied, setCopied] = useState(false);
  const poolTransactions = useAppState((s) => s.poolTransactions[pool.id] ?? []);
  const wsConnected = useAppState((s) => s.wsConnected);

  const scoreClass = getScoreClass(pool.score);
  const isOpp = variant === 'opportunity';
  const opp = isOpp ? (pool as Opportunity) : null;

  // Subscribe/unsubscribe to pool transactions when expanded
  useEffect(() => {
    if (isExpanded && pool.address) {
      wsService.subscribeToPool(pool.address);
    } else if (!isExpanded && pool.address) {
      wsService.unsubscribeFromPool(pool.address);
    }
    return () => {
      if (pool.address) {
        wsService.unsubscribeFromPool(pool.address);
      }
    };
  }, [isExpanded, pool.address]);

  const handleCopyAddress = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const addr = pool.address || pool.id;
      navigator.clipboard.writeText(addr).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [pool.address, pool.id]
  );

  const handleQuickDeposit = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      console.log('[ExecutionLayer] Quick Deposit triggered for pool:', pool.id, pool.name);
    },
    [pool.id, pool.name]
  );

  // Determine opportunity-specific class
  const oppClass = opp
    ? opp.oppType === 'hot'
      ? 'opp-hot'
      : opp.oppType === 'active'
        ? 'opp-active'
        : 'opp-standard'
    : '';

  const rootClasses = [
    'pool-card',
    isExpanded && 'expanded',
    `score-${scoreClass}`,
    pool.isHot && 'is-hot',
    isOpp && 'opp-card',
    isOpp && oppClass,
  ]
    .filter(Boolean)
    .join(' ');

  // Compute bin chart data
  const bins = pool.bins && pool.bins.length > 0 ? pool.bins : [];
  const maxLiquidity = bins.length > 0 ? Math.max(...bins.map((b) => b.liquidity)) : 1;

  const solscanUrl = `https://solscan.io/account/${pool.address || pool.id}`;

  return (
    <div className={rootClasses} data-pool-id={pool.id}>
      {/* Collapsed: clickable main area */}
      <div className="pool-card-main" onClick={onToggle}>
        {/* Rank badge */}
        <div className={`pool-rank${rank <= 3 ? ' top3' : ''}`}>{rank}</div>

        {/* Hot indicator */}
        {pool.isHot && <span className="pool-hot-badge">🔥</span>}

        {/* Token icons */}
        <div className="pool-icons">
          {pool.icon1Url ? (
            <img className="pool-icon" src={pool.icon1Url} alt={pool.icon1} />
          ) : (
            <span className="pool-icon">{pool.icon1}</span>
          )}
          {pool.icon2Url ? (
            <img className="pool-icon" src={pool.icon2Url} alt={pool.icon2} />
          ) : (
            <span className="pool-icon">{pool.icon2}</span>
          )}
        </div>

        {/* Pool name and protocol label */}
        <div className="pool-name">
          {pool.name}
          <span className="pool-meta">{getPoolTypeLabel(pool)}</span>
        </div>

        {/* Score badge */}
        <div className={`pool-score ${scoreClass}`}>{pool.score}</div>

        {/* Safety dot */}
        <span
          className="pool-safety-dot"
          style={{
            backgroundColor:
              pool.safety === 'safe'
                ? '#22c55e'
                : pool.safety === 'warning'
                  ? '#f59e0b'
                  : '#ef4444',
          }}
          title={pool.safety}
        />

        {/* Farm badge */}
        {pool.farmActive && <span className="pool-farm-badge">Farm</span>}

        {/* Stats row */}
        <div className="pool-stats">
          <div className="pool-stat">
            <span className="pool-stat-label">TVL</span>
            <span className="pool-stat-value">{formatNumber(pool.tvl)}</span>
          </div>
          <div className="pool-stat">
            <span className="pool-stat-label">Vol 24h</span>
            <span className="pool-stat-value">{formatNumber(pool.volume)}</span>
          </div>
          <div className="pool-stat">
            <span className="pool-stat-label">APR</span>
            <span className="pool-stat-value">{pool.apr}%</span>
          </div>
          <div className="pool-stat">
            <span className="pool-stat-label">Fees 24h</span>
            <span className="pool-stat-value">{formatNumber(pool.fees)}</span>
          </div>
        </div>
      </div>

      {/* Opportunity reason */}
      {isOpp && opp && (
        <div className="opp-reason">{opp.reason}</div>
      )}

      {/* Expanded section */}
      {isExpanded && (
        <div className="pool-expanded">
          <div className="pool-expanded-inner">
            {/* Action buttons */}
            <div className="pool-actions">
              <button className="pool-action-btn" onClick={handleQuickDeposit}>
                Quick Deposit
              </button>
              <a
                className="pool-action-btn"
                href={getPoolUrl(pool)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Open on {getPoolDexName(pool)}
              </a>
              <a
                className="pool-action-btn"
                href={solscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Solscan
              </a>
              <button className="pool-action-btn" onClick={handleCopyAddress}>
                {copied ? 'Copied!' : `Copy ${shortenAddress(pool.address || pool.id)}`}
              </button>
            </div>

            {/* Liquidity distribution chart */}
            {bins.length > 0 && (
              <div className="pool-chart-section">
                <h4>Liquidity Distribution</h4>
                <div className="pool-bin-chart" style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '80px' }}>
                  {bins.slice(0, 21).map((bin) => (
                    <div
                      key={bin.id}
                      className={`pool-bin-bar${bin.isActive ? ' active' : ''}`}
                      style={{
                        flex: 1,
                        height: `${(bin.liquidity / maxLiquidity) * 100}%`,
                        backgroundColor: bin.isActive ? '#22c55e' : '#6366f1',
                        borderRadius: '2px 2px 0 0',
                        minHeight: '2px',
                      }}
                      title={`Price: ${formatPrice(bin.price)} | Liquidity: ${bin.liquidity.toFixed(1)}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Live transactions */}
            <div className="pool-tx-section">
              <h4>
                Live Transactions
                {wsConnected && <span className="ws-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e', marginLeft: 6 }} />}
              </h4>
              {poolTransactions.length > 0 ? (
                <div className="pool-tx-list">
                  {poolTransactions.map((tx: PoolTransaction) => (
                    <div key={tx.signature} className="pool-tx-item">
                      <span className={`tx-type tx-${tx.type}`}>
                        {tx.type === 'add' ? 'Add' : tx.type === 'remove' ? 'Remove' : 'Swap'}
                      </span>
                      <span className="tx-amount">{tx.amount} SOL</span>
                      <span className="tx-time">{formatTime(tx.timestamp)}</span>
                      <a
                        href={`https://solscan.io/tx/${tx.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-link"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {shortenAddress(tx.signature)}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pool-tx-empty">No recent transactions</p>
              )}
            </div>

            {/* Advanced metrics */}
            <div className="pool-advanced-metrics">
              <h4>Advanced Metrics</h4>
              <div className="pool-stats">
                {pool.feeTvlRatio != null && (
                  <div className="pool-stat">
                    <span className="pool-stat-label">Fee/TVL</span>
                    <span className="pool-stat-value">{(pool.feeTvlRatio * 100).toFixed(3)}%</span>
                  </div>
                )}
                {pool.fees1h != null && (
                  <div className="pool-stat">
                    <span className="pool-stat-label">Fees 1h</span>
                    <span className="pool-stat-value">{formatNumber(pool.fees1h)}</span>
                  </div>
                )}
                {pool.projectedFees24h != null && (
                  <div className="pool-stat">
                    <span className="pool-stat-label">Projected 24h</span>
                    <span className="pool-stat-value">{formatNumber(pool.projectedFees24h)}</span>
                  </div>
                )}
                {pool.fees4h != null && (
                  <div className="pool-stat">
                    <span className="pool-stat-label">Fees 4h</span>
                    <span className="pool-stat-value">{formatNumber(pool.fees4h)}</span>
                  </div>
                )}
                {pool.fees12h != null && (
                  <div className="pool-stat">
                    <span className="pool-stat-label">Fees 12h</span>
                    <span className="pool-stat-value">{formatNumber(pool.fees12h)}</span>
                  </div>
                )}
                <div className="pool-stat">
                  <span className="pool-stat-label">Vol/TVL</span>
                  <span className="pool-stat-value">{(pool.volumeToTvl * 100).toFixed(0)}%</span>
                </div>
                <div className="pool-stat">
                  <span className="pool-stat-label">Bin Step</span>
                  <span className="pool-stat-value">{pool.binStep}</span>
                </div>
                <div className="pool-stat">
                  <span className="pool-stat-label">Fee</span>
                  <span className="pool-stat-value">{pool.feeBps} bps</span>
                </div>
                <div className="pool-stat">
                  <span className="pool-stat-label">Price</span>
                  <span className="pool-stat-value">{formatPrice(pool.currentPrice)}</span>
                </div>
                {pool.farmActive && pool.farmApr != null && (
                  <div className="pool-stat">
                    <span className="pool-stat-label">Farm APR</span>
                    <span className="pool-stat-value">{pool.farmApr.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
