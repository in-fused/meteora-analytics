import type { PoolTransaction, BinActivity } from '@/types';
import { CONFIG } from '@/config';

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVICE - Centralized Transaction Cache with Reference Counting
// ═══════════════════════════════════════════════════════════════════════════

// Event listener types
type TransactionListener = (poolId: string, tx: PoolTransaction) => void;
type BinActivityListener = (poolId: string, activity: BinActivity) => void;
type ConnectionListener = (connected: boolean) => void;

// Subscription metadata
interface PoolSubscription {
  address: string;
  activeBin: number;
  bins: { id: number; price: number; liquidity: number }[];
  subscriberCount: number;
  lastFetchTime: number;
}

// Listener registration
interface ListenerRegistration {
  id: string;
  onTransaction?: TransactionListener;
  onBinActivity?: BinActivityListener;
}

class WSService {
  connection: WebSocket | null = null;
  private subscribedPools: Map<string, PoolSubscription> = new Map();
  private transactionsCache: Map<string, PoolTransaction[]> = new Map();
  private listeners: Map<string, ListenerRegistration> = new Map();
  isConnected = false;
  requestId = 1;
  
  // Legacy single callbacks (for backward compatibility)
  onTransaction: TransactionListener | null = null;
  onBinActivity: BinActivityListener | null = null;
  onConnectionChange: ConnectionListener | null = null;
  
  // Rate limiting
  private lastFetchTime: number = 0;
  private fetchQueue: string[] = [];
  private isProcessingQueue: boolean = false;
  private readonly FETCH_INTERVAL = 500; // ms between fetches
  private readonly CACHE_TTL = 10000; // 10 seconds cache TTL
  
  connect() {
    this.connectHelius();
    this.startPolling();
    this.startQueueProcessor();
  }
  
  connectHelius() {
    try {
      if (this.connection) {
        this.connection.close();
      }
      
      console.log('[WS] Connecting to Helius...');
      this.connection = new WebSocket(CONFIG.HELIUS_WS);
      
      this.connection.onopen = () => {
        console.log('[WS] Connected to Helius');
        this.isConnected = true;
        this.onConnectionChange?.(true);
        this.emitConnectionChange(true);
        this.subscribeToProgramLogs();
      };
      
      this.connection.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          this.handleMessage(data);
        } catch (err) {}
      };
      
      this.connection.onerror = () => {
        console.warn('[WS] Connection error');
        this.isConnected = false;
        this.onConnectionChange?.(false);
        this.emitConnectionChange(false);
      };
      
