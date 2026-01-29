// ═══════════════════════════════════════════════════════════════════════════
// METRICS TRACKING - Analytics for monetization decisions
// Matches original monolith Metrics object
// ═══════════════════════════════════════════════════════════════════════════

import { useAppState } from '@/hooks/useAppState';

interface MetricEvent {
  event: string;
  data: Record<string, any>;
  timestamp: number;
}

class MetricsService {
  private sessionStart = Date.now();
  private pageViews = 0;
  private poolClicks = 0;
  private opportunityViews = 0;
  private expandedPools: string[] = [];
  private executionAttempts = 0;
  private events: MetricEvent[] = [];

  init(): void {
    this.pageViews = parseInt(localStorage.getItem('lp_total_views') || '0') + 1;
    localStorage.setItem('lp_total_views', String(this.pageViews));
    window.addEventListener('beforeunload', () => this.save());
  }

  track(event: string, data: Record<string, any> = {}): void {
    this.events.push({ event, data, timestamp: Date.now() });

    if (event === 'pool_clicked') this.poolClicks++;
    if (event === 'pool_expanded') this.expandedPools.push(data.pool);
    if (event.includes('execution')) this.executionAttempts++;

    console.log('[Metric]', event, data);
  }

  save(): void {
    localStorage.setItem('lp_metrics', JSON.stringify({
      sessionStart: this.sessionStart,
      pageViews: this.pageViews,
      poolClicks: this.poolClicks,
      expandedPools: this.expandedPools,
      executionAttempts: this.executionAttempts,
      events: this.events,
    }));
  }

  getReport() {
    return {
      sessionStart: this.sessionStart,
      sessionDuration: Date.now() - this.sessionStart,
      pageViews: this.pageViews,
      poolClicks: this.poolClicks,
      executionAttempts: this.executionAttempts,
      mostViewedPools: [...new Set(this.expandedPools)]
        .map(p => ({ pool: p, views: this.expandedPools.filter(x => x === p).length }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10),
    };
  }
}

export const metricsService = new MetricsService();
