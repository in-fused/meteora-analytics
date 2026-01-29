import { CONFIG } from '@/config';

// ═══════════════════════════════════════════════════════════════════════════
// WALLET SERVICE - Solana wallet integration
// ═══════════════════════════════════════════════════════════════════════════

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  provider: any;
  name: string | null;
  balance: number;
}

class WalletService {
  state: WalletState = {
    connected: false,
    publicKey: null,
    provider: null,
    name: null,
    balance: 0
  };
  
  onStateChange: ((state: WalletState) => void) | null = null;
  
  getProvider(walletKey: string): any {
    switch (walletKey) {
      case 'phantom':
        return window.phantom?.solana;
      case 'solflare':
        return window.solflare;
      case 'backpack':
        return window.backpack;
      default:
        return null;
    }
  }
  
  isWalletDetected(walletKey: string): boolean {
    return !!this.getProvider(walletKey);
  }
  
  async connect(walletKey: string): Promise<boolean> {
    const provider = this.getProvider(walletKey);
    
    if (!provider) {
      // Open download page
      const downloadUrls: Record<string, string> = {
        phantom: 'https://phantom.app',
        solflare: 'https://solflare.com',
        backpack: 'https://backpack.app'
      };
      window.open(downloadUrls[walletKey], '_blank');
      return false;
    }
    
    try {
      const result = await provider.connect();
      const publicKey = result.publicKey?.toString() || provider.publicKey?.toString();
      
      this.state = {
        connected: true,
        publicKey,
        provider,
        name: walletKey,
        balance: 0
      };
      
      await this.fetchBalance();
      
      // Setup disconnect listener
      provider.on?.('disconnect', () => this.handleDisconnect());
      
      this.onStateChange?.(this.state);
      return true;
      
    } catch (e) {
      console.error('Wallet connection failed:', e);
      return false;
    }
  }
  
  async fetchBalance(): Promise<void> {
    if (!this.state.publicKey) return;
    
    try {
      const response = await fetch(CONFIG.HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [this.state.publicKey]
        })
      });
      
      const data = await response.json();
      if (data.result?.value !== undefined) {
        this.state.balance = data.result.value / 1e9;
        this.onStateChange?.(this.state);
      }
    } catch (e) {
      console.warn('Balance fetch error:', e);
    }
  }
  
  disconnect() {
    this.state.provider?.disconnect?.().catch(() => {});
    this.handleDisconnect();
  }
  
  handleDisconnect() {
    this.state = {
      connected: false,
      publicKey: null,
      provider: null,
      name: null,
      balance: 0
    };
    this.onStateChange?.(this.state);
  }
  
  async autoConnect(): Promise<boolean> {
    const phantom = window.phantom?.solana;
    if (phantom?.isConnected) {
      try {
        const result = await phantom.connect({ onlyIfTrusted: true });
        if (result.publicKey) {
          this.state = {
            connected: true,
            publicKey: result.publicKey.toString(),
            provider: phantom,
            name: 'phantom',
            balance: 0
          };
          await this.fetchBalance();
          this.onStateChange?.(this.state);
          return true;
        }
      } catch (e) {}
    }
    return false;
  }
  
  copyAddress() {
    if (this.state.publicKey) {
      navigator.clipboard.writeText(this.state.publicKey);
    }
  }
}

// Extend Window interface for wallet providers
declare global {
  interface Window {
    phantom?: {
      solana?: any;
    };
    solflare?: any;
    backpack?: any;
  }
}

export const walletService = new WalletService();
