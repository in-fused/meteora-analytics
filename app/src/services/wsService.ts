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
  private heliusAvailable = true; // Track if Helius proxy is reachable

  init(): void {
    this.initialized = true;
    const store = useAppState.getState();
    if (!this.useWebSocket) {
      console.log('[WS] Polling mode ready (mobile) - will poll on demand');
    } else {
      console.log('[WS] WebSocket ready - will connect on first pool expansion');
    }
    store.setApiStatus('helius', true);
    store.setWsConnected(true);
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
      console.log('[WS] Connecting to WebSocket...');
      this.ws = new WebSocket(CONFIG.WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
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
          // Handle subscription confirmation
          if (msg.type === 'subscribed') {
            console.log('[WS] Subscribed to:', msg.address);
            this.fetchPoolTransactions(msg.address);
          } else if (msg.params?.result) {
            // Handle incoming log notification - refetch transactions
            const store = useAppState.getState();
            const poolId = store.expandedPoolId;
            if (poolId) {
              const pool = store.pools.find(p => p.id === poolId);
              if (pool) this.fetchPoolTransactions(pool.address);
            }
          }
        } catch { /* ignore parse errors */ }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected, falling back to polling');
        this.useWebSocket = false;
        this.startPolling();
      };

      this.ws.onerror = () => {
        console.warn('[WS] Error, falling back to polling');
        this.useWebSocket = false;
        this.startPolling();
      };
    } catch {
      console.warn('[WS] Failed to connect, using polling');
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

    // Always fetch initial transactions
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
    if (!poolAddress) return;

    // If Helius proxy is confirmed unreachable, don't keep trying
    if (!this.heliusAvailable) return;

    // Rate limit: min 5s between fetches
    const now = Date.now();
    if (now - this.lastFetchTime < 5000) return;
    this.lastFetchTime = now;

    // Stop if too many errors
    if (this.errorCount > CONFIG.MAX_ERRORS) {
      console.warn('[WS] Too many errors, disabling Helius transaction fetch');
      this.heliusAvailable = false;
      const store = useAppState.getState();
      store.setApiStatus('helius', false);
      return;
    }

    try {
      const sigResponse = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'getSignaturesForAddress', params: [poolAddress, { limit: 8 }] }),
      });

      if (!sigResponse.ok) {
        this.errorCount++;
        if (sigResponse.status === 500 || sigResponse.status === 502 || sigResponse.status === 503) {
          console.warn('[WS] Helius proxy unavailable (no backend), disabling real-time transactions');
          this.heliusAvailable = false;
          this.stopPolling();
        }
        return;
      }

      const sigData = await sigResponse.json();
      if (sigData.error) {
        this.errorCount++;
        return;
      }

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

      if (!batchResponse.ok) {
        this.errorCount++;
        return;
      }

      const batchData = await batchResponse.json();

      const txs: PoolTransaction[] = (Array.isArray(batchData) ? batchData : [])
        .filter((r: any) => r.result)
        .map((r: any) => this.parseTransaction(r.result))
        .filter(Boolean) as PoolTransaction[];

      if (txs.length > 0) {
        const store = useAppState.getState();
        const pool = store.pools.find(p => p.address === poolAddress);
        if (pool) {
          store.setPoolTransactions(pool.id, txs);
        }
      }

      // Reset error count on success
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
    this.pollInterval = setInterval(() => {
      const store = useAppState.getState();
      const poolId = store.expandedPoolId;
      if (!poolId || this.errorCount > CONFIG.MAX_ERRORS) return;

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
