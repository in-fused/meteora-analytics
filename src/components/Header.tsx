import { useState } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { walletService } from '@/services/walletService';
import { CONFIG, WALLETS } from '@/config';
import { shortenAddress } from '@/lib/utils';
import { 
  RefreshCw, 
  Wallet, 
  Bell, 
  Menu,
  X,
  ExternalLink,
  Heart,
  Copy
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function Header() {
  const { 
    isLoading, 
    apiStatus, 
    pools, 
    wallet, 
    refresh,
    triggeredAlerts,
    setActiveTab
  } = useAppState();
  
  const [walletOpen, setWalletOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  
  const handleWalletConnect = async (walletKey: string) => {
    const success = await walletService.connect(walletKey);
    if (success) {
      setWalletOpen(false);
    }
  };
  
  const isWalletDetected = (key: string) => {
    return walletService.isWalletDetected(key);
  };
  
  const handleTipSOL = () => {
    const tipAddress = CONFIG.TIP_SOL_ADDRESS;
    
    // Try to open wallet if connected
    if (wallet.connected && wallet.provider) {
      try {
        // Open wallet transfer
        const transferUrl = `https://solscan.io/account/${tipAddress}`;
        window.open(transferUrl, '_blank');
        toast.success('Opening wallet for tip...');
      } catch (e) {
        // Fallback: copy address
        navigator.clipboard.writeText(tipAddress);
        toast.success('Tip address copied! Send SOL to support development');
      }
    } else {
      // Not connected: show modal with options
      setShowTipModal(true);
    }
  };
  
  const copyTipAddress = () => {
    navigator.clipboard.writeText(CONFIG.TIP_SOL_ADDRESS);
    toast.success('Tip address copied to clipboard!');
    setShowTipModal(false);
  };
  
  return (
    <header className="glass border border-white/[0.04] rounded-2xl p-3 md:p-4 mb-4 md:mb-6">
      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm gradient-primary glow-primary animate-[logoPulse_3s_ease-in-out_infinite]">
            LP
          </div>
          <div className="text-xl font-bold tracking-tight">
            Liquidity<span className="text-gradient">Pro</span>
          </div>
        </div>
        
        {/* Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-card)] border border-white/[0.06] rounded-full text-xs text-[var(--text-secondary)]">
            <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-[var(--accent-amber)]' : 'bg-[var(--accent-emerald)]'} ${!isLoading && 'animate-[statusPulse_2s_ease-in-out_infinite]'}`} />
            <span>{isLoading ? 'Loading...' : `${pools.length.toLocaleString()} pools`}</span>
          </div>
          
          <div className="flex gap-1.5">
            {['meteora', 'jupiter', 'helius'].map((api) => (
              <span 
                key={api}
                className={`px-2 py-1 rounded-md text-[10px] font-medium border uppercase tracking-wide ${
                  apiStatus[api as keyof typeof apiStatus] 
                    ? 'text-[var(--accent-emerald)] border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/8' 
                    : 'text-[var(--text-dim)] border-white/[0.04]'
                }`}
              >
                {api}
              </span>
            ))}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Alert Bell */}
          <div className="relative">
            <button 
              onClick={() => setAlertsOpen(!alertsOpen)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${triggeredAlerts.length > 0 ? 'border-[var(--accent-amber)] bg-[var(--accent-amber)]/10' : 'border-white/[0.06] bg-white/[0.02]'} hover:border-[var(--accent-amber)]`}
            >
              <Bell className="w-[18px] h-[18px] text-[var(--text-secondary)]" />
              {triggeredAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-amber)] text-white text-[10px] font-bold flex items-center justify-center animate-[countPulse_2s_ease-in-out_infinite]">
                  {triggeredAlerts.length > 99 ? '99+' : triggeredAlerts.length}
                </span>
              )}
            </button>
            
            {/* Alert Dropdown */}
            {alertsOpen && (
              <div className="absolute top-full right-0 mt-2 w-80 max-h-96 overflow-y-auto glass border border-white/[0.06] rounded-xl shadow-float z-50">
                <div className="p-3 border-b border-white/[0.04] flex justify-between items-center">
                  <span className="font-semibold text-sm">🔔 Triggered Alerts</span>
                  <button 
                    onClick={() => {}} 
                    className="text-xs text-[var(--accent-rose)] hover:bg-[var(--accent-rose)]/10 px-2 py-1 rounded transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="p-2">
                  {triggeredAlerts.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                      No triggered alerts yet
                    </div>
                  ) : (
                    triggeredAlerts.map(alert => (
                      <div 
                        key={alert.id} 
                        onClick={() => {
                          setActiveTab('alerts');
                          setAlertsOpen(false);
                        }}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-amber)]/15 flex items-center justify-center flex-shrink-0">
                          🔔
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{alert.poolName}</div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {alert.condition.replace(/-/g, ' ')}: {alert.value}
                          </div>
                          <div className="text-[10px] text-[var(--text-dim)] mt-1">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Tip SOL Button */}
          <button 
            onClick={handleTipSOL}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl gradient-gold text-[var(--bg-void)] font-bold text-xs shadow-[var(--glow-gold)] hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            <Heart className="w-3.5 h-3.5" />
            Tip SOL
          </button>
          
          {/* Refresh Button */}
          <button 
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] font-medium text-xs hover:bg-white/[0.04] hover:border-white/[0.1] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading && 'animate-spin'}`} />
            Refresh
          </button>
          
          {/* Wallet Button */}
          <button 
            onClick={() => setWalletOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-medium text-xs transition-all ${
              wallet.connected 
                ? 'bg-[var(--accent-emerald)]/10 border border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]' 
                : 'gradient-active text-white shadow-[0_4px_15px_rgba(6,182,212,0.3)]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {wallet.connected ? shortenAddress(wallet.publicKey, 4) : 'Connect'}
          </button>
        </div>
      </div>
      
      {/* Mobile Header */}
      <div className="flex md:hidden items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs gradient-primary">
            LP
          </div>
          <div className="text-lg font-bold">
            Liquidity<span className="text-gradient">Pro</span>
          </div>
        </div>
        
        {/* Mobile Actions */}
        <div className="flex items-center gap-2">
          {/* Status Dot */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-card)] border border-white/[0.04] rounded-full">
            <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-[var(--accent-amber)]' : 'bg-[var(--accent-emerald)]'}`} />
            <span className="text-[10px] text-[var(--text-muted)]">{pools.length}</span>
          </div>
          
          {/* Alert Bell */}
          <button 
            onClick={() => setAlertsOpen(!alertsOpen)}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.02] border border-white/[0.06] relative"
          >
            <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
            {triggeredAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[var(--accent-rose)] text-white text-[8px] font-bold flex items-center justify-center">
                {triggeredAlerts.length}
              </span>
            )}
          </button>
          
          {/* Menu Toggle */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.02] border border-white/[0.06]"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-white/[0.04] space-y-2">
          <button 
            onClick={() => {
              handleTipSOL();
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl gradient-gold text-[var(--bg-void)] font-semibold text-sm"
          >
            <Heart className="w-4 h-4" />
            Tip SOL
          </button>
          
          <button 
            onClick={() => {
              refresh();
              setMobileMenuOpen(false);
            }}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading && 'animate-spin'}`} />
            Refresh Data
          </button>
          
          <button 
            onClick={() => {
              setWalletOpen(true);
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              wallet.connected 
                ? 'bg-[var(--accent-emerald)]/10 border border-[var(--accent-emerald)]/30 text-[var(--accent-emerald)]' 
                : 'gradient-active text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {wallet.connected ? shortenAddress(wallet.publicKey, 6) : 'Connect Wallet'}
          </button>
          
          {/* API Status */}
          <div className="flex gap-2 justify-center pt-2">
            {['meteora', 'jupiter', 'helius'].map((api) => (
              <span 
                key={api}
                className={`px-2 py-1 rounded text-[10px] font-medium border uppercase ${
                  apiStatus[api as keyof typeof apiStatus] 
                    ? 'text-[var(--accent-emerald)] border-[var(--accent-emerald)]/30 bg-[var(--accent-emerald)]/8' 
                    : 'text-[var(--text-dim)] border-white/[0.04]'
                }`}
              >
                {api}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Wallet Modal */}
      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
        <DialogContent className="bg-[var(--bg-card)] border-white/[0.06] text-[var(--text-primary)] max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {wallet.connected ? 'Wallet Connected' : 'Connect Wallet'}
            </DialogTitle>
          </DialogHeader>
          
          {wallet.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-white/[0.02] rounded-xl border border-[var(--accent-emerald)]/30">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold">
                  {wallet.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs text-[var(--text-muted)]">Connected</div>
                  <div className="font-mono font-medium text-sm">{shortenAddress(wallet.publicKey, 6)}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/[0.02] rounded-lg text-center border border-white/[0.04]">
                  <div className="text-lg font-bold text-[var(--accent-cyan)]">{wallet.balance.toFixed(4)}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">SOL Balance</div>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-lg text-center border border-white/[0.04]">
                  <div className="text-lg font-bold text-[var(--accent-cyan)]">${(wallet.balance * 185).toFixed(2)}</div>
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">USD Value</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant="outline" 
                  className="border-white/[0.06] text-xs"
                  onClick={() => walletService.copyAddress()}
                >
                  Copy
                </Button>
                <Button 
                  variant="outline" 
                  className="border-white/[0.06] text-xs"
                  onClick={() => window.open(`https://solscan.io/account/${wallet.publicKey}`, '_blank')}
                >
                  Explorer
                </Button>
                <Button 
                  variant="destructive" 
                  className="text-xs"
                  onClick={() => {
                    walletService.disconnect();
                    setWalletOpen(false);
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {[
                { key: 'phantom', name: 'Phantom', config: WALLETS.phantom },
                { key: 'solflare', name: 'Solflare', config: WALLETS.solflare },
                { key: 'backpack', name: 'Backpack', config: WALLETS.backpack }
              ].map((w) => (
                <button
                  key={w.key}
                  onClick={() => handleWalletConnect(w.key)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    isWalletDetected(w.key) 
                      ? 'border-[var(--accent-emerald)]/30 bg-white/[0.02] hover:border-[var(--accent-emerald)]' 
                      : 'border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08]'
                  }`}
                >
                  <img 
                    src={w.config.icon} 
                    alt={w.name}
                    className="w-8 h-8 rounded-lg object-contain bg-white/[0.05] p-1"
                    onError={(e) => {
                      // Fallback to emoji if image fails
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
                    }}
                  />
                  <span className="fallback-icon hidden text-2xl">
                    {w.key === 'phantom' ? '🦊' : w.key === 'solflare' ? '🔥' : '🎒'}
                  </span>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-sm">{w.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {isWalletDetected(w.key) ? 'Click to connect' : 'Install wallet'}
                    </div>
                  </div>
                  {isWalletDetected(w.key) && (
                    <span className="text-[10px] text-[var(--accent-emerald)] bg-[var(--accent-emerald)]/10 px-2 py-0.5 rounded">
                      Detected
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Tip SOL Modal */}
      <Dialog open={showTipModal} onOpenChange={setShowTipModal}>
        <DialogContent className="bg-[var(--bg-card)] border-white/[0.06] text-[var(--text-primary)] max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Heart className="w-5 h-5 text-[var(--accent-gold)]" />
              Support LiquidityPro
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Your tips help us continue building and improving LiquidityPro. Thank you for your support!
            </p>
            
            <div className="p-4 bg-white/[0.02] rounded-xl border border-[var(--accent-gold)]/20">
              <div className="text-xs text-[var(--text-muted)] mb-1">Tip Address</div>
              <div className="font-mono text-sm break-all">{CONFIG.TIP_SOL_ADDRESS}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={copyTipAddress}
                className="bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1]"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Address
              </Button>
              <Button 
                onClick={() => {
                  window.open(`https://solscan.io/account/${CONFIG.TIP_SOL_ADDRESS}`, '_blank');
                  setShowTipModal(false);
                }}
                className="gradient-gold text-[var(--bg-void)] hover:opacity-90"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View on Solscan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
