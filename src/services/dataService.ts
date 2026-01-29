import type { Pool } from '@/types';
import { CONFIG } from '@/config';
import { generateBins, determineSafety, calculateScore } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// DATA SERVICE - Fetch and process pool data
// ═══════════════════════════════════════════════════════════════════════════

class DataService {
  verifiedTokens: Set<string> = new Set();
  
  // Fetch verified tokens from Jupiter
  async fetchJupiterTokens(): Promise<void> {
    try {
      const response = await fetch(CONFIG.JUPITER_TOKENS, {
        headers: {
          'x-api-key': CONFIG.JUPITER_API_KEY
        }
      });
      
      if (!response.ok) throw new Error('Jupiter API failed');
      
      const tokens = await response.json();
      const tokenList = Array.isArray(tokens) ? tokens : (tokens.tokens || []);
      
      tokenList.forEach((t: any) => {
        const mint = typeof t === 'string' ? t : (t.address || t.mint || t.id);
        if (mint) this.verifiedTokens.add(mint);
      });
      
      console.log(`Loaded ${this.verifiedTokens.size} verified tokens from Jupiter`);
    } catch (e) {
      console.warn('Jupiter fallback:', e);
      // Fallback common verified tokens
      const fallbackTokens = [
        'So11111111111111111111111111111111111111112',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
      ];
      fallbackTokens.forEach(t => this.verifiedTokens.add(t));
    }
  }
  
  // Fetch all pools from Meteora (DLMM + DAMM v2)
  async fetchPools(): Promise<Pool[]> {
    const allPools: Pool[] = [];
    const seenAddresses = new Set<string>();
    
    // Fetch BOTH DLMM and DAMM v2 in parallel
    const [dlmmResult, dammResult] = await Promise.allSettled([
      fetch('https://dlmm-api.meteora.ag/pair/all').then(r => {
        if (!r.ok) throw new Error(`DLMM HTTP ${r.status}`);
        return r.json();
      }),
      fetch('https://dammv2-api.meteora.ag/pools?limit=200&order_by=tvl&order=desc').then(r => {
        if (!r.ok) throw new Error(`DAMM v2 HTTP ${r.status}`);
        return r.json();
      })
    ]);
    
    // Process DLMM pools
    if (dlmmResult.status === 'fulfilled' && Array.isArray(dlmmResult.value)) {
      const dlmmPools = dlmmResult.value
        .filter((p: any) => p.name && p.address && !p.hide && !p.is_blacklisted && parseFloat(p.liquidity || 0) > 100)
        .map((p: any) => this.processDLMM(p));
      
      for (const p of dlmmPools) {
        if (!seenAddresses.has(p.address)) {
          seenAddresses.add(p.address);
          allPools.push(p);
        }
      }
    }
    
    // Process DAMM v2 pools
    if (dammResult.status === 'fulfilled' && dammResult.value?.data) {
      const dammPools = dammResult.value.data
        .filter((p: any) => p.pool_address && (p.tvl || 0) > 100)
        .map((p: any) => this.processDAMMv2(p));
      
      for (const p of dammPools) {
        if (!seenAddresses.has(p.address)) {
          seenAddresses.add(p.address);
          allPools.push(p);
        }
      }
    }
    
    // Fallback to DexScreener if no pools
    if (allPools.length === 0) {
      try {
        const dxr = await fetch('https://api.dexscreener.com/latest/dex/search?q=meteora');
        if (dxr.ok) {
          const dx = await dxr.json();
          const dexPools = dx.pairs
            ?.filter((p: any) => p.dexId === 'meteora' && p.liquidity?.usd > 100)
            .slice(0, 150)
            .map((p: any) => this.processDexScreener(p)) || [];
          
          for (const p of dexPools) {
            if (!seenAddresses.has(p.address)) {
              seenAddresses.add(p.address);
              allPools.push(p);
            }
          }
        }
      } catch {}
    }
    
    if (allPools.length === 0) {
      throw new Error('No pools from any source');
    }
    
    console.log(`Loaded ${allPools.length} pools`);
    return allPools;
  }
  
