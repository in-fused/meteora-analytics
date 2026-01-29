import { useAppState } from '@/hooks/useAppState';

export function HeroSection() {
  const pools = useAppState((s) => s.pools);
  const opportunities = useAppState((s) => s.opportunities);

  const hotCount = opportunities.filter((o) => o.oppType === 'hot').length;

  return (
    <div className="hero-section">
      <div className="hero-stats">
        <div className="hero-stat">
          <div className="hero-stat-value" id="heroPoolCount">
            {pools.length.toLocaleString()}
          </div>
          <div className="hero-stat-label">Live Pools</div>
        </div>
        <div className="hero-stat">
          <div className="hero-stat-value hero-stat-accent" id="heroOppCount">
            {opportunities.length}
          </div>
          <div className="hero-stat-label">Opportunities</div>
        </div>
        <div className="hero-stat">
          <div className="hero-stat-value hero-stat-hot" id="heroHotCount">
            {hotCount}
          </div>
          <div className="hero-stat-label">Hot Pools</div>
        </div>
      </div>
    </div>
  );
}
