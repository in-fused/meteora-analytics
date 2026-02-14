// ═══════════════════════════════════════════════════════════════════════════
// METRICS TRACKING - Lightweight analytics for monetization decisions
// ═══════════════════════════════════════════════════════════════════════════

class MetricsService {
  private sessionStart = Date.now();
  private pageViews = 0;
  private poolClicks = 0;
  private executionAttempts = 0;

  init(): void {
    this.pageViews = parseInt(localStorage.getItem('lp_total_views') || '0') + 1;
    localStorage.setItem('lp_total_views', String(this.pageViews));
  }

  track(event: string, _data: Record<string, any> = {}): void {
    if (event === 'pool_clicked') this.poolClicks++;
    if (event.includes('execution')) this.executionAttempts++;
  }

  getReport() {
    return {
      sessionStart: this.sessionStart,
      sessionDuration: Date.now() - this.sessionStart,
      pageViews: this.pageViews,
      poolClicks: this.poolClicks,
      executionAttempts: this.executionAttempts,
    };
  }
}

export const metricsService = new MetricsService();