  // Process DLMM pool data
  processDLMM(raw: any): Pool {
    const tvl = parseFloat(raw.liquidity) || 0;
    const volume = parseFloat(raw.trade_volume_24h) || 0;
    const apr = parseFloat(raw.apr) || 0;
    const apy = parseFloat(raw.apy) || 0;
    const fees = parseFloat(raw.fees_24h) || 0;
    const mintX = raw.mint_x || '';
    const mintY = raw.mint_y || '';
    
    const apiVerified = raw.is_verified === true;
    
    const safety = determineSafety(mintX, mintY, this.verifiedTokens, tvl, raw.is_blacklisted);
    
    const farmApr = parseFloat(raw.farm_apr) || 0;
    const farmApy = parseFloat(raw.farm_apy) || 0;
    const hasFarm = farmApr > 0 || farmApy > 0 || !!raw.reward_mint_x || !!raw.reward_mint_y;
    const farmActive = farmApr > 0;
    
    const feeTvlRatio = raw.fee_tvl_ratio?.hour_24 || 0;
    const feeTvlRatio1h = raw.fee_tvl_ratio?.hour_1 || 0;
    const fees1h = parseFloat(raw.fees?.hour_1) || 0;
    const fees4h = parseFloat(raw.fees?.hour_4) || 0;
    const fees12h = parseFloat(raw.fees?.hour_12) || 0;
    
    const score = calculateScore({
      tvl, volume, apr: apr.toString(), fees, safety,
      hasFarm, farmActive, tokensVerified: apiVerified
    });
    
    const currentPrice = parseFloat(raw.current_price) || 1;
    const binStep = parseInt(raw.bin_step) || 1;
    const nameParts = (raw.name || 'Unknown').split('/');
    
    return {
      id: raw.address,
      address: raw.address,
      name: raw.name || 'Unknown',
      protocol: 'Meteora DLMM',
      mintX, mintY,
      tvl, volume,
      apr: apr.toFixed(2),
      apy: apy.toFixed(2),
      fees,
      feeBps: parseFloat(raw.base_fee_percentage) || 0,
      maxFeeBps: parseFloat(raw.max_fee_percentage) || 0,
      binStep,
      currentPrice,
      safety, score,
      bins: generateBins(currentPrice),
      activeBin: parseInt(raw.active_id) || 10,
      icon1: nameParts[0]?.trim().slice(0, 4) || '?',
      icon2: nameParts[1]?.trim().slice(0, 4) || '?',
      volumeToTvl: tvl > 0 ? volume / tvl : 0,
      feeTvlRatio,
      feeTvlRatio1h,
      fees1h,
      fees4h,
      fees12h,
      hasFarm,
      farmActive,
      farmApr: farmApr.toFixed(2),
      farmApy: farmApy.toFixed(2),
      rewardMintX: raw.reward_mint_x,
      rewardMintY: raw.reward_mint_y,
      tokensVerified: apiVerified,
      isBlacklisted: raw.is_blacklisted || false,
      hide: raw.hide || false,
      isHot: fees1h * 24 > fees * 1.5 && fees > 0,
      feeVelocity: fees1h * 24,
      volumeVelocity: tvl > 0 ? ((parseFloat(raw.volume?.hour_1) || 0) / tvl) * 24 : 0,
      tags: raw.tags || [],
      cumulativeTradeVolume: parseFloat(raw.cumulative_trade_volume) || 0,
    };
  }
  
