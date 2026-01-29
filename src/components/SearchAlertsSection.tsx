import { useState, useEffect } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { PoolCard } from './PoolCard';
import { Search, Filter, Bell, X, TrendingUp, TrendingDown, Sparkles, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export function SearchAlertsSection() {
  const {
    pools,
    filteredPools,
    searchResults,
    filters,
    setFilters,
    jupshieldEnabled,
    toggleJupShield,
    handleSearch,
    alerts,
    addAlert,
    removeAlert,
    toggleAlert,
    aiSuggestions,
    setAiSuggestions,
    applyFilters
  } = useAppState();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterResults, setShowFilterResults] = useState(false);
  const [alertValue, setAlertValue] = useState('');
  const [selectedPool, setSelectedPool] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('fees1h-above');
  const [showFilters, setShowFilters] = useState(false);
  
  // Generate AI suggestions
  useEffect(() => {
    const suggestions = pools
      .filter(p => p.safety === 'safe' && (p.isHot || p.fees1h || p.volumeToTvl > 0.4 || parseFloat(p.apr) > 50))
      .slice(0, 5)
      .map(p => {
        let reason, condition, value;
        if (p.isHot && p.fees1h) {
          reason = `🔥 FEE SPIKE: 1h fees ${formatNumber(p.fees1h)} - high short-term opportunity`;
          condition = 'fees1h-above';
          value = (p.fees1h * 0.8).toFixed(2);
        } else if (p.fees1h && (p.fees1h / p.tvl) > 0.0005) {
          reason = `⚡ Active pool: ${formatNumber(p.fees1h)} fees in 1h`;
          condition = 'fees1h-above';
          value = (p.fees1h * 0.5).toFixed(2);
        } else if (p.volumeToTvl > 0.4) {
          reason = `📈 High volume: ${(p.volumeToTvl * 100).toFixed(0)}% vol/TVL ratio`;
          condition = 'volume-above';
          value = (p.volume * 0.8).toFixed(0);
        } else {
          reason = `💰 Strong ${p.apr}% APR`;
          condition = 'apr-above';
          value = (parseFloat(p.apr) * 0.9).toFixed(0);
        }
        return { pool: p, reason, condition, value: parseFloat(value) };
      });
    setAiSuggestions(suggestions);
  }, [pools, setAiSuggestions]);
  
  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    handleSearch(value);
  };
  
  const handleApplyFilters = () => {
    applyFilters();
    setShowFilterResults(true);
    setShowFilters(false);
  };
  
  const handleAddAlert = () => {
    if (!selectedPool || !alertValue) {
      toast.error('Please select a pool and enter a value');
      return;
    }
    
    const pool = pools.find(p => p.id === selectedPool);
    if (!pool) return;
    
    addAlert({
      poolId: selectedPool,
      poolName: pool.name,
      condition: selectedCondition,
      value: parseFloat(alertValue),
      active: true
    });
    
    toast.success('Alert added successfully');
    setAlertValue('');
  };
  
  const handleAddAlertForAll = () => {
    if (!alertValue) {
      toast.error('Please enter a value');
      return;
    }
    
    let count = 0;
    filteredPools.slice(0, 20).forEach(p => {
      if (!alerts.find(a => a.poolId === p.id && a.condition === selectedCondition)) {
        addAlert({
          poolId: p.id,
          poolName: p.name,
          condition: selectedCondition,
          value: parseFloat(alertValue),
          active: true
        });
        count++;
      }
    });
    
    toast.success(`Added ${count} alerts`);
    setAlertValue('');
  };
  
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Search Section */}
      <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-sm">Search Pools</h3>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Search by ticker, token address, or pool address..."
          className="w-full px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors input-premium"
        />
        <p className="text-[10px] text-[var(--text-muted)] mt-2">
          Examples: "SOL", "USDC", "EPjFWdd5..." (token mint), or full pool address
        </p>
      </div>
      
      {/* Search Results */}
      {searchResults.length > 0 && (
        <div 
          className="rounded-xl p-4 border border-[var(--accent-cyan)]/20"
          style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.06), rgba(99,102,241,0.04))' }}
        >
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.04]">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-[var(--accent-cyan)]">
              <Search className="w-4 h-4" />
              {searchResults.length} Results for "{searchQuery}"
            </h3>
            <button 
              onClick={() => { setSearchQuery(''); handleSearch(''); }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          </div>
          
          {/* Responsive Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.slice(0, 30).map((pool, index) => (
              <PoolCard key={pool.id} pool={pool} rank={index + 1} />
            ))}
          </div>
        </div>
      )}
      
      {/* Filters Section - Collapsible on Mobile */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden">
        <button 
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="font-semibold text-sm">Pool Filters</h3>
          </div>
          <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        
        {showFilters && (
          <div className="p-4 pt-0 border-t border-white/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Min TVL ($)</label>
                <input
                  type="number"
                  value={filters.minTVL}
                  onChange={(e) => setFilters({ minTVL: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
                />
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Min Volume ($)</label>
                <input
                  type="number"
                  value={filters.minVolume}
                  onChange={(e) => setFilters({ minVolume: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
                />
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Safety</label>
                <select
                  value={filters.safety}
                  onChange={(e) => setFilters({ safety: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
                >
                  <option value="all">All</option>
                  <option value="safe">Verified Only</option>
                  <option value="exclude-danger">Exclude Dangerous</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Farm Status</label>
                <select
                  value={filters.farm}
                  onChange={(e) => setFilters({ farm: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
                >
                  <option value="all">All Pools</option>
                  <option value="active">Active Farms Only</option>
                  <option value="has">Has Farm</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Pool Type</label>
                <select
                  value={filters.poolType}
                  onChange={(e) => setFilters({ poolType: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
                >
                  <option value="all">All Types</option>
                  <option value="dlmm">DLMM Only</option>
                  <option value="damm">DAMM v2 Only</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Sort By</label>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters({ sort: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
                >
                  <option value="score">Score</option>
                  <option value="fees1h">🔥 Fees 1h (Hot)</option>
                  <option value="feeTvl1h">Fee/TVL 1h</option>
                  <option value="tvl">TVL</option>
                  <option value="volume">Volume 24h</option>
                  <option value="apr">APR</option>
                  <option value="fees">Fees 24h</option>
                  <option value="feeTvl">Fee/TVL 24h</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">JupShield</label>
                <div className="flex items-center gap-3 h-[42px]">
                  <button
                    onClick={toggleJupShield}
                    className={`w-11 h-6 rounded-full relative transition-colors ${
                      jupshieldEnabled ? 'bg-[var(--accent-primary)]' : 'bg-white/[0.08]'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      jupshieldEnabled ? 'translate-x-6 left-0.5' : 'left-1'
                    }`} />
                  </button>
                  <span className="text-xs text-[var(--text-secondary)]">Filter unsafe</span>
                </div>
              </div>
              
              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    setFilters({
                      minTVL: 5000,
                      minVolume: 1000,
                      safety: 'exclude-danger',
                      farm: 'all',
                      poolType: 'all',
                      sort: 'score'
                    });
                    setShowFilterResults(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-white/[0.02] border border-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium gradient-primary text-white hover:shadow-lg transition-all"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Filter Results */}
      {showFilterResults && filteredPools.length > 0 && (
        <div 
          className="rounded-xl p-4 border border-[var(--accent-primary)]/20"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(5,150,105,0.04))' }}
        >
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/[0.04]">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-[var(--accent-primary)]">
              <Filter className="w-4 h-4" />
              {filteredPools.length} Filtered Pools
            </h3>
            <button 
              onClick={() => setShowFilterResults(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Hide
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPools.slice(0, 30).map((pool, index) => (
              <PoolCard key={pool.id} pool={pool} rank={index + 1} />
            ))}
          </div>
        </div>
      )}
      
      {/* AI Suggestions */}
      <div 
        className="rounded-xl p-4 border border-[var(--accent-primary)]/20"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.06))' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
          <h3 className="font-semibold text-sm">AI-Suggested Alerts</h3>
        </div>
        
        {aiSuggestions.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-4">
            No suggestions available. Check back later.
          </p>
        ) : (
          <div className="space-y-2">
            {aiSuggestions.map((suggestion) => (
              <div 
                key={suggestion.pool.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{suggestion.pool.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{suggestion.reason}</div>
                </div>
                <button
                  onClick={() => {
                    addAlert({
                      poolId: suggestion.pool.id,
                      poolName: suggestion.pool.name,
                      condition: suggestion.condition,
                      value: suggestion.value,
                      active: true
                    });
                    toast.success('Alert added');
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-[var(--accent-emerald)]/12 text-[var(--accent-emerald)] border border-[var(--accent-emerald)]/20 hover:bg-[var(--accent-emerald)]/20 transition-colors flex-shrink-0"
                >
                  Add Alert
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Custom Alerts */}
      <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden">
        <div className="p-4 border-b border-white/[0.04] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-[var(--accent-primary)]" />
            Custom Alerts
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleAddAlertForAll}
              className="flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-medium bg-[var(--accent-amber)]/12 text-[var(--accent-amber)] border border-[var(--accent-amber)]/20 hover:bg-[var(--accent-amber)]/20 transition-colors"
            >
              Alert All
            </button>
            <button
              onClick={() => alerts.forEach(a => removeAlert(a.id))}
              className="flex-1 sm:flex-none px-3 py-2 rounded-lg text-xs font-medium bg-white/[0.02] border border-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        
        <div className="p-4">
          {/* Add Alert Form - Responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-4 p-3 bg-white/[0.02] rounded-lg">
            <div className="sm:col-span-2">
              <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Pool</label>
              <select
                value={selectedPool}
                onChange={(e) => setSelectedPool(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
              >
                <option value="">Select pool...</option>
                {filteredPools.slice(0, 40).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Condition</label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
              >
                <option value="fees1h-above">🔥 Fees 1h Above</option>
                <option value="feeTvl1h-above">Fee/TVL 1h Above</option>
                <option value="price-above">Price Above</option>
                <option value="price-below">Price Below</option>
                <option value="tvl-above">TVL Above</option>
                <option value="apr-above">APR Above</option>
                <option value="volume-above">Volume Above</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs text-[var(--text-primary)] mb-1.5 block font-medium">Value</label>
              <input
                type="number"
                value={alertValue}
                onChange={(e) => setAlertValue(e.target.value)}
                placeholder="100"
                className="w-full px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] input-premium"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleAddAlert}
                className="w-full px-4 py-2.5 rounded-lg text-xs font-medium gradient-primary text-white hover:shadow-lg transition-all"
              >
                Add
              </button>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={handleAddAlertForAll}
                className="w-full px-4 py-2.5 rounded-lg text-xs font-medium bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] hover:bg-white/[0.04] transition-all"
              >
                All
              </button>
            </div>
          </div>
          
          {/* Alert List */}
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                No alerts configured.
              </div>
            ) : (
              alerts.map(alert => (
                <div 
                  key={alert.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      alert.condition.includes('above') 
                        ? 'bg-[var(--accent-emerald)]/12 text-[var(--accent-emerald)]' 
                        : 'bg-[var(--accent-rose)]/12 text-[var(--accent-rose)]'
                    }`}>
                      {alert.condition.includes('above') ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{alert.poolName}</div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {alert.condition.replace(/-/g, ' ')} {alert.condition.includes('tvl') || alert.condition.includes('volume') 
                          ? `$${(alert.value / 1000).toFixed(1)}K` 
                          : alert.value}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlert(alert.id)}
                      className={`w-11 h-6 rounded-full relative transition-colors ${
                        alert.active ? 'bg-[var(--accent-primary)]' : 'bg-white/[0.08]'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        alert.active ? 'translate-x-6 left-0.5' : 'left-1'
                      }`} />
                    </button>
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-rose)] hover:bg-[var(--accent-rose)]/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function
function formatNumber(n: number): string {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}
