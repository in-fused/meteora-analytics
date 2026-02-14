import { useState, useMemo, useCallback } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { dataService } from '@/services/dataService';
import { PoolCard } from './PoolCard';
import { formatNumber } from '@/lib/utils';
import type { Pool, Alert, AlertMetric, AlertCondition } from '@/types';
import { supabaseService } from '@/services/supabaseService';

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH POOLS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function SearchPoolsPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pool[]>([]);
  const [showResults, setShowResults] = useState(false);
  const expandedPoolId = useAppState((s) => s.expandedPoolId);
  const togglePool = useAppState((s) => s.togglePool);

  const handleSearch = useCallback(() => {
    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }
    const found = dataService.searchPools(query);
    setResults(found);
    setShowResults(true);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSearch();
    },
    [handleSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  }, []);

  const columns = useMemo(() => {
    const colCount = window.innerWidth >= 1200 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    const cols: Pool[][] = Array.from({ length: colCount }, () => []);
    results.forEach((pool, i) => cols[i % colCount].push(pool));
    return cols;
  }, [results]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Search Pools
        </div>
      </div>
      <div className="panel-body">
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search by name, ticker, or address..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <button className="btn btn--primary btn--sm" onClick={handleSearch}>
            Search
          </button>
          {showResults && (
            <button className="btn btn--ghost btn--sm" onClick={handleClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {showResults && (
        <div className="search-results-section">
          <div className="search-results-header">
            <div className="search-results-title">
              <span>{results.length} Results</span>
            </div>
          </div>
          <div className="pools-container" id="searchResultsContainer">
            {results.length === 0 ? (
              <div className="alert-empty" style={{ textAlign: 'center', padding: 40, width: '100%' }}>
                <p>No pools found matching your search.</p>
              </div>
            ) : (
              columns.map((col, ci) => (
                <div key={ci} className="pool-column">
                  {col.map((pool, i) => (
                    <PoolCard
                      key={pool.id}
                      pool={pool}
                      rank={ci * Math.ceil(results.length / columns.length) + i + 1}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// POOL FILTERS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function PoolFiltersPanel() {
  const filters = useAppState((s) => s.filters);
  const setFilters = useAppState((s) => s.setFilters);
  const filteredPools = useAppState((s) => s.filteredPools);
  const expandedPoolId = useAppState((s) => s.expandedPoolId);
  const togglePool = useAppState((s) => s.togglePool);
  const [showResults, setShowResults] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const handleApply = useCallback(() => {
    setFilters(localFilters);
    dataService.applyFilters();
    setShowResults(true);
  }, [localFilters, setFilters]);

  const handleReset = useCallback(() => {
    const defaults = { minTvl: 0, minVolume: 0, safeOnly: false, farmOnly: false, poolType: 'all' as const, sortBy: 'score' as const };
    setLocalFilters((f) => ({ ...f, ...defaults }));
    setFilters(defaults);
    dataService.applyFilters();
    setShowResults(false);
  }, [setFilters]);

  const columns = useMemo(() => {
    if (!showResults) return [];
    const colCount = window.innerWidth >= 1200 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    const cols: Pool[][] = Array.from({ length: colCount }, () => []);
    filteredPools.slice(0, 60).forEach((pool, i) => cols[i % colCount].push(pool));
    return cols;
  }, [filteredPools, showResults]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Pool Filters
        </div>
      </div>
      <div className="panel-body">
        <div className="alert-form" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto' }}>
          <div className="form-group">
            <label className="form-label">Min TVL</label>
            <select
              className="form-select"
              value={localFilters.minTvl}
              onChange={(e) => setLocalFilters((f) => ({ ...f, minTvl: Number(e.target.value) }))}
            >
              <option value={0}>Any</option>
              <option value={1000}>$1K+</option>
              <option value={10000}>$10K+</option>
              <option value={100000}>$100K+</option>
              <option value={1000000}>$1M+</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Pool Type</label>
            <select
              className="form-select"
              value={localFilters.poolType}
              onChange={(e) => setLocalFilters((f) => ({ ...f, poolType: e.target.value as any }))}
            >
              <option value="all">All</option>
              <option value="dlmm">DLMM</option>
              <option value="damm">DAMM v2</option>
              <option value="raydium">Raydium CLMM</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Sort By</label>
            <select
              className="form-select"
              value={localFilters.sortBy}
              onChange={(e) => setLocalFilters((f) => ({ ...f, sortBy: e.target.value as any }))}
            >
              <option value="score">Score</option>
              <option value="tvl">TVL</option>
              <option value="volume">Volume</option>
              <option value="apr">APR</option>
              <option value="fees">Fees 24h</option>
              <option value="fees1h">Fees 1h</option>
              <option value="feeTvl">Fee/TVL 24h</option>
              <option value="feeTvl1h">Fee/TVL 1h</option>
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">
              <input
                type="checkbox"
                checked={localFilters.safeOnly}
                onChange={(e) => setLocalFilters((f) => ({ ...f, safeOnly: e.target.checked }))}
              />{' '}
              Safe Only
            </label>
            <label className="form-label">
              <input
                type="checkbox"
                checked={localFilters.farmOnly}
                onChange={(e) => setLocalFilters((f) => ({ ...f, farmOnly: e.target.checked }))}
              />{' '}
              Farm Only
            </label>
          </div>
          <button className="btn btn--primary btn--sm" onClick={handleApply}>
            Apply
          </button>
          <button className="btn btn--ghost btn--sm" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {showResults && (
        <div className="filter-results-section">
          <div className="filter-results-header">
            <div className="filter-results-title">
              <span>{filteredPools.length} Filtered Pools</span>
            </div>
          </div>
          <div className="pools-container" id="filterResultsContainer">
            {columns.map((col, ci) => (
              <div key={ci} className="pool-column">
                {col.map((pool, i) => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    rank={ci * Math.ceil(filteredPools.length / columns.length) + i + 1}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function AlertsPanel() {
  const alerts = useAppState((s) => s.alerts);
  const pools = useAppState((s) => s.pools);
  const addAlert = useAppState((s) => s.addAlert);
  const removeAlert = useAppState((s) => s.removeAlert);

  const [selectedPool, setSelectedPool] = useState('');
  const [metric, setMetric] = useState<AlertMetric>('apr');
  const [condition, setCondition] = useState<AlertCondition>('above');
  const [value, setValue] = useState('');

  const handleAdd = useCallback(() => {
    if (!selectedPool || !value) return;
    const pool = pools.find((p) => p.id === selectedPool);
    if (!pool) return;

    const alert: Alert = {
      id: `alert-${Date.now()}`,
      poolId: pool.id,
      poolName: pool.name,
      metric,
      condition,
      value: parseFloat(value),
      enabled: true,
      createdAt: Date.now(),
    };
    addAlert(alert);
    setValue('');
  }, [selectedPool, metric, condition, value, pools, addAlert]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          Price Alerts
        </div>
      </div>
      <div className="panel-body">
        <div className="alert-form">
          <div className="form-group">
            <label className="form-label">Pool</label>
            <select
              className="form-select"
              value={selectedPool}
              onChange={(e) => setSelectedPool(e.target.value)}
            >
              <option value="">Select pool...</option>
              {pools
                .filter((p) => p.safety === 'safe')
                .slice(0, 50)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Metric</label>
            <select className="form-select" value={metric} onChange={(e) => setMetric(e.target.value as AlertMetric)}>
              <option value="apr">APR</option>
              <option value="tvl">TVL</option>
              <option value="volume">Volume</option>
              <option value="score">Score</option>
              <option value="fees">Fees 24h</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Value</label>
            <input
              type="number"
              className="form-input"
              placeholder="Threshold"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Condition</label>
            <select className="form-select" value={condition} onChange={(e) => setCondition(e.target.value as AlertCondition)}>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <button className="btn btn--success btn--sm" onClick={handleAdd}>
            Add Alert
          </button>
        </div>

        <div className="alert-list">
          {alerts.length === 0 && (
            <div className="alert-empty">
              <p>No alerts set. Create one above to get notified of pool changes.</p>
            </div>
          )}
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert-item ${!alert.enabled ? 'alert-disabled' : ''}`}>
              <div className="alert-item-info">
                <strong>{alert.poolName}</strong>
                <span>
                  {alert.metric.toUpperCase()} {alert.condition} {formatNumber(alert.value)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className={`btn btn--sm ${alert.enabled ? 'btn--secondary' : 'btn--ghost'}`}
                  onClick={() => {
                    const updated = alerts.map(a => a.id === alert.id ? { ...a, enabled: !a.enabled } : a);
                    useAppState.getState().setAlerts(updated);
                    supabaseService.toggleAlert(alert.id, !alert.enabled);
                  }}
                  title={alert.enabled ? 'Pause alert' : 'Resume alert'}
                >
                  {alert.enabled ? 'Pause' : 'Resume'}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => removeAlert(alert.id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// AI SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════

function AiSuggestionsPanel() {
  const opportunities = useAppState((s) => s.opportunities);
  const topOpps = opportunities.slice(0, 5);

  if (topOpps.length === 0) return null;

  return (
    <div className="ai-alerts-section">
      <div className="ai-alerts-header">
        <div className="ai-alerts-title">AI Suggestions</div>
      </div>
      {topOpps.map((opp) => (
        <div key={opp.id} className="ai-suggestion">
          <div className="ai-suggestion-info">
            <div className="ai-suggestion-pool">{opp.name}</div>
            <div className="ai-suggestion-reason">{opp.reason}</div>
          </div>
          <div className="ai-suggestion-actions">
            <button
              className="btn btn--sm btn--success"
              onClick={() => useAppState.getState().togglePool(opp.id)}
            >
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SEARCH & ALERTS SECTION
// ═══════════════════════════════════════════════════════════════════════════

export function SearchAlertsSection() {
  return (
    <div>
      <AiSuggestionsPanel />
      <SearchPoolsPanel />
      <PoolFiltersPanel />
      <AlertsPanel />
    </div>
  );
}
