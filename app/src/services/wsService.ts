import { CONFIG } from '@/config';
import { useAppState } from '@/hooks/useAppState';
import type { PoolTransaction, TxType } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVICE — Handles Enhanced + Standard WS from server
//
// Fixed: per-pool rate limiting, transaction deduplication, auto-polling
// on desktop when WS is connected but quiet, and proper live streaming.
// ═══════════════════════════════════════════════════════════════════════════

class WSService {
  private ws: WebSocket | null = null;
  private subscribedPools = new Set<string>();
  private useWebSocket = !CONFIG.IS_MOBILE;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private errorCount = 0;
  private lastFetchByPool = new Map<string, number>();
  private seenSignatures = new Set<string>();
  private initialized = false;
  private wsMode: 'enhanced' | 'standard' | 'unknown' = 'unknown';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): void {
    this.initialized = true;
    const store = useAppState.getState();
    store.setApiStatus('helius', true);
    store.setWsConnected(true);
    // Immediately connect WS so it's ready for subscriptions
    if (this.useWebSocket) {
      this.connectWebSocket();
    }
  }

  // Pre-subscribe to a pool address so transactions start flowing before the card is expanded.
  // This is called for top opportunity pools at init time.
  preSubscribe(poolAddress: string): void {
    if (!poolAddress || this.subscribedPools.has(poolAddress)) return;
    this.subscribedPools.add(poolAddress);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', address: poolAddress }));
    }
    // Fetch initial transactions immediately in background
    this.fetchPoolTransactions(poolAddress);
  }

  private ensureConnected(): void {
    if (this.useWebSocket && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      this.connectWebSocket();
    }
    // Always start polling as a backup — even on desktop. WS messages will
    // trigger instant fetches, and polling fills gaps when WS is quiet.
    if (!this.pollInterval) {
      this.startPolling();
    }
  }

  private connectWebSocket(): void {
    try {
      console.log('[WS] Connecting to WebSocket...');
      this.ws = new WebSocket(CONFIG.WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
        const store = useAppState.getState();
        store.setApiStatus('helius', true);
        store.setWsConnected(true);
        // Resubscribe to any active pools
        this.subscribedPools.forEach(addr => {
          this.ws?.send(JSON.stringify({ type: 'subscribe', address: addr }));
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch { /* ignore parse errors */ }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.wsMode = 'unknown';
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(CONFIG.WS_RECONNECT_DELAY * this.reconnectAttempts, 15000);
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connectWebSocket(), delay);
        } else {
          console.log('[WS] Max reconnection attempts reached, polling only');
          this.useWebSocket = false;
        }
      };

      this.ws.onerror = () => {
        console.warn('[WS] Error');
      };
    } catch {
      console.warn('[WS] Failed to connect, using polling');
      this.useWebSocket = false;
    }
  }

  private handleMessage(msg: any): void {
    if (msg.type === 'connected') {
      this.wsMode = msg.mode || 'standard';
      console.log(`[WS] Server using ${this.wsMode} WebSocket mode`);
      return;
    }

    if (msg.type === 'subscribed') {
      console.log('[WS] Subscribed to:', msg.address);
      this.fetchPoolTransactions(msg.address);
      return;
    }

    // Enhanced WS — live transaction push
    if (msg.type === 'transaction' || msg.type === 'transaction_notification') {
      const store = useAppState.getState();
      const poolId = store.expandedPoolId || store.expandedOppId;
      if (poolId) {
        const pool = store.pools.find(p => p.id === poolId);
        if (pool) {
          if (msg.data?.transaction) {
            const tx = this.parseEnhancedTransaction(msg.data);
            if (tx && !this.seenSignatures.has(tx.signature)) {
              this.seenSignatures.add(tx.signature);
              store.addPoolTransaction(pool.id, tx);
            }
          }
          // Re-fetch to get accurate parsed data
          this.fetchPoolTransactions(pool.address);
        }
      }
      return;
    }

    // Standard WS — log notification
    if (msg.type === 'log_notification') {
      const store = useAppState.getState();
      const poolId = store.expandedPoolId || store.expandedOppId;
      if (poolId) {
        const pool = store.pools.find(p => p.id === poolId);
        if (pool) this.fetchPoolTransactions(pool.address);
      }
      return;
    }

    // Legacy format
    if (msg.params?.result) {
      const store = useAppState.getState();
      const poolId = store.expandedPoolId || store.expandedOppId;
      if (poolId) {
        const pool = store.pools.find(p => p.id === poolId);
        if (pool) this.fetchPoolTransactions(pool.address);
      }
    }
  }

  private parseEnhancedTransaction(data: any): PoolTransaction | null {
    try {
      const tx = data.transaction;
      if (!tx?.transaction?.signatures?.[0]) return null;

      const signature = tx.transaction.signatures[0];
      const timestamp = (tx.blockTime || Math.floor(Date.now() / 1000)) * 1000;

      const logs: string[] = tx.meta?.logMessages || [];
      let type: TxType = 'swap';
      let amount = '0';

      for (const log of logs) {
        if (log.includes('AddLiquidity') || log.includes('Deposit')) { type = 'add'; break; }
        if (log.includes('RemoveLiquidity') || log.includes('Withdraw')) { type = 'remove'; break; }
        if (log.includes('Swap')) { type = 'swap'; break; }
      }

      const preBalances = tx.meta?.preBalances || [];
      const postBalances = tx.meta?.postBalances || [];
      if (preBalances.length > 0 && postBalances.length > 0) {
        const diff = Math.abs(postBalances[0] - preBalances[0]) / 1e9;
        if (diff > 0.001) amount = diff.toFixed(4);
      }

      return { signature, type, amount, timestamp };
    } catch {
      return null;
    }
  }

  subscribeToPool(poolAddress: string): void {
    if (!poolAddress) return;
    const wasPreSubscribed = this.subscribedPools.has(poolAddress);
    this.subscribedPools.add(poolAddress);
    if (!wasPreSubscribed) {
      this.seenSignatures.clear(); // Reset dedup only for brand new subscriptions
    }
    this.ensureConnected();

    if (this.ws?.readyState === WebSocket.OPEN && !wasPreSubscribed) {
      this.ws.send(JSON.stringify({ type: 'subscribe', address: poolAddress }));
    }

    // Always fetch transactions immediately on expand (even if pre-subscribed, get latest)
    this.lastFetchByPool.delete(poolAddress); // Clear rate limit so we fetch now
    this.fetchPoolTransactions(poolAddress);
  }

  unsubscribeFromPool(poolAddress: string): void {
    if (!poolAddress) return;
    this.subscribedPools.delete(poolAddress);
    this.lastFetchByPool.delete(poolAddress); // Free stale rate-limit entry

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', address: poolAddress }));
    }

    // Stop everything if no active subscriptions
    if (this.subscribedPools.size === 0) {
      this.stopPolling();
      this.lastFetchByPool.clear();
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
  }

  async fetchPoolTransactions(poolAddress: string): Promise<void> {
    if (!poolAddress) return;

    // Per-pool rate limit: min 3s between fetches for the same pool
    const now = Date.now();
    const lastFetch = this.lastFetchByPool.get(poolAddress) || 0;
    if (now - lastFetch < 3000) return;
    this.lastFetchByPool.set(poolAddress, now);

    // Cap rate-limit map to prevent memory growth from many pool cycles
    if (this.lastFetchByPool.size > 20) {
      const entries = [...this.lastFetchByPool.entries()].sort((a, b) => a[1] - b[1]);
      entries.slice(0, entries.length - 10).forEach(([k]) => this.lastFetchByPool.delete(k));
    }

    if (this.errorCount > CONFIG.MAX_ERRORS) {
      console.warn('[WS] Too many errors, stopping transaction fetch');
      return;
    }

    try {
      const sigResponse = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'getSignaturesForAddress', params: [poolAddress, { limit: 10 }] }),
      });

      if (!sigResponse.ok) {
        this.errorCount++;
        return;
      }

      const sigData = await sigResponse.json();
      if (sigData.error) {
        this.errorCount++;
        return;
      }

      const signatures = sigData.result || [];
      if (signatures.length === 0) return;

      // Filter out already-seen signatures
      const newSigs = signatures.filter((s: any) => !this.seenSignatures.has(s.signature));
      const sigsToFetch = newSigs.length > 0 ? newSigs.slice(0, 8) : signatures.slice(0, 5);

      // Batch fetch transaction details
      const batchResponse = await fetch(CONFIG.HELIUS_BATCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: sigsToFetch.map((s: any) => ({
            method: 'getTransaction',
            params: [s.signature, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }],
          })),
        }),
      });

      if (!batchResponse.ok) {
        this.errorCount++;
        return;
      }

      const batchData = await batchResponse.json();

      const txs: PoolTransaction[] = (Array.isArray(batchData) ? batchData : [])
        .filter((r: any) => r.result)
        .map((r: any) => this.parseTransaction(r.result))
        .filter((tx): tx is PoolTransaction => tx !== null);

      // Mark as seen
      txs.forEach(tx => this.seenSignatures.add(tx.signature));

      // Cap the seen set to prevent memory growth
      if (this.seenSignatures.size > 200) {
        const entries = [...this.seenSignatures];
        this.seenSignatures = new Set(entries.slice(-100));
      }

      if (txs.length > 0) {
        const store = useAppState.getState();
        const pool = store.pools.find(p => p.address === poolAddress);
        if (pool) {
          // Merge with existing — deduplicate by signature
          const existing = store.poolTransactions[pool.id] || [];
          const existingSigs = new Set(existing.map(t => t.signature));
          const newTxs = txs.filter(t => !existingSigs.has(t.signature));
          const merged = [...newTxs, ...existing]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 15);
          store.setPoolTransactions(pool.id, merged);
        }
      }

      this.errorCount = 0;
    } catch (err) {
      this.errorCount++;
      console.warn('[WS] fetchPoolTransactions error:', err);
    }
  }

  private parseTransaction(tx: any): PoolTransaction | null {
    if (!tx?.transaction?.signatures?.[0]) return null;

    const signature = tx.transaction.signatures[0];
    const timestamp = (tx.blockTime || Math.floor(Date.now() / 1000)) * 1000;

    const logs: string[] = tx.meta?.logMessages || [];
    let type: TxType = 'swap';
    let amount = '0';

    for (const log of logs) {
      if (log.includes('AddLiquidity') || log.includes('Deposit')) { type = 'add'; break; }
      if (log.includes('RemoveLiquidity') || log.includes('Withdraw')) { type = 'remove'; break; }
      if (log.includes('Swap')) { type = 'swap'; break; }
    }

    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    if (preBalances.length > 0 && postBalances.length > 0) {
      const diff = Math.abs(postBalances[0] - preBalances[0]) / 1e9;
      if (diff > 0.001) amount = diff.toFixed(4);
    }

    return { signature, type, amount, timestamp };
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    // Poll every 6s — fast enough for "live" feel, light enough to not spam
    this.pollInterval = setInterval(() => {
      if (this.errorCount > CONFIG.MAX_ERRORS) return;
      const store = useAppState.getState();

      // Priority: poll the currently expanded pool first
      const poolId = store.expandedPoolId || store.expandedOppId;
      if (poolId) {
        const pool = store.pools.find(p => p.id === poolId);
        if (pool?.address) {
          this.fetchPoolTransactions(pool.address);
        }
      }

      // Also poll pre-subscribed pools (top opps) so their txs stay fresh
      this.subscribedPools.forEach(addr => {
        this.fetchPoolTransactions(addr);
      });
    }, 6000);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  disconnect(): void {
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.subscribedPools.clear();
    this.seenSignatures.clear();
    this.lastFetchByPool.clear();
    this.reconnectAttempts = 0;
    this.wsMode = 'unknown';
  }
}

export const wsService = new WSService();
