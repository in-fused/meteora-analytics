import { CONFIG } from '@/config';
import type { Pool, Bin } from '@/types';
import { calculateSafety, calculateScore, generateBins, isHotPool } from '@/lib/utils';
import { useAppState } from '@/hooks/useAppState';

// ═══════════════════════════════════════════════════════════════════════════
// DATA SERVICE - Fetches and processes pool data from all sources
// ═══════════════════════════════════════════════════════════════════════════

export const dataService = {
  async fetchJupiterTokens(): Promise<void> {
    const store = useAppState.getState();
    try {
      const r = await fetch(CONFIG.JUPITER_TOKENS);
      if (!r.ok) throw new Error('Jupiter API failed');
      const tokens = await r.json();
      const tokenList: unknown[] = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
      const verified = new Set(store.verifiedTokens);
      tokenList.forEach((t: any) => {
        const mint = typeof t === 'string' ? t : (t.address || t.mint || t.id);
        if (mint) verified.add(mint);
      });
      store.setVerifiedTokens(verified);
      store.setApiStatus('jupiter', true);
    } catch {
      store.setApiStatus('jupiter', false);
      // Fallback well-known tokens
      const fallback = new Set(store.verifiedTokens);
      [CONFIG.MINTS.SOL, CONFIG.MINTS.USDC, CONFIG.MINTS.USDT, CONFIG.MINTS.JUP,
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'].forEach(t => fallback.add(t));
      store.setVerifiedTokens(fallback);
    }
  },

  async fetchPools(): Promise<void> {
    const store = useAppState.getState();
    try {
      let allPools: Pool[] = [];
      const seenAddresses = new Set<string>();
      const sources: string[] = [];

      // Fetch DLMM, DAMM v2, and Raydium CLMM in parallel
      const [dlmmResult, dammResult, raydiumResult] = await Promise.allSettled([
        fetch(CONFIG.METEORA_DLMM).then(r => { if (!r.ok) throw new Error(`DLMM HTTP ${r.status}`); return r.json(); }),
        fetch(CONFIG.METEORA_DAMM_V2).then(r => { if (!r.ok) throw new Error(`DAMM v2 HTTP ${r.status}`); return r.json(); }),
        fetch(CONFIG.RAYDIUM_CLMM).then(r => { if (!r.ok) throw new Error(`Raydium HTTP ${r.status}`); return r.json(); }),
      ]);

      // Process DLMM
      if (dlmmResult.status === 'fulfilled' && Array.isArray(dlmmResult.value)) {
        const dlmmPools = dlmmResult.value
          .filter((p: any) => p.name && p.address && !p.hide && !p.is_blacklisted && parseFloat(p.liquidity || 0) > 100)
          .slice(0, CONFIG.POOL_LIMIT)
          .map((p: any) => this.processDLMM(p, store.verifiedTokens));

        for (const p of dlmmPools) {
          if (!seenAddresses.has(p.address)) {
            seenAddresses.add(p.address);
            allPools.push(p);
          }
        }
        sources.push(`DLMM:${dlmmPools.length}`);
      }

      // Process DAMM v2
      if (dammResult.status === 'fulfilled' && dammResult.value?.data) {
        let added = 0;
        const dammPools = dammResult.value.data
          .filter((p: any) => p.pool_address && (p.tvl || 0) > 100)
          .slice(0, CONFIG.POOL_LIMIT)
          .map((p: any) => this.processDAMMv2(p, store.verifiedTokens));

        for (const p of dammPools) {
          if (!seenAddresses.has(p.address)) {
            seenAddresses.add(p.address);
            allPools.push(p);
            added++;
          }
        }
        sources.push(`DAMM:${added}`);
      }

      // Process Raydium CLMM
      if (raydiumResult.status === 'fulfilled' && raydiumResult.value?.data?.data) {
        let added = 0;
        const raydiumPools = raydiumResult.value.data.data
          .filter((p: any) => p.id && (p.tvl || 0) > 100)
          .slice(0, CONFIG.POOL_LIMIT)
          .map((p: any) => this.processRaydiumCLMM(p, store.verifiedTokens));

        for (const p of raydiumPools) {
          if (!seenAddresses.has(p.address)) {
            seenAddresses.add(p.address);
            allPools.push(p);
            added++;
          }
        }
        if (added > 0) sources.push(`Raydium:${added}`);
        store.setApiStatus('raydium', true);
      }

      // Fallback to DexScreener if all primary sources fail
      if (allPools.length === 0) {
        try {
          const dxr = await fetch('https://api.dexscreener.com/latest/dex/search?q=meteora');
          if (dxr.ok) {
            const dx = await dxr.json();
            allPools = (dx.pairs ?? [])
              .filter((p: any) => p.dexId === 'meteora' && p.liquidity?.usd > 100)
              .slice(0, 150)
              .map((p: any) => this.processDexScreener(p, store.verifiedTokens));
            if (allPools.length) sources.push(`DexScreener:${allPools.length}`);
          }
        } catch { /* silent fallback */ }
      }

      if (allPools.length === 0) throw new Error('No pools from any source');

      store.setPools(allPools);
      store.setSources(sources);
      store.setApiStatus('meteora', true);
      console.log(`[DataService] Loaded ${allPools.length} pools from: ${sources.join(', ')}`);
    } catch (err) {
      console.error('[DataService] fetchPools error:', err);
      store.setApiStatus('meteora', false);
    }
  },

  processDLMM(p: any, verifiedTokens: Set<string>): Pool {
    const tvl = parseFloat(p.liquidity) || 0;
    const volume = parseFloat(p.trade_volume_24h) || 0;
    const apr = parseFloat(p.apr) || 0;
    const fees = parseFloat(p.fees_24h) || 0;
    const todayFees = parseFloat(p.today_fees) || 0;
    const mintX = p.mint_x || '', mintY = p.mint_y || '';

    const safety = calculateSafety(mintX, mintY, tvl, verifiedTokens, p.is_verified, p.is_blacklisted);
    const hasFarm = !!p.farm_apr;
    const farmActive = hasFarm && parseFloat(p.farm_apr || 0) > 0;
    const score = calculateScore(tvl, volume, apr, safety, hasFarm, farmActive);
    const currentPrice = parseFloat(p.current_price) || 1;

    const feeTvlRatio = tvl > 0 ? fees / tvl : 0;
    const fees1h = todayFees > 0 ? todayFees / Math.max(1, new Date().getHours()) : 0;
    const projectedFees24h = fees1h * 24;

    const pool: Pool = {
      id: p.address, address: p.address,
      name: p.name,
      protocol: 'Meteora DLMM', mintX, mintY,
      tvl, volume, apr: apr.toFixed(2),
      apy: p.apy ? parseFloat(p.apy).toFixed(2) : undefined,
      fees, feeBps: parseFloat(p.base_fee_percentage) || 0.25,
      binStep: parseInt(p.bin_step) || 1,
      currentPrice, safety, score,
      bins: generateBins(currentPrice), activeBin: 10,
      icon1: (p.name?.split(/[-\/]/)[0] || '?').trim().slice(0, 4),
      icon2: (p.name?.split(/[-\/]/)[1] || '?').trim().slice(0, 4),
      volumeToTvl: tvl > 0 ? volume / tvl : 0,
      feeTvlRatio,
      feeTvlRatio1h: tvl > 0 ? fees1h / tvl : 0,
      fees1h,
      fees4h: fees1h * 4,
      fees12h: fees1h * 12,
      fees24h: fees,
      todayFees,
      projectedFees24h,
      hasFarm,
      farmActive,
      farmApr: parseFloat(p.farm_apr || 0),
      farmApy: parseFloat(p.farm_apy || 0),
      tags: p.tags || [],
      isVerified: p.is_verified,
      cumulativeFeeVolume: parseFloat(p.cumulative_fee_volume || 0),
      cumulativeTradeVolume: parseFloat(p.cumulative_trade_volume || 0),
    };

    pool.isHot = isHotPool(pool);
    return pool;
  },

  processDAMMv2(p: any, verifiedTokens: Set<string>): Pool {
    const tvl = parseFloat(p.tvl) || 0;
    const volume = parseFloat(p.volume24h) || 0;
    const apr = parseFloat(p.apr) || 0;
    const fees = parseFloat(p.fee24h) || 0;
    const mintX = p.token_a_mint || '', mintY = p.token_b_mint || '';

    const safety = calculateSafety(mintX, mintY, tvl, verifiedTokens, p.tokens_verified);
    const hasFarm = !!p.has_farm;
    const farmActive = !!p.farm_active;
    const score = calculateScore(tvl, volume, apr, safety, hasFarm, farmActive, parseFloat(p.permanent_lock_liquidity || 0));
    const currentPrice = parseFloat(p.pool_price) || 1;
    const name = p.pool_name || `${p.token_a_symbol || '?'}/${p.token_b_symbol || '?'}`;

    return {
      id: p.pool_address, address: p.pool_address,
      name,
      protocol: 'Meteora DAMM v2', mintX, mintY,
      tvl, volume, apr: apr.toFixed(2),
      fees, feeBps: parseFloat(p.base_fee || 0),
      binStep: 1, currentPrice, safety, score,
      bins: generateBins(currentPrice), activeBin: 10,
      icon1: (p.token_a_symbol || name.split(/[-\/]/)[0] || '?').trim().slice(0, 4),
      icon2: (p.token_b_symbol || name.split(/[-\/]/)[1] || '?').trim().slice(0, 4),
      volumeToTvl: tvl > 0 ? volume / tvl : 0,
      feeTvlRatio: tvl > 0 ? fees / tvl : 0,
      hasFarm, farmActive,
      permanentLockLiquidity: parseFloat(p.permanent_lock_liquidity || 0),
      creator: p.creator,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      tokenAmountA: parseFloat(p.token_a_amount || 0),
      tokenAmountB: parseFloat(p.token_b_amount || 0),
      tokenAmountAUsd: parseFloat(p.token_a_amount_usd || 0),
      tokenAmountBUsd: parseFloat(p.token_b_amount_usd || 0),
      virtualPrice: parseFloat(p.virtual_price || 0),
      minPrice: parseFloat(p.min_price || 0),
      maxPrice: parseFloat(p.max_price || 0),
      isHot: false,
    } as Pool;
  },

  processRaydiumCLMM(p: any, verifiedTokens: Set<string>): Pool {
    const tvl = parseFloat(p.tvl) || 0;
    const volume = parseFloat(p.day?.volume) || 0;
    const fees = parseFloat(p.day?.volumeFee) || 0;
    const apr = parseFloat(p.day?.apr) || (tvl > 0 ? (fees / tvl * 365 * 100) : 0);
    const mintX = p.mintA?.address || '', mintY = p.mintB?.address || '';

    const safety = calculateSafety(mintX, mintY, tvl, verifiedTokens);
    const score = calculateScore(tvl, volume, apr, safety);
    const currentPrice = parseFloat(p.price) || 1;
    const symbolA = p.mintA?.symbol || '?';
    const symbolB = p.mintB?.symbol || '?';

    return {
      id: p.id, address: p.id,
      name: `${symbolA}/${symbolB}`,
      protocol: 'Raydium CLMM', mintX, mintY,
      tvl, volume, apr: apr.toFixed(2), fees,
      feeBps: parseFloat(p.feeRate) || 0.25,
      binStep: 1, currentPrice, safety, score,
      bins: generateBins(currentPrice), activeBin: 10,
      icon1: symbolA.slice(0, 4), icon2: symbolB.slice(0, 4),
      volumeToTvl: tvl > 0 ? volume / tvl : 0,
      feeTvlRatio: tvl > 0 ? fees / tvl : 0,
      hasFarm: !!p.farmCount,
      farmActive: (p.farmCount || 0) > 0,
      isHot: false,
    } as Pool;
  },

  processDexScreener(p: any, verifiedTokens: Set<string>): Pool {
    const tvl = p.liquidity?.usd || 0;
    const vol = p.volume?.h24 || 0;
    const safety = calculateSafety(
      p.baseToken?.address || '', p.quoteToken?.address || '',
      tvl, verifiedTokens
    );
    const apr = tvl > 0 ? (vol / tvl * 365 * 0.003 * 100) : 0;
    const score = calculateScore(tvl, vol, apr, safety);

    return {
      id: p.pairAddress, address: p.pairAddress,
      name: `${p.baseToken?.symbol || '?'}/${p.quoteToken?.symbol || '?'}`,
      protocol: 'Meteora DLMM',
      mintX: p.baseToken?.address || '', mintY: p.quoteToken?.address || '',
      tvl, volume: vol, apr: apr.toFixed(2), fees: vol * 0.003,
      feeBps: 0.3, binStep: 1,
      currentPrice: parseFloat(p.priceUsd) || 1, safety, score,
      bins: generateBins(parseFloat(p.priceUsd) || 1), activeBin: 10,
      icon1: (p.baseToken?.symbol || '?').slice(0, 4),
      icon2: (p.quoteToken?.symbol || '?').slice(0, 4),
      icon1Url: p.baseToken?.info?.imageUrl,
      icon2Url: p.quoteToken?.info?.imageUrl,
      volumeToTvl: tvl > 0 ? vol / tvl : 0,
      isHot: false,
    } as Pool;
  },

  applyFilters(): void {
    const store = useAppState.getState();
    const { pools, filters, jupshieldEnabled } = store;

    let filtered = [...pools];

    // JupShield filter
    if (jupshieldEnabled) {
      filtered = filtered.filter(p => p.safety !== 'danger');
    }

    // TVL filter
    if (filters.minTvl > 0) {
      filtered = filtered.filter(p => p.tvl >= filters.minTvl);
    }

    // Volume filter
    if (filters.minVolume > 0) {
      filtered = filtered.filter(p => p.volume >= filters.minVolume);
    }

    // Safety filter
    if (filters.safeOnly) {
      filtered = filtered.filter(p => p.safety === 'safe');
    }

    // Farm filter
    if (filters.farmOnly) {
      filtered = filtered.filter(p => p.farmActive);
    }

    // Pool type filter
    if (filters.poolType !== 'all') {
      const typeMap: Record<string, string> = {
        dlmm: 'Meteora DLMM',
        damm: 'Meteora DAMM v2',
        raydium: 'Raydium CLMM',
      };
      filtered = filtered.filter(p => p.protocol === typeMap[filters.poolType]);
    }

    // Sort
    const sortFns: Record<string, (a: Pool, b: Pool) => number> = {
      score: (a, b) => b.score - a.score,
      tvl: (a, b) => b.tvl - a.tvl,
      volume: (a, b) => b.volume - a.volume,
      apr: (a, b) => parseFloat(b.apr) - parseFloat(a.apr),
      fees: (a, b) => b.fees - a.fees,
    };
    filtered.sort(sortFns[filters.sortBy] || sortFns.score);

    store.setFilteredPools(filtered);
  },

  searchPools(query: string): Pool[] {
    const store = useAppState.getState();
    if (!query.trim()) return [];

    const q = query.toLowerCase().trim();
    return store.pools.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.address.toLowerCase().includes(q) ||
      p.mintX?.toLowerCase().includes(q) ||
      p.mintY?.toLowerCase().includes(q)
    ).slice(0, 50);
  },
};
