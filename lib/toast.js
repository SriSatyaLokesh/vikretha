/**
 * lib/toast.js — Non-blocking toast notification manager
 * Usage: import { toast } from './lib/toast.js';
 *        toast.success('Sale recorded ✓');
 *        toast.confirm('Remove staff?', () => doRemove(), () => {});
 */

const TOAST_DURATION = 3000; // ms
const MAX_TOASTS     = 5;

let _container = null;

function _getContainer() {
  if (!_container) {
    _container = document.getElementById('toast-container');
  }
  return _container;
}

let _idCounter = 0;

function _show(message, type = 'info', duration = TOAST_DURATION, actions = null) {
  const container = _getContainer();
  if (!container) return null;

  // Dismiss oldest if at max
  const existing = container.querySelectorAll('.toast');
  if (existing.length >= MAX_TOASTS) {
    _dismiss(existing[0]);
  }

  const id = `toast-${++_idCounter}`;
  const el = document.createElement('div');
  el.id = id;
  el.className = `toast toast-${type} toast-enter`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icons = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ', confirm: '?' };

  el.innerHTML = `
    <span class="toast-icon toast-icon-${type}">${icons[type] || 'ℹ'}</span>
    <span class="toast-message">${message}</span>
    ${actions ? `<div class="toast-actions">${actions}</div>` : ''}
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;

  container.appendChild(el);

  // Trigger enter animation (remove the no-op enter class to allow CSS animation to run)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.remove('toast-enter'));
  });

  // Close button
  el.querySelector('.toast-close').addEventListener('click', () => _dismiss(el));

  // Auto-dismiss (not for confirm toasts when duration === 0)
  let timer = null;
  if (duration > 0) {
    timer = setTimeout(() => _dismiss(el), duration);

    // Pause auto-dismiss on hover
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => {
      timer = setTimeout(() => _dismiss(el), 1500);
    });
  }

  return id;
}

function _dismiss(el) {
  if (!el || el.classList.contains('toast-exit')) return;
  el.classList.add('toast-exit');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Fallback removal in case animationend doesn't fire
  setTimeout(() => { if (el.parentNode) el.remove(); }, 400);
}

export const toast = {
  success(msg, duration = TOAST_DURATION) {
    return _show(msg, 'success', duration);
  },
  error(msg, duration = TOAST_DURATION) {
    return _show(msg, 'error', duration);
  },
  warn(msg, duration = TOAST_DURATION) {
    return _show(msg, 'warn', duration);
  },
  info(msg, duration = TOAST_DURATION) {
    return _show(msg, 'info', duration);
  },
  /**
   * Confirmation toast with Confirm/Cancel buttons.
   * @param {string}   msg       - Message to display
   * @param {Function} onConfirm - Called when user clicks Confirm
   * @param {Function} [onCancel]- Called when user clicks Cancel (optional)
   */
  confirm(msg, onConfirm, onCancel) {
    const actionsHtml = `
      <button class="toast-btn toast-btn-confirm">Confirm</button>
      <button class="toast-btn toast-btn-cancel">Cancel</button>
    `;
    const id = _show(msg, 'confirm', 0, actionsHtml); // duration=0 → no auto-dismiss
    if (!id) return;
    const container = _getContainer();
    if (!container) return;
    const el = document.getElementById(id);
    if (!el) return;

    el.querySelector('.toast-btn-confirm').addEventListener('click', () => {
      _dismiss(el);
      if (typeof onConfirm === 'function') onConfirm();
    });
    el.querySelector('.toast-btn-cancel').addEventListener('click', () => {
      _dismiss(el);
      if (typeof onCancel === 'function') onCancel();
    });
  },
  dismiss(id) {
    const el = document.getElementById(id);
    if (el) _dismiss(el);
  }
};
