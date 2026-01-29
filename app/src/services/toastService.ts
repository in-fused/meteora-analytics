// ═══════════════════════════════════════════════════════════════════════════
// TOAST UI - Notification system matching original monolith
// ═══════════════════════════════════════════════════════════════════════════

class ToastService {
  show(type: 'success' | 'error' | 'info', title: string, msg: string): void {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${msg}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  success(title: string, msg: string): void {
    this.show('success', title, msg);
  }

  error(title: string, msg: string): void {
    this.show('error', title, msg);
  }

  info(title: string, msg: string): void {
    this.show('info', title, msg);
  }
}

export const toastService = new ToastService();
