import { CONFIG } from '@/config';
import { useAppState } from '@/hooks/useAppState';
import type { PoolTransaction, TxType, Bin } from '@/types';

// ═══════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVICE — Clean state machine + message queue + SDK bin fetching
//
// Design principles:
// - NEVER call ws.send() without readyState check
// - HTTP polling is the reliable backbone (every 5s)
// - WebSocket push is a speed bonus on top
// - One expanded pool at a time — no pre-subscription
// - On expand: fetch real bin data via DLMM SDK endpoint
// ═══════════════════════════════════════════════════════════════════════════

type WsState = 'disconnected' | 'connecting' | 'connected';

const POLL_INTERVAL_MS = 5000;
const FETCH_COOLDOWN_MS = 4000;
const MAX_RECONNECT_ATTEMPTS = 5;
const MAX_SEEN_SIGNATURES = 150;

class WSService {
  private ws: WebSocket | null = null;
  private state: WsState = 'disconnected';
  private messageQueue: string[] = [];
  private activePool: string | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastFetchTime = 0;
  private seenSignatures = new Set<string>();
  private reconnectAttempts = 0;
  private errorCount = 0;

  // ── Public API ──────────────────────────────────────────────────────────

  /** Start the WebSocket connection (called once at app init). */
  connect(): void {
    if (this.state !== 'disconnected') return;
    if (CONFIG.IS_MOBILE) return; // Mobile uses polling only
    this.connectWebSocket();
  }

  /** Subscribe to a pool's transactions (called when a pool card is expanded). */
  subscribeToPool(poolAddress: string): void {
    if (!poolAddress) return;

    this.activePool = poolAddress;
    this.seenSignatures.clear();
    this.errorCount = 0;

    // 1. Send WS subscribe (queued if still connecting)
    this.safeSend(JSON.stringify({ type: 'subscribe', address: poolAddress }));

    // 2. Fetch via HTTP immediately (guaranteed to work regardless of WS state)
    this.lastFetchTime = 0; // bypass cooldown for first fetch
    this.fetchPoolTransactions(poolAddress);

    // 3. Fetch real bin data from DLMM SDK (non-blocking)
    this.fetchPoolBins(poolAddress);

    // 4. Start polling as backbone
    this.startPolling();
  }

  /** Unsubscribe from a pool's transactions (called when a pool card is collapsed). */
  unsubscribeFromPool(poolAddress: string): void {
    if (!poolAddress) return;

    this.safeSend(JSON.stringify({ type: 'unsubscribe', address: poolAddress }));
    this.activePool = null;
    this.stopPolling();
    this.seenSignatures.clear();
    this.lastFetchTime = 0;
  }

  /** Cleanly shut down everything. */
  disconnect(): void {
    this.stopPolling();
    this.activePool = null;
    this.messageQueue = [];
    this.seenSignatures.clear();
    this.lastFetchTime = 0;
    this.reconnectAttempts = 0;
    this.errorCount = 0;
    this.state = 'disconnected';

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    const store = useAppState.getState();
    store.setWsConnected(false);
  }

  // ── WebSocket Connection ────────────────────────────────────────────────

