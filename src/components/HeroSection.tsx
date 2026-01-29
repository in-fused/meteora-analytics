import { useAppState } from '@/hooks/useAppState';

export function HeroSection() {
  const { pools, opportunities } = useAppState();
  
  const hotCount = opportunities.filter(o => o.oppType === 'hot').length;
  
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 md:p-8 border border-white/[0.04]"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(6,182,212,0.04) 50%, rgba(5,150,105,0.02) 100%)'
      }}
    >
      {/* Background Glow */}
      <div 
        className="absolute -top-1/2 -right-[10%] w-[300px] md:w-[400px] h-[300px] md:h-[400px] rounded-full pointer-events-none animate-[heroGlow_10s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 60%)'
        }}
      />
      
      <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6">
        {/* Left Content */}
        <div className="flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[10px] md:text-xs font-bold tracking-wider text-[var(--accent-primary)] mb-3 md:mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-emerald)] animate-[dotPulse_1.5s_ease-in-out_infinite]" />
            AI-POWERED ANALYSIS
          </div>
          
          <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-2 md:mb-3 leading-tight">
            High-Probability <span className="text-gradient">Opportunities</span>
          </h1>
          
          <p className="text-[var(--text-secondary)] text-xs md:text-sm lg:text-base max-w-lg leading-relaxed">
            Real-time AI detection of profitable LP setups across 4000+ Meteora pools. 
            Sorted by probability of profitability.
          </p>
        </div>
        
        {/* Right Stats - Responsive Grid */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 w-full lg:w-auto">
          <div className="glass border border-white/[0.06] rounded-xl p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl lg:text-3xl font-bold font-mono text-[var(--text-primary)]">
              {pools.length.toLocaleString()}
            </div>
            <div className="text-[9px] md:text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-1">
              Pools
            </div>
          </div>
          
          <div className="glass border border-white/[0.06] rounded-xl p-3 md:p-4 text-center">
            <div className="text-xl md:text-2xl lg:text-3xl font-bold font-mono text-[var(--text-primary)]">
              {opportunities.length}
            </div>
            <div className="text-[9px] md:text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-1">
              Opportunities
            </div>
          </div>
          
          <div 
            className="glass border border-[var(--accent-rose)]/25 rounded-xl p-3 md:p-4 text-center"
            style={{
              background: 'linear-gradient(135deg, rgba(225,29,72,0.08), rgba(12,13,18,0.9))'
            }}
          >
            <div 
              className="text-xl md:text-2xl lg:text-3xl font-bold font-mono text-[var(--accent-rose)]"
              style={{ textShadow: '0 0 20px rgba(225,29,72,0.4)' }}
            >
              {hotCount}
            </div>
            <div className="text-[9px] md:text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-1">
              🔥 Hot
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
