import { CONFIG } from '@/config';
import { useAppState } from '@/hooks/useAppState';
import type { PoolTransaction, TxType } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVICE - Lazy on-demand Helius connection
// ═══════════════════════════════════════════════════════════════════════════

class WSService {
  private ws: WebSocket | null = null;
  private subscribedPools = new Set<string>();
  private useWebSocket = !CONFIG.IS_MOBILE;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private errorCount = 0;
  private lastFetchTime = 0;
  private initialized = false;

  connect(): void {
    // Lazy: don't connect WS until a pool is actually expanded
    this.initialized = true;
    const store = useAppState.getState();
    store.setWsConnected(true);
    store.setApiStatus('helius', true);
    console.log('[WS] Ready - will connect on first pool expansion');
  }

  private ensureConnected(): void {
    if (this.useWebSocket && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      this.connectWebSocket();
    }
    if (!this.useWebSocket && !this.pollInterval) {
      this.startPolling();
    }
  }

  private connectWebSocket(): void {
    try {
      this.ws = new WebSocket(CONFIG.WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        const store = useAppState.getState();
        store.setApiStatus('helius', true);
        store.setWsConnected(true);
        // Resubscribe
        this.subscribedPools.forEach(addr => {
          this.ws?.send(JSON.stringify({ type: 'subscribe', address: addr }));
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.params?.result?.value) {
            this.handleTransaction(data.params.result.value);
          }
        } catch { /* ignore parse errors */ }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected, falling back to polling');
        this.useWebSocket = false;
        this.startPolling();
      };

      this.ws.onerror = () => {
        this.useWebSocket = false;
        this.startPolling();
      };
    } catch {
      this.useWebSocket = false;
      this.startPolling();
    }
  }

  subscribeToPool(poolAddress: string): void {
    if (!poolAddress) return;
    this.subscribedPools.add(poolAddress);
    this.ensureConnected();

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', address: poolAddress }));
    }

    this.fetchPoolTransactions(poolAddress);
  }

  unsubscribeFromPool(poolAddress: string): void {
    if (!poolAddress) return;
    this.subscribedPools.delete(poolAddress);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', address: poolAddress }));
    }

    // Disconnect WS if no active subscriptions
    if (this.subscribedPools.size === 0 && this.ws) {
      this.ws.close();
      this.ws = null;
      this.stopPolling();
    }
  }

  async fetchPoolTransactions(poolAddress: string): Promise<void> {
    // Rate limit: min 5s between fetches
    const now = Date.now();
    if (now - this.lastFetchTime < 5000) return;
    this.lastFetchTime = now;

    try {
      const sigResponse = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'getSignaturesForAddress', params: [poolAddress, { limit: 10 }] }),
      });

      if (!sigResponse.ok) throw new Error(`RPC error ${sigResponse.status}`);
      const sigData = await sigResponse.json();
      const signatures = sigData.result || [];

      if (signatures.length === 0) return;

      // Batch fetch transaction details
      const batchResponse = await fetch(CONFIG.HELIUS_BATCH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: signatures.slice(0, 5).map((s: any) => ({
            method: 'getTransaction',
            params: [s.signature, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }],
          })),
        }),
      });

      if (!batchResponse.ok) throw new Error(`Batch error ${batchResponse.status}`);
      const batchData = await batchResponse.json();

      const txs: PoolTransaction[] = (Array.isArray(batchData) ? batchData : [])
        .filter((r: any) => r.result)
        .map((r: any) => this.parseTransaction(r.result))
        .filter(Boolean) as PoolTransaction[];

      if (txs.length > 0) {
        // Find which pool ID corresponds to this address
        const store = useAppState.getState();
        const pool = store.pools.find(p => p.address === poolAddress);
        if (pool) {
          store.setPoolTransactions(pool.id, txs);
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

    // Determine transaction type from logs
    const logs: string[] = tx.meta?.logMessages || [];
    let type: TxType = 'swap';
    let amount = '0';

    for (const log of logs) {
      if (log.includes('AddLiquidity') || log.includes('Deposit')) { type = 'add'; break; }
      if (log.includes('RemoveLiquidity') || log.includes('Withdraw')) { type = 'remove'; break; }
      if (log.includes('Swap')) { type = 'swap'; break; }
    }

    // Extract SOL amount from balance changes
    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    if (preBalances.length > 0 && postBalances.length > 0) {
      const diff = Math.abs(postBalances[0] - preBalances[0]) / 1e9;
      if (diff > 0.001) amount = diff.toFixed(4);
    }

    return { signature, type, amount, timestamp };
  }

  private handleTransaction(value: any): void {
    const address = value.accountId;
    if (!address) return;

    const store = useAppState.getState();
    const pool = store.pools.find(p => p.address === address);
    if (!pool) return;

    // Refresh transactions for this pool
    this.fetchPoolTransactions(address);
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      const store = useAppState.getState();
      const poolId = store.expandedPoolId;
      if (!poolId || this.errorCount > 3) return;

      const pool = store.pools.find(p => p.id === poolId);
      if (pool?.address) {
        this.fetchPoolTransactions(pool.address);
      }
    }, 15000);
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
  }
}

export const wsService = new WSService();