  private connectWebSocket(): void {
    if (this.state === 'connecting' || this.state === 'connected') return;

    this.state = 'connecting';
    console.log('[WS] Connecting...');

    try {
      this.ws = new WebSocket(CONFIG.WS_URL);
    } catch {
      console.warn('[WS] Failed to create WebSocket, using polling only');
      this.state = 'disconnected';
      return;
    }

    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.state = 'connected';
      this.reconnectAttempts = 0;

      const store = useAppState.getState();
      store.setApiStatus('helius', true);
      store.setWsConnected(true);

      // Flush queued messages
      this.flushQueue();

      // Re-subscribe to active pool if one exists
      if (this.activePool) {
        this.safeSend(JSON.stringify({ type: 'subscribe', address: this.activePool }));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch { /* ignore parse errors */ }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.state = 'disconnected';
      this.ws = null;

      const store = useAppState.getState();
      store.setWsConnected(false);

      // Attempt reconnection with exponential backoff
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 8000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connectWebSocket(), delay);
      } else {
        console.log('[WS] Max reconnect attempts reached, polling only');
      }
    };

    this.ws.onerror = () => {
      console.warn('[WS] Error');
      // onclose will fire after onerror, so reconnect logic is handled there
    };
  }

  // ── Safe Send + Message Queue ───────────────────────────────────────────

  /** Send a message safely: send if OPEN, queue if CONNECTING, drop if DISCONNECTED. */
  private safeSend(msg: string): void {
    if (!this.ws) {
      if (this.state === 'connecting') {
        this.messageQueue.push(msg);
      }
      return;
    }

    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(msg);
      } catch (err) {
        console.warn('[WS] Send failed:', err);
      }
    } else if (this.ws.readyState === WebSocket.CONNECTING) {
      this.messageQueue.push(msg);
    }
    // If CLOSING or CLOSED, silently drop — reconnect logic will re-subscribe
  }

  /** Flush all queued messages (called on open). */
  private flushQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const queue = this.messageQueue.splice(0);
    for (const msg of queue) {
      try {
        this.ws.send(msg);
      } catch (err) {
        console.warn('[WS] Queue flush send failed:', err);
      }
    }
  }

  // ── Message Handling ────────────────────────────────────────────────────

  private handleMessage(msg: any): void {
    if (msg.type === 'connected') {
      console.log(`[WS] Server mode: ${msg.mode || 'standard'}`);
      return;
    }

    if (msg.type === 'subscribed') {
      console.log('[WS] Subscribed to:', msg.address);
      // Trigger a fresh fetch to get latest data
      if (msg.address === this.activePool) {
        this.lastFetchTime = 0;
        this.fetchPoolTransactions(msg.address);
      }
      return;
    }

    // Enhanced WS — live transaction push
    if (msg.type === 'transaction' || msg.type === 'transaction_notification') {
      if (this.activePool) {
        const store = useAppState.getState();
        const poolId = store.expandedPoolId || store.expandedOppId;
        if (poolId) {
          if (msg.data?.transaction) {
            const tx = this.parseEnhancedTransaction(msg.data);
            if (tx && !this.seenSignatures.has(tx.signature)) {
              this.seenSignatures.add(tx.signature);
              store.addPoolTransaction(poolId, tx);
            }
          }
          // Also trigger HTTP fetch to get properly parsed data
          const pool = store.pools.find(p => p.id === poolId);
          if (pool?.address) {
            this.fetchPoolTransactions(pool.address);
          }
        }
      }
      return;
    }

    // Standard WS — log notification (just triggers a fetch)
    if (msg.type === 'log_notification' || msg.params?.result) {
      if (this.activePool) {
        this.fetchPoolTransactions(this.activePool);
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

  // ── HTTP Transaction Fetching ───────────────────────────────────────────

  async fetchPoolTransactions(poolAddress: string): Promise<void> {
    if (!poolAddress || poolAddress !== this.activePool) return;

    // Cooldown with exponential backoff on errors
    // Normal: 4s between fetches. After 5+ errors: 10s, 20s, 40s, 60s max
    const now = Date.now();
    const cooldown = this.errorCount > 5
      ? Math.min(10_000 * Math.pow(2, this.errorCount - 6), 60_000)
      : FETCH_COOLDOWN_MS;
    if (now - this.lastFetchTime < cooldown) return;
    this.lastFetchTime = now;

    try {
      // Step 1: Get recent signatures for this pool address
      const sigResponse = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'getSignaturesForAddress',
          params: [poolAddress, { limit: 10 }],
        }),
      });

      if (!sigResponse.ok) { this.errorCount++; return; }

      const sigData = await sigResponse.json();
      if (sigData.error) { this.errorCount++; return; }

      const signatures = sigData.result || [];
      if (signatures.length === 0) return;

      // Prefer unseen signatures, fall back to recent ones
      const newSigs = signatures.filter((s: any) => !this.seenSignatures.has(s.signature));
      const sigsToFetch = newSigs.length > 0 ? newSigs.slice(0, 8) : signatures.slice(0, 5);

      // Step 2: Batch fetch transaction details
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

      if (!batchResponse.ok) { this.errorCount++; return; }

      const batchData = await batchResponse.json();

      const txs: PoolTransaction[] = (Array.isArray(batchData) ? batchData : [])
        .filter((r: any) => r.result)
        .map((r: any) => this.parseTransaction(r.result))
        .filter((tx): tx is PoolTransaction => tx !== null);

      // Mark as seen
      txs.forEach(tx => this.seenSignatures.add(tx.signature));

      // Cap seen set to prevent memory growth
      if (this.seenSignatures.size > MAX_SEEN_SIGNATURES) {
        const entries = [...this.seenSignatures];
        this.seenSignatures = new Set(entries.slice(-100));
      }

      // Update store — bail if pool was collapsed during fetch
      if (poolAddress !== this.activePool) return;

      if (txs.length > 0) {
        const store = useAppState.getState();
        const pool = store.pools.find(p => p.address === poolAddress);
        if (pool) {
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

  // ── DLMM SDK Bin Fetching ─────────────────────────────────────────────

  /** Fetch real on-chain bin data for a DLMM pool via the SDK endpoint.
   *  Retries up to 2 times with backoff if the server SDK call fails. */
  async fetchPoolBins(poolAddress: string, attempt = 0): Promise<void> {
    if (!poolAddress || poolAddress !== this.activePool) return;

    try {
      const response = await fetch(CONFIG.POOL_BINS(poolAddress));
      if (!response.ok) {
        // Non-DLMM pools (Raydium, DAMM) won't have SDK bins — that's fine
        if (response.status === 400) return; // invalid address
        // Server SDK error — retry with backoff
        if (attempt < 2) {
          console.warn(`[WS] SDK bins HTTP ${response.status}, retrying in ${(attempt + 1) * 3}s...`);
          setTimeout(() => this.fetchPoolBins(poolAddress, attempt + 1), (attempt + 1) * 3000);
        } else {
          console.warn('[WS] SDK bins failed after retries:', response.status);
        }
        return;
      }

      const data = await response.json();
      if (poolAddress !== this.activePool) return; // pool changed during fetch

      if (data.bins && data.bins.length > 0 && data.activeBin) {
        const store = useAppState.getState();
        const pool = store.pools.find(p => p.address === poolAddress);
        if (!pool) return;

        const activeBinId = data.activeBin.binId;

        const bins: Bin[] = data.bins
          .filter((b: any) => b.liquidity > 0)
          .map((b: any) => ({
            id: b.id,
            price: b.price,
            liquidity: b.liquidity,
            isActive: b.isActive || b.id === activeBinId,
          }));

        if (bins.length === 0) return;

        // Find the active bin index for the chart
        const activeBinIndex = bins.findIndex(b => b.isActive);

        // Update the pool in the store with real bin data
        store.setPoolBins(pool.id, bins, activeBinIndex >= 0 ? activeBinIndex : Math.floor(bins.length / 2), data.activeBin.price);
      }
    } catch (err) {
      // Network error — retry with backoff
      if (attempt < 2) {
        console.warn(`[WS] fetchPoolBins error, retrying in ${(attempt + 1) * 3}s:`, err);
        setTimeout(() => this.fetchPoolBins(poolAddress, attempt + 1), (attempt + 1) * 3000);
      } else {
        console.warn('[WS] fetchPoolBins failed after retries:', err);
      }
    }
  }

  // ── Polling ─────────────────────────────────────────────────────────────

  private startPolling(): void {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      if (!this.activePool) return;
      this.fetchPoolTransactions(this.activePool);
    }, POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}

export const wsService = new WSService();