  // Process DAMM v2 pool data
  processDAMMv2(raw: any): Pool {
    const tvl = parseFloat(raw.tvl) || 0;
    const volume = parseFloat(raw.volume24h) || 0;
    const apr = parseFloat(raw.apr) || 0;
    const fees = parseFloat(raw.fee24h) || 0;
    const mintX = raw.token_a_mint || '';
    const mintY = raw.token_b_mint || '';
    
    const xV = this.verifiedTokens.has(mintX);
    const yV = this.verifiedTokens.has(mintY);
    
    let safety: 'safe' | 'warning' | 'danger' = 'warning';
    if (raw.tokens_verified || (xV && yV)) safety = 'safe';
    else if (!xV && !yV && tvl < 10000) safety = 'danger';
    
    const score = calculateScore({
      tvl, volume, apr: apr.toString(), fees, safety,
      hasFarm: raw.has_farm,
      farmActive: raw.farm_active,
      tokensVerified: raw.tokens_verified
    });
    
    const currentPrice = parseFloat(raw.pool_price) || 1;
    const name = raw.pool_name || `${raw.token_a_symbol || '?'}/${raw.token_b_symbol || '?'}`;
    const nameParts = name.split('/');
    
    return {
      id: raw.pool_address,
      address: raw.pool_address,
      name,
      protocol: 'Meteora DAMM v2',
      mintX, mintY,
      tvl, volume,
      apr: apr.toFixed(2),
      fees,
      baseFee: parseFloat(raw.base_fee) || 0,
      dynamicFee: parseFloat(raw.dynamic_fee) || 0,
      feeTvlRatio: parseFloat(raw.fee_tvl_ratio) || 0,
      hasFarm: raw.has_farm || false,
      farmActive: raw.farm_active || false,
      tokensVerified: raw.tokens_verified || false,
      creator: raw.creator || null,
      alphaVault: raw.alpha_vault || null,
      launchpad: raw.launchpad || null,
      poolType: raw.pool_type,
      permanentLockLiquidity: parseFloat(raw.permanent_lock_liquidity) || 0,
      virtualPrice: parseFloat(raw.virtual_price) || 0,
      minPrice: parseFloat(raw.min_price) || 0,
      maxPrice: parseFloat(raw.max_price) || 0,
      feeBps: parseFloat(raw.base_fee) || 0,
      binStep: 1,
      currentPrice,
      safety, score,
      bins: generateBins(currentPrice),
      activeBin: 10,
      icon1: (raw.token_a_symbol || nameParts[0] || '?').slice(0, 4),
      icon2: (raw.token_b_symbol || nameParts[1] || '?').slice(0, 4),
      volumeToTvl: tvl > 0 ? volume / tvl : 0,
    };
  }
  
  // Process DexScreener pool data
  processDexScreener(p: any): Pool {
    const tvl = p.liquidity?.usd || 0;
    const vol = p.volume?.h24 || 0;
    const xV = this.verifiedTokens.has(p.baseToken?.address || '');
    const yV = this.verifiedTokens.has(p.quoteToken?.address || '');
    
    let safety: 'safe' | 'warning' | 'danger' = 'warning';
    if (xV && yV) safety = 'safe';
    else if (!xV && !yV && tvl < 10000) safety = 'danger';
    
    const apr = tvl > 0 ? (vol / tvl * 365 * 0.003 * 100) : 0;
    const currentPrice = parseFloat(p.priceUsd) || 1;
    
    return {
      id: p.pairAddress,
      address: p.pairAddress,
      name: `${p.baseToken?.symbol || '?'}/${p.quoteToken?.symbol || '?'}`,
      protocol: 'Meteora DLMM',
      mintX: p.baseToken?.address,
      mintY: p.quoteToken?.address,
      tvl,
      volume: vol,
      apr: apr.toFixed(2),
      fees: vol * 0.003,
      feeBps: 0.3,
      binStep: 1,
      currentPrice,
      safety,
      score: calculateScore({ tvl, volume: vol, apr: apr.toString(), fees: vol * 0.003, safety }),
      bins: generateBins(currentPrice),
      activeBin: 10,
      icon1: (p.baseToken?.symbol || '?').slice(0, 4),
      icon2: (p.quoteToken?.symbol || '?').slice(0, 4),
      icon1Url: p.baseToken?.info?.imageUrl,
      icon2Url: p.quoteToken?.info?.imageUrl,
      volumeToTvl: tvl > 0 ? vol / tvl : 0,
      feeTvlRatio: tvl > 0 ? (vol * 0.003) / tvl : 0,
    };
  }
}

export const dataService = new DataService();
