import { useAppState } from '@/hooks/useAppState';
import { PoolCard } from './PoolCard';
import { HeroSection } from './HeroSection';
import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

export function OpportunitiesSection() {
  const { opportunities, isLoading } = useAppState();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    // Store in localStorage
    const emails = JSON.parse(localStorage.getItem('lp_emails') || '[]');
    if (!emails.includes(email)) {
      emails.push(email);
      localStorage.setItem('lp_emails', JSON.stringify(emails));
    }
    localStorage.setItem('lp_email_subscribed', 'true');
    
    setSubscribed(true);
    toast.success('Subscribed! You\'ll receive opportunity alerts');
  };
  
  // Single column for mobile, 2 for tablet, 3 for desktop
  const getColumns = () => {
    const cols: typeof opportunities[] = [[], [], []];
    opportunities.forEach((opp, i) => {
      cols[i % 3].push(opp);
    });
    return cols;
  };
  
  const columns = getColumns();
  
  return (
    <div className="space-y-4 md:space-y-6">
      <HeroSection />
      
      {/* Email Capture */}
      {!subscribed && (
        <div 
          className="rounded-2xl p-4 md:p-6 text-center border border-[var(--accent-primary)]/15"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(5,150,105,0.05))'
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
            <h3 className="text-base md:text-lg font-bold text-[var(--text-primary)]">
              Get Opportunity Alerts
            </h3>
          </div>
          <p className="text-xs md:text-sm text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
            Be the first to know when high-yield LP opportunities appear. No spam, just alpha.
          </p>
          <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-primary)] transition-colors input-premium"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-lg gradient-primary text-white font-semibold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap"
            >
              Subscribe
            </button>
          </form>
        </div>
      )}
      
      {subscribed && (
        <div className="rounded-2xl p-4 text-center border border-[var(--accent-emerald)]/20 bg-[var(--accent-emerald)]/8">
          <p className="text-[var(--accent-emerald)] text-sm flex items-center justify-center gap-2">
            <span>✓</span>
            You're subscribed! Check your inbox for alerts.
          </p>
        </div>
      )}
      
      {/* Opportunities Grid - Responsive */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-20">
          <div className="loading-spinner loading-spinner-lg mb-4" />
          <p className="text-[var(--text-muted)] text-sm">Loading opportunities...</p>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-12 md:py-16 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
          <p className="text-[var(--text-muted)] mb-2 text-sm">No high-probability opportunities detected.</p>
          <p className="text-xs text-[var(--text-dim)]">Adjust filters or wait for market conditions to change.</p>
        </div>
      ) : (
        <>
          {/* Desktop: 3 columns */}
          <div className="hidden lg:flex gap-4 items-start">
            {columns.map((column, colIndex) => (
              <div key={colIndex} className="flex-1 min-w-0 flex flex-col gap-4">
                {column.map((opp, index) => (
                  <PoolCard 
                    key={opp.id} 
                    pool={opp} 
                    rank={colIndex + index * 3 + 1}
                    isOpportunity
                  />
                ))}
              </div>
            ))}
          </div>
          
          {/* Tablet: 2 columns */}
          <div className="hidden sm:grid lg:hidden grid-cols-2 gap-4">
            {opportunities.map((opp, index) => (
              <PoolCard 
                key={opp.id} 
                pool={opp} 
                rank={index + 1}
                isOpportunity
              />
            ))}
          </div>
          
          {/* Mobile: 1 column */}
          <div className="flex flex-col gap-3 sm:hidden">
            {opportunities.map((opp, index) => (
              <PoolCard 
                key={opp.id} 
                pool={opp} 
                rank={index + 1}
                isOpportunity
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
