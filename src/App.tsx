import { useEffect, useState } from 'react';
import { AppStateProvider, useAppState } from '@/hooks/useAppState';
import { Header } from '@/components/Header';
import { OpportunitiesSection } from '@/components/OpportunitiesSection';
import { SearchAlertsSection } from '@/components/SearchAlertsSection';
import { GuideSection } from '@/components/GuideSection';
import { Particles } from '@/components/Particles';
import { Toaster } from '@/components/ui/sonner';
import { Sparkles, Search, BookOpen } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════

function AppContent() {
  const { activeTab, setActiveTab, isInitializing, initialize } = useAppState();
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    initialize().then(() => {
      setIsLoading(false);
    });
  }, [initialize]);
  
  // Loading screen - Premium
  if (isLoading || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0"
          style={{
            background: 'linear-gradient(135deg, #020204 0%, #050508 50%, #08090d 100%)'
          }}
        />
        
        <div className="relative z-10 text-center">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-6 animate-[loaderPulse_2s_ease-in-out_infinite] shadow-2xl">
            <span className="text-white text-2xl md:text-3xl font-bold">LP</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-2">
            Liquidity<span className="text-gradient">Pro</span>
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            Initializing<span className="animate-[dots_1.5s_steps(3)_infinite]">...</span>
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #020204 0%, #050508 50%, #08090d 100%)'
        }}
      />
      <Particles />
      
      {/* Content */}
      <div className="relative z-10 max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-3 md:py-6">
        <Header />
        
        {/* Navigation Tabs - Responsive */}
        <nav className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <TabButton 
            active={activeTab === 'opportunities'}
            onClick={() => setActiveTab('opportunities')}
            icon={<Sparkles className="w-4 h-4" />}
            label="Opportunities"
            badge="AI"
          />
          <TabButton 
            active={activeTab === 'search'}
            onClick={() => setActiveTab('search')}
            icon={<Search className="w-4 h-4" />}
            label="Search & Alerts"
          />
          <TabButton 
            active={activeTab === 'guide'}
            onClick={() => setActiveTab('guide')}
            icon={<BookOpen className="w-4 h-4" />}
            label="Guide"
          />
        </nav>
        
        {/* Tab Content */}
        <main className="min-h-[60vh]">
          {activeTab === 'opportunities' && <OpportunitiesSection />}
          {activeTab === 'search' && <SearchAlertsSection />}
          {activeTab === 'guide' && <GuideSection />}
        </main>
        
        {/* Footer - Premium */}
        <footer className="mt-12 md:mt-16 py-6 md:py-8 border-t border-white/[0.04]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="text-[var(--text-dim)] text-xs md:text-sm font-medium">
                LiquidityPro — Advanced LP Analytics for Solana
              </p>
              <p className="text-[var(--text-muted)] text-[10px] md:text-xs mt-1">
                Data from Meteora, Jupiter, Helius • Not financial advice • DYOR
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] md:text-xs text-[var(--text-muted)]">
              <a href="https://meteora.ag" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-primary)] transition-colors">
                Meteora
              </a>
              <a href="https://jup.ag" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-primary)] transition-colors">
                Jupiter
              </a>
              <a href="https://helius.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--text-primary)] transition-colors">
                Helius
              </a>
            </div>
          </div>
        </footer>
      </div>
      
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'var(--text-primary)',
            fontSize: '13px'
          }
        }}
      />
    </div>
  );
}

// Tab Button Component - Responsive
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}

function TabButton({ active, onClick, icon, label, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl font-semibold text-xs md:text-sm whitespace-nowrap transition-all flex-shrink-0 ${
        active 
          ? 'gradient-active text-white shadow-[0_4px_20px_rgba(6,182,212,0.3)]' 
          : 'bg-white/[0.02] border border-white/[0.04] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-white/[0.08] hover:bg-white/[0.04]'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>
      {badge && (
        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
          {badge}
        </span>
      )}
    </button>
  );
}

// Main App with Provider
function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}

export default App;
