import { useMemo } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { PoolCard } from './PoolCard';

export function OpportunitiesSection() {
  const opportunities = useAppState((s) => s.opportunities);

  const columns = useMemo(() => {
    const colCount = window.innerWidth >= 1200 ? 3 : window.innerWidth >= 768 ? 2 : 1;
    const cols: typeof opportunities[] = Array.from({ length: colCount }, () => []);
    opportunities.forEach((opp, i) => {
      cols[i % colCount].push(opp);
    });
    return cols;
  }, [opportunities]);

  if (opportunities.length === 0) {
    return (
      <div className="alert-empty" style={{ textAlign: 'center', padding: 40 }}>
        <div className="loading-spinner" />
        <p style={{ marginTop: 12 }}>Analyzing pools for opportunities...</p>
      </div>
    );
  }

  return (
    <div id="opportunitiesList" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      {columns.map((col, ci) => (
        <div key={ci} className="opp-column">
          {col.map((opp, i) => (
            <PoolCard
              key={opp.id}
              pool={opp}
              rank={i * columns.length + ci + 1}
              isOpp
            />
          ))}
        </div>
      ))}
    </div>
  );
}
