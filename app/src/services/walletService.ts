import { CONFIG } from '@/config';
import { useAppState } from '@/hooks/useAppState';
import { shortenAddress } from '@/lib/utils';
import { toastService } from '@/services/toastService';
import { supabaseService } from '@/services/supabaseService';

// ═══════════════════════════════════════════════════════════════════════════
// WALLET SERVICE - Phantom, Solflare, Backpack integration
// ═══════════════════════════════════════════════════════════════════════════

class WalletService {
  async connect(walletKey: string): Promise<boolean> {
    const store = useAppState.getState();
    const walletConfig = CONFIG.WALLETS[walletKey as keyof typeof CONFIG.WALLETS];
    if (!walletConfig) return false;

    const provider = walletConfig.getProvider();
    if (!provider) {
      window.open(walletConfig.downloadUrl, '_blank');
      toastService.error('Not Found', `Install ${walletConfig.name}`);
      return false;
    }

    try {
      const resp = await (provider as any).connect();
      const publicKey = resp.publicKey?.toString() || (provider as any).publicKey?.toString();

      if (publicKey) {
        store.setWallet({
          connected: true,
          publicKey,
          provider: walletConfig as any,
          name: walletConfig.name,
        });

        // Listen for disconnect events
        (provider as any).on?.('disconnect', () => this.handleDisconnect());

        // Fetch balance
        await this.fetchBalance();

        // Save for auto-connect
        localStorage.setItem('lp_wallet_provider', walletKey);

        // Hydrate Supabase data for this wallet
        supabaseService.hydrate();

        toastService.success('Connected', shortenAddress(publicKey));
        return true;
      }
    } catch (err: any) {
      console.error('[Wallet] Connect error:', err);
      toastService.error('Failed', err.message || 'Rejected');
    }
    return false;
  }

  async disconnect(): Promise<void> {
    const store = useAppState.getState();
    try {
      const provider = store.wallet.provider?.getProvider?.();
      if (provider && (provider as any).disconnect) {
        await (provider as any).disconnect();
      }
    } catch { /* ignore */ }

    this.handleDisconnect();
  }

  private handleDisconnect(): void {
    const store = useAppState.getState();
    store.setWallet({
      connected: false,
      publicKey: null,
      provider: null,
      name: null,
      balance: 0,
    });
    localStorage.removeItem('lp_wallet_provider');
    toastService.success('Disconnected', 'Wallet disconnected');
  }

  async fetchBalance(): Promise<void> {
    const store = useAppState.getState();
    if (!store.wallet.publicKey) return;

    try {
      const response = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'getBalance',
          params: [store.wallet.publicKey],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const balance = (data.result?.value || 0) / 1e9;
        store.setWallet({ balance });
      }
    } catch (err) {
      console.warn('[Wallet] Balance fetch error:', err);
    }
  }

  async autoConnect(): Promise<void> {
    // Use onlyIfTrusted to avoid popup — only auto-connect if already trusted
    const p = (window as any).phantom?.solana;
    if (p?.isConnected) {
      try {
        const r = await p.connect({ onlyIfTrusted: true });
        if (r.publicKey) {
          const store = useAppState.getState();
          store.setWallet({
            connected: true,
            publicKey: r.publicKey.toString(),
            provider: CONFIG.WALLETS.phantom as any,
            name: 'Phantom',
          });
          await this.fetchBalance();
          supabaseService.hydrate();
        }
      } catch {
        // User hasn't trusted this site yet - don't show popup
      }
    }
  }
}

export const walletService = new WalletService();