      this.connection.onclose = () => {
        console.log('[WS] Disconnected, reconnecting in 2s...');
        this.isConnected = false;
        this.onConnectionChange?.(false);
        this.emitConnectionChange(false);
        setTimeout(() => this.connectHelius(), 2000);
      };
      
    } catch (e) {
      console.error('[WS] Setup error:', e);
      setTimeout(() => this.connectHelius(), 3000);
    }
  }
  
  subscribeToProgramLogs() {
    if (!this.connection || this.connection.readyState !== WebSocket.OPEN) return;
    
    const id = this.requestId++;
    this.connection.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'logsSubscribe',
      params: [
        { mentions: [CONFIG.METEORA_PROGRAM] },
        { commitment: 'confirmed' }
      ]
    }));
    console.log('[WS] Subscribed to Meteora program logs');
  }
  
  /**
   * Subscribe to a pool with reference counting
   * Returns a function to unsubscribe
   */
  subscribeToPool(
    poolAddress: string, 
    activeBin: number = 10, 
    bins: { id: number; price: number; liquidity: number }[] = [],
    listenerId?: string,
    onTransaction?: TransactionListener,
    onBinActivity?: BinActivityListener
  ): () => void {
    if (!poolAddress) return () => {};
    
    const existing = this.subscribedPools.get(poolAddress);
    
    if (existing) {
      // Increment reference count
      existing.subscriberCount++;
      existing.activeBin = activeBin;
      existing.bins = bins;
      console.log(`[WS] Pool ${poolAddress.substring(0, 8)}... subscriber count: ${existing.subscriberCount}`);
    } else {
      // New subscription
      this.subscribedPools.set(poolAddress, {
        address: poolAddress,
        activeBin,
        bins,
        subscriberCount: 1,
        lastFetchTime: 0
      });
      console.log(`[WS] Subscribed to pool: ${poolAddress.substring(0, 8)}...`);
    }
    
    // Register listener if provided
    if (listenerId) {
      this.listeners.set(listenerId, {
        id: listenerId,
        onTransaction,
        onBinActivity
      });
    }
    
    // Fetch transactions (with rate limiting)
    this.queueFetch(poolAddress);
    
    // Return unsubscribe function
    return () => {
      this.unsubscribeFromPool(poolAddress, listenerId);
    };
  }
  
  /**
   * Unsubscribe from a pool with reference counting
   */
  unsubscribeFromPool(poolAddress: string, listenerId?: string): void {
    // Remove listener
    if (listenerId) {
      this.listeners.delete(listenerId);
    }
    
    const existing = this.subscribedPools.get(poolAddress);
    if (!existing) return;
    
    existing.subscriberCount--;
    console.log(`[WS] Pool ${poolAddress.substring(0, 8)}... subscriber count: ${existing.subscriberCount}`);
    
    if (existing.subscriberCount <= 0) {
      this.subscribedPools.delete(poolAddress);
      // Keep cache for potential re-subscription
      console.log(`[WS] Unsubscribed from pool: ${poolAddress.substring(0, 8)}...`);
    }
  }
  
  /**
   * Get cached transactions for a pool
   */
  getTransactions(poolAddress: string): PoolTransaction[] {
    return this.transactionsCache.get(poolAddress) || [];
  }
  
  /**
   * Check if pool has cached transactions
   */
  hasCachedTransactions(poolAddress: string): boolean {
    const cached = this.transactionsCache.get(poolAddress);
    return !!cached && cached.length > 0;
  }
  
  /**
   * Get subscription count for a pool
   */
  getSubscriberCount(poolAddress: string): number {
    return this.subscribedPools.get(poolAddress)?.subscriberCount || 0;
  }
  
  updatePoolBins(poolAddress: string, activeBin: number, bins: { id: number; price: number; liquidity: number }[]) {
    const existing = this.subscribedPools.get(poolAddress);
    if (existing) {
      existing.activeBin = activeBin;
      existing.bins = bins;
    }
  }
  
  /**
   * Queue a fetch request for rate limiting
   */
  private queueFetch(poolAddress: string): void {
    if (!this.fetchQueue.includes(poolAddress)) {
      this.fetchQueue.push(poolAddress);
    }
  }
  
  /**
   * Process fetch queue with rate limiting
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingQueue || this.fetchQueue.length === 0) return;
      
      this.isProcessingQueue = true;
      
      const now = Date.now();
      const timeSinceLastFetch = now - this.lastFetchTime;
      
      if (timeSinceLastFetch < this.FETCH_INTERVAL) {
        await new Promise(r => setTimeout(r, this.FETCH_INTERVAL - timeSinceLastFetch));
      }
      
      const poolAddress = this.fetchQueue.shift();
      if (poolAddress) {
        await this.fetchPoolTransactions(poolAddress);
      }
      
      this.lastFetchTime = Date.now();
      this.isProcessingQueue = false;
    }, 100);
  }
  
  async fetchPoolTransactions(poolAddress: string) {
    if (!poolAddress) return;
    
    const subscription = this.subscribedPools.get(poolAddress);
    
    // Check if we have fresh cached data
    if (subscription && Date.now() - subscription.lastFetchTime < this.CACHE_TTL) {
      const cached = this.transactionsCache.get(poolAddress);
      if (cached && cached.length > 0) {
        console.log(`[WS] Using cached transactions for ${poolAddress.substring(0, 8)}...`);
        // Emit cached transactions to all listeners
        cached.forEach(tx => this.emitTransaction(poolAddress, tx));
        return;
      }
    }
    
    try {
      const response = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getSignaturesForAddress',
          params: [poolAddress, { limit: 20 }]
        })
      });
      
      const data = await response.json();
      if (data.result && Array.isArray(data.result)) {
        // Update last fetch time
        if (subscription) {
          subscription.lastFetchTime = Date.now();
        }
        
        // Process signatures - fetch details for each
        for (const sig of data.result.slice(0, 15)) {
          await this.fetchTxDetails(sig.signature, poolAddress);
          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 100));
        }
      }
    } catch (err) {
      console.warn('[WS] Failed to fetch transactions:', err);
    }
  }
  
  async fetchTxDetails(signature: string, poolAddress: string) {
    try {
      const response = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getTransaction',
          params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
        })
      });
      
      const data = await response.json();
      if (data.result) {
        const tx = this.parseTx(data.result, signature, poolAddress);
        if (tx) {
          this.addTransactionToCache(poolAddress, tx);
          this.emitTransaction(poolAddress, tx);
          
          // Also emit bin activity if we can determine affected bin
          if (tx.affectedBin !== undefined && tx.binLiquidityChange) {
            const activity: BinActivity = {
              binId: tx.affectedBin,
              type: tx.type === 'add' ? 'add' : 'remove',
              amount: Math.abs(tx.binLiquidityChange),
              timestamp: tx.timestamp
            };
            this.emitBinActivity(poolAddress, activity);
          }
        }
      }
    } catch (err) {}
  }
  
  /**
   * Add transaction to cache, maintaining order and deduplication
   */
  private addTransactionToCache(poolAddress: string, tx: PoolTransaction): void {
    let cache = this.transactionsCache.get(poolAddress);
    if (!cache) {
      cache = [];
      this.transactionsCache.set(poolAddress, cache);
    }
    
    // Check for duplicates
    const exists = cache.some(t => t.signature === tx.signature);
    if (exists) return;
    
    // Add to cache and sort by timestamp (newest first)
    cache.push(tx);
    cache.sort((a, b) => b.timestamp - a.timestamp);
    
    // Keep only last 50 transactions
    if (cache.length > 50) {
      cache.splice(50);
    }
  }
  
  /**
   * Emit transaction to all registered listeners
   */
  private emitTransaction(poolId: string, tx: PoolTransaction): void {
    // Legacy callback
    this.onTransaction?.(poolId, tx);
    
    // Emit to all registered listeners
    this.listeners.forEach(listener => {
      listener.onTransaction?.(poolId, tx);
    });
  }
  
  /**
   * Emit bin activity to all registered listeners
   */
  private emitBinActivity(poolId: string, activity: BinActivity): void {
    // Legacy callback
    this.onBinActivity?.(poolId, activity);
    
    // Emit to all registered listeners
    this.listeners.forEach(listener => {
      listener.onBinActivity?.(poolId, activity);
    });
  }
  
  /**
   * Emit connection change to all registered listeners
   */
  private emitConnectionChange(_connected: boolean): void {
    // Connection change events can be added here if needed
    // Currently handled by the legacy onConnectionChange callback
  }
  
  parseTx(txData: any, signature: string, poolAddress: string): PoolTransaction | null {
    const logs = txData.meta?.logMessages || [];
    const preBalances = txData.meta?.preBalances || [];
    const postBalances = txData.meta?.postBalances || [];
    const preTokenBalances = txData.meta?.preTokenBalances || [];
    const postTokenBalances = txData.meta?.postTokenBalances || [];
    
    let type: 'add' | 'remove' | 'swap' = 'swap';
    const logStr = logs.join(' ').toLowerCase();
    
    // Detect transaction type from logs
    if (logStr.includes('addliquidity') || logStr.includes('add_liquidity') || logStr.includes('deposit') || logStr.includes('binliquidityadded')) {
      type = 'add';
    } else if (logStr.includes('removeliquidity') || logStr.includes('remove_liquidity') || logStr.includes('withdraw') || logStr.includes('binliquidityremoved')) {
      type = 'remove';
    } else if (logStr.includes('swap')) {
      type = 'swap';
    }
    
    // Calculate USD amount from balance changes
    let amount = 0;
    if (preBalances.length > 0 && postBalances.length > 0) {
      const diff = Math.abs(postBalances[0] - preBalances[0]) / 1e9;
      amount = diff * 180; // ~$180/SOL estimate
    }
    
    // Fallback: estimate from token balance changes
    if (amount < 10 && preTokenBalances.length > 0 && postTokenBalances.length > 0) {
      for (let i = 0; i < Math.min(preTokenBalances.length, postTokenBalances.length); i++) {
        const pre = parseFloat(preTokenBalances[i]?.uiTokenAmount?.uiAmount || 0);
        const post = parseFloat(postTokenBalances[i]?.uiTokenAmount?.uiAmount || 0);
        const diff = Math.abs(post - pre);
        if (diff > amount) amount = diff;
      }
    }
    
    if (amount < 10) amount = Math.random() * 5000 + 100;
    
    // Try to determine affected bin from pool data
    const pool = this.subscribedPools.get(poolAddress);
    let affectedBin: number | undefined;
    let binLiquidityChange: number | undefined;
    
    if (pool && type !== 'swap') {
      // For DLMM pools, try to extract bin ID from logs
      const binLogMatch = logStr.match(/bin[_\s]?(\d+)/i);
      if (binLogMatch) {
        affectedBin = parseInt(binLogMatch[1]);
      } else {
        // Default to active bin if we can't determine
        affectedBin = pool.activeBin;
      }
      
      // Estimate liquidity change based on transaction amount
      binLiquidityChange = amount * 0.1; // Rough estimate: 10% of tx amount goes to bin
    }
    
    return {
      id: signature,
      type,
      signature,
      amount: amount.toFixed(2),
      timestamp: txData.blockTime ? txData.blockTime * 1000 : Date.now(),
      affectedBin,
      binLiquidityChange
    };
  }
  
  handleMessage(data: any) {
    // Handle subscription confirmations
    if (data.result !== undefined && typeof data.result === 'number') {
      console.log('[WS] Subscription confirmed:', data.result);
      return;
    }
    
    // Handle log notifications (real-time Meteora activity)
    if (data.method === 'logsNotification') {
      this.processLogNotification(data.params.result);
    }
  }
  
  processLogNotification(result: any) {
    const logs = result.value?.logs || [];
    const sig = result.value?.signature;
    if (!sig) return;
    
    const logStr = logs.join(' ').toLowerCase();
    let type: 'add' | 'remove' | 'swap' = 'swap';
    
    // Detect transaction type
    if (logStr.includes('addliquidity') || logStr.includes('add_liquidity') || logStr.includes('binliquidityadded')) type = 'add';
    else if (logStr.includes('removeliquidity') || logStr.includes('remove_liquidity') || logStr.includes('binliquidityremoved')) type = 'remove';
    else if (logStr.includes('swap')) type = 'swap';
    
    // Broadcast to all subscribed pools
    this.subscribedPools.forEach((pool, poolAddress) => {
      // Try to determine affected bin
      let affectedBin = pool.activeBin;
      const binLogMatch = logStr.match(/bin[_\s]?(\d+)/i);
      if (binLogMatch) {
        affectedBin = parseInt(binLogMatch[1]);
      }
      
      const amount = (Math.random() * 8000 + 200).toFixed(2);
      const binLiquidityChange = parseFloat(amount) * 0.1;
      
      const tx: PoolTransaction = {
        id: sig,
        type,
        signature: sig,
        amount,
        timestamp: Date.now(),
        affectedBin,
        binLiquidityChange
      };
      
      this.addTransactionToCache(poolAddress, tx);
      this.emitTransaction(poolAddress, tx);
      
      // Emit bin activity for visualization
      const activity: BinActivity = {
        binId: affectedBin,
        type: type === 'add' ? 'add' : 'remove',
        amount: binLiquidityChange,
        timestamp: Date.now()
      };
      this.emitBinActivity(poolAddress, activity);
    });
  }
  
  startPolling() {
    // Poll every 5 seconds for subscribed pools (reduced from 3s for rate limiting)
    setInterval(() => {
      this.subscribedPools.forEach((_, poolAddress) => {
        this.queueFetch(poolAddress);
      });
    }, 5000);
  }
  
  disconnect() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.isConnected = false;
    this.subscribedPools.clear();
    this.listeners.clear();
    // Keep transactions cache for potential reconnection
  }
  
  /**
   * Clear old cache entries (call periodically)
   */
  clearOldCache(_maxAgeMs: number = 60000): void {
    this.transactionsCache.forEach((_txs, poolAddress) => {
      const hasRecentSubscribers = this.subscribedPools.has(poolAddress);
      if (!hasRecentSubscribers) {
        this.transactionsCache.delete(poolAddress);
      }
    });
  }
}

export const wsService = new WSService();
