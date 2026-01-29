import { useState } from 'react';
import { ChevronDown, BookOpen, Shield, Zap, BarChart3, Bell, Wallet, ExternalLink } from 'lucide-react';

interface GuideItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

export function GuideSection() {
  const [expandedId, setExpandedId] = useState<string | null>('intro');
  
  const toggle = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };
  
  const guides: GuideItem[] = [
    {
      id: 'intro',
      icon: <BookOpen className="w-5 h-5" />,
      title: 'What is LiquidityPro?',
      content: (
        <div className="space-y-3 text-[var(--text-secondary)] text-sm leading-relaxed">
          <p>
            LiquidityPro is an advanced analytics platform for Solana liquidity providers. 
            We aggregate data from Meteora DLMM and DAMM v2 pools, analyzing over 4000+ pools 
            in real-time to identify high-probability profitable opportunities.
          </p>
          <p>
            Our AI-powered scoring system evaluates pools based on TVL, volume, fees, APR, 
            and safety metrics to surface the best opportunities before they become obvious.
          </p>
        </div>
      )
    },
    {
      id: 'opportunities',
      icon: <Zap className="w-5 h-5" />,
      title: 'Understanding Opportunities',
      content: (
        <div className="space-y-3 text-[var(--text-secondary)] text-sm">
          <p>Opportunities are categorized by risk/reward profile:</p>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <span className="text-xl">🔥</span>
              <div>
                <div className="font-semibold text-[var(--accent-rose)]">Hot Pools</div>
                <div className="text-sm">Fee spikes detected in the last hour. High short-term opportunity but may be volatile.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <span className="text-xl">⚡</span>
              <div>
                <div className="font-semibold text-[var(--accent-cyan)]">Active Pools</div>
                <div className="text-sm">Consistent fee generation with good volume/TVL ratio. Moderate risk.</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <span className="text-xl">⭐</span>
              <div>
                <div className="font-semibold text-[var(--accent-emerald)]">Standard</div>
                <div className="text-sm">High score pools with balanced metrics. Lower risk, steady returns.</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'safety',
      icon: <Shield className="w-5 h-5" />,
      title: 'JupShield Safety Indicators',
      content: (
        <div className="space-y-3 text-[var(--text-secondary)] text-sm">
          <p>Safety indicators help you avoid risky pools:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[var(--accent-emerald)] shadow-[0_0_8px_var(--accent-emerald)]" />
              <span className="font-semibold text-[var(--accent-emerald)]">Safe (Green)</span>
              <span className="text-sm">- Verified tokens, healthy TVL</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[var(--accent-amber)] shadow-[0_0_6px_var(--accent-amber)]" />
              <span className="font-semibold text-[var(--accent-amber)]">Warning (Yellow)</span>
              <span className="text-sm">- Some unverified tokens, proceed with caution</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[var(--accent-rose)] shadow-[0_0_6px_var(--accent-rose)]" />
              <span className="font-semibold text-[var(--accent-rose)]">Danger (Red)</span>
              <span className="text-sm">- High risk, potential rug pull</span>
            </div>
          </div>
          <p className="text-sm mt-2">
            Enable JupShield in filters to automatically exclude dangerous pools from your view.
          </p>
        </div>
      )
    },
    {
      id: 'bins',
      icon: <BarChart3 className="w-5 h-5" />,
      title: 'Reading the Liquidity Chart',
      content: (
        <div className="space-y-3 text-[var(--text-secondary)] text-sm">
          <p>Each pool shows a 21-bin liquidity distribution:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Cyan bars</strong> = Liquidity distribution across price bins</li>
            <li><strong>Highlighted bin</strong> = Current active price bin where most swaps occur</li>
            <li><strong>Hover</strong> over any bin to see exact price, liquidity %, and bin ID</li>
          </ul>
          <p className="text-sm mt-2">
            The active bin is where you'll earn the most fees. If your position is far from the active bin, 
            consider rebalancing to capture more fees.
          </p>
        </div>
      )
    },
    {
      id: 'alerts',
      icon: <Bell className="w-5 h-5" />,
      title: 'Setting Up Alerts',
      content: (
        <div className="space-y-3 text-[var(--text-secondary)] text-sm">
          <p>Never miss an opportunity with custom alerts:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Go to Search & Alerts tab</li>
            <li>Select a pool from the dropdown</li>
            <li>Choose your condition (Fees 1h, Price, TVL, etc.)</li>
            <li>Enter the threshold value</li>
            <li>Click "Add" to activate</li>
          </ol>
          <p className="text-sm mt-2">
            Use "Add All" to apply the same alert to all filtered pools at once. 
            You'll see triggered alerts in the bell icon at the top of the page.
          </p>
        </div>
      )
    },
    {
      id: 'wallet',
      icon: <Wallet className="w-5 h-5" />,
      title: 'Connecting Your Wallet',
      content: (
        <div className="space-y-3 text-[var(--text-secondary)] text-sm">
          <p>Connect your Solana wallet for full functionality:</p>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">Phantom</span>
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">Solflare</span>
            <span className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs">Backpack</span>
          </div>
          <p className="text-sm">
            Once connected, you can:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>View your SOL balance and USD value</li>
            <li>Quick deposit into pools (coming soon)</li>
            <li>Get personalized recommendations</li>
          </ul>
        </div>
      )
    },
    {
      id: 'links',
      icon: <ExternalLink className="w-5 h-5" />,
      title: 'Useful Links',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name: 'Meteora', url: 'https://app.meteora.ag/', icon: '🏦', desc: 'Official DEX' },
            { name: 'Jupiter', url: 'https://jup.ag/', icon: '🪐', desc: 'Swap Aggregator' },
            { name: 'Solscan', url: 'https://solscan.io/', icon: '🔍', desc: 'Explorer' },
            { name: 'Birdeye', url: 'https://birdeye.so/', icon: '👁️', desc: 'Analytics' },
          ].map((link) => (
            <a 
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-colors"
            >
              <span className="text-xl">{link.icon}</span>
              <div>
                <div className="font-medium text-sm">{link.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{link.desc}</div>
              </div>
            </a>
          ))}
        </div>
      )
    }
  ];
  
  return (
    <div className="space-y-4">
      <div className="text-center mb-6 md:mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] mb-2">
          📚 How to Use LiquidityPro
        </h2>
        <p className="text-[var(--text-secondary)] text-sm">
          Everything you need to know to maximize your LP returns
        </p>
      </div>
      
      <div className="space-y-2">
        {guides.map((guide) => (
          <div 
            key={guide.id}
            className="bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden"
          >
            <button
              onClick={() => toggle(guide.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-[var(--accent-primary)]">{guide.icon}</span>
                <span className="font-semibold text-sm text-left">{guide.title}</span>
              </div>
              <ChevronDown 
                className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-300 ${expandedId === guide.id ? 'rotate-180' : ''}`} 
              />
            </button>
            
            {expandedId === guide.id && (
              <div className="px-4 pb-4 border-t border-white/[0.04]">
                <div className="pt-4">
                  {guide.content}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
