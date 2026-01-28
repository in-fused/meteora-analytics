import { useState, useCallback } from 'react';

interface GuideItem {
  title: string;
  content: string;
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    title: 'Understanding Pool Scores',
    content:
      'Each pool is scored 10-99 based on TVL, volume, APR, token safety, farm status, and locked liquidity. Scores above 75 are considered excellent. The algorithm weighs TVL heavily as it indicates pool stability, while high volume and APR boost the score further.',
  },
  {
    title: 'Safety Levels Explained',
    content:
      'Safe (green): Both tokens verified by Jupiter. Warning (amber): Partial verification or high TVL. Danger (red): Unverified tokens with low TVL, or blacklisted. JupShield filters dangerous pools by default — disable it to see all pools.',
  },
  {
    title: 'AI Opportunity Detection',
    content:
      'The AI engine detects 7 opportunity types: Hot pools (fee velocity spikes), High Fee Velocity, High Volume/TVL ratio, High APR + Safe, Elite Score, Active Farms, and Outstanding Fee/TVL ratio. Hot pools are the most time-sensitive opportunities.',
  },
  {
    title: 'Live Transaction Feed',
    content:
      'When you expand a pool card, the app connects to Helius RPC to show real-time transactions. Swaps (purple), deposits (green), and withdrawals (red) are shown with amounts and Solscan links. The connection is on-demand to save resources.',
  },
  {
    title: 'Pool Types: DLMM vs DAMM vs CLMM',
    content:
      'DLMM (Dynamic Liquidity Market Maker): Meteora\'s concentrated liquidity with dynamic fees. DAMM v2: Meteora\'s automated market maker pools. CLMM (Concentrated Liquidity Market Maker): Raydium\'s concentrated liquidity pools. Each has different fee structures and strategies.',
  },
  {
    title: 'Using Alerts',
    content:
      'Set alerts on any safe pool to get notified when APR, TVL, volume, score, or fees cross your threshold. Alerts check every background refresh cycle (60 seconds). Triggered alerts appear in the bell notification dropdown.',
  },
  {
    title: 'Quick Deposit',
    content:
      'Connect your Phantom, Solflare, or Backpack wallet to use Quick Deposit. The app fetches quotes from Jupiter Ultra API for optimal routing, then redirects you to the pool\'s DEX page to complete the deposit.',
  },
];

function AccordionItem({ item, isOpen, onToggle }: { item: GuideItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className={`guide-item ${isOpen ? 'open' : ''}`}>
      <button className="guide-item-header" onClick={onToggle}>
        <span>{item.title}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ width: 16, height: 16, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <div className="guide-item-content">
          <p>{item.content}</p>
        </div>
      )}
    </div>
  );
}

export function GuideSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = useCallback(
    (index: number) => {
      setOpenIndex(openIndex === index ? null : index);
    },
    [openIndex]
  );

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Guide & Documentation
        </div>
      </div>
      <div className="panel-body">
        {GUIDE_ITEMS.map((item, i) => (
          <AccordionItem key={i} item={item} isOpen={openIndex === i} onToggle={() => handleToggle(i)} />
        ))}
      </div>
    </div>
  );
}
