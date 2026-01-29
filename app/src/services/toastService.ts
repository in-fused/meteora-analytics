// ═══════════════════════════════════════════════════════════════════════════
// TOAST UI - Notification system matching original monolith
// Uses safe DOM methods instead of innerHTML to prevent XSS
// ═══════════════════════════════════════════════════════════════════════════

class ToastService {
  show(type: 'success' | 'error' | 'info', title: string, msg: string): void {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    const contentEl = document.createElement('div');
    contentEl.className = 'toast-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;

    const msgEl = document.createElement('div');
    msgEl.className = 'toast-message';
    msgEl.textContent = msg;

    contentEl.appendChild(titleEl);
    contentEl.appendChild(msgEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => toast.remove());

    toast.appendChild(iconEl);
    toast.appendChild(contentEl);
    toast.appendChild(closeBtn);

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
