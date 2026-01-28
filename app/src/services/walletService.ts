import { CONFIG } from '@/config';
import { useAppState } from '@/hooks/useAppState';

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

        // Fetch balance
        await this.fetchBalance();

        // Save for auto-connect
        localStorage.setItem('lp_wallet_provider', walletKey);

        return true;
      }
    } catch (err) {
      console.error('[Wallet] Connect error:', err);
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

    store.setWallet({
      connected: false,
      publicKey: null,
      provider: null,
      name: null,
      balance: 0,
    });

    localStorage.removeItem('lp_wallet_provider');
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
    const savedProvider = localStorage.getItem('lp_wallet_provider');
    if (savedProvider) {
      await this.connect(savedProvider);
    }
  }
}

export const walletService = new WalletService();
