/**
 * lib/modal.js — Centralized Modal & Dialog Manager
 *
 * Provides:
 * - Responsive desktop centered dialogs + mobile bottom sheets
 * - Global Escape key listener (dismisses topmost modal)
 * - Backdrop click detection
 * - Focus trapping and automatic focus restoration
 * - Dirty form guard (prevents accidental loss of unsaved changes on Esc/backdrop click)
 * - Modal stack (LIFO) management with body scroll-locking
 */

const _modalStack = [];
let _keyboardListenerInitialized = false;

function _initGlobalKeyboardListener() {
  if (_keyboardListenerInitialized) return;
  _keyboardListenerInitialized = true;

  window.addEventListener('keydown', (e) => {
    if (_modalStack.length === 0) return;

    // ESCAPE key dismisses top-most modal or active confirmation prompt
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      const top = _modalStack[_modalStack.length - 1];
      if (top && typeof top.close === 'function') {
        top.close(false); // request normal close with dirty guard check
      }
      return;
    }

    // TAB key focus trap within top-most modal
    if (e.key === 'Tab') {
      const top = _modalStack[_modalStack.length - 1];
      if (!top || !top.sheet) return;

      // If confirm dialog is open, trap focus inside it
      const trapContainer = top.getConfirmOverlay?.() || top.sheet;

      const focusables = Array.from(
        trapContainer.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);

      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !trapContainer.contains(document.activeElement)) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl || !trapContainer.contains(document.activeElement)) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  }, true);
}

function _updateBodyScrollLock() {
  if (_modalStack.length > 0) {
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
  } else {
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
  }
}

/**
 * Registers an existing overlay/sheet into the Modal Manager stack.
 *
 * @param {Object} options
 * @param {HTMLElement} options.overlay
 * @param {HTMLElement} options.sheet
 * @param {HTMLElement} [options.closeBtn]
 * @param {Function} [options.onClose]
 * @param {boolean} [options.confirmOnDiscard=true] - Guard unsaved changes
 * @param {Function} [options.isDirty] - Optional custom dirty check function
 * @returns {Function} close(force) function
 */
export function registerModal({ overlay, sheet, closeBtn, onClose, confirmOnDiscard = true, isDirty = null }) {
  _initGlobalKeyboardListener();

  const previousActiveElement = document.activeElement;
  let isClosed = false;
  let _hasChanges = false;
  let _confirmOverlay = null;

  // Track any typing or selection change within the sheet (capture phase ensures reliability)
  if (confirmOnDiscard && sheet) {
    sheet.addEventListener('input', () => { _hasChanges = true; }, true);
    sheet.addEventListener('change', () => { _hasChanges = true; }, true);
    sheet.addEventListener('keyup', () => { _hasChanges = true; }, true);
  }

  function checkIsDirty() {
    if (!confirmOnDiscard) return false;
    if (typeof isDirty === 'function') return isDirty();
    if (_hasChanges) return true;

    // Deep inspection: verify if any input, textarea or select has non-empty/modified data
    if (sheet) {
      const inputs = sheet.querySelectorAll('input:not([type="hidden"]), textarea, select');
      for (const input of inputs) {
        if (input.readOnly || input.disabled) continue;
        if (input.type === 'checkbox' || input.type === 'radio') {
          if (input.defaultChecked !== input.checked) return true;
        } else if (input.tagName === 'SELECT') {
          const selected = Array.from(input.options).find(o => o.selected);
          const defaultOpt = Array.from(input.options).find(o => o.defaultSelected) || input.options[0];
          if (selected && defaultOpt && selected.value !== defaultOpt.value) return true;
        } else {
          const val = (input.value || '').trim();
          const def = (input.defaultValue || '').trim();
          if (val !== def && val.length > 0) return true;
        }
      }
    }
    return false;
  }

  function _removeConfirmOverlay() {
    if (_confirmOverlay && _confirmOverlay.parentNode) {
      _confirmOverlay.parentNode.removeChild(_confirmOverlay);
    }
    _confirmOverlay = null;
  }

  function _showDiscardConfirm(onDiscard) {
    if (_confirmOverlay) return; // already visible

    _confirmOverlay = document.createElement('div');
    _confirmOverlay.className = 'modal-confirm-overlay';
    _confirmOverlay.innerHTML = `
      <div class="modal-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="modal-confirm-title">
        <div class="modal-confirm-icon">⚠️</div>
        <h3 id="modal-confirm-title" class="modal-confirm-title">Discard unsaved changes?</h3>
        <p class="modal-confirm-msg">You have unsaved changes in this form. If you close now, your edits will be lost.</p>
        <div class="modal-confirm-actions">
          <button type="button" class="btn btn-secondary" id="modal-confirm-keep">Keep Editing</button>
          <button type="button" class="btn btn-danger" id="modal-confirm-discard">Discard Changes</button>
        </div>
      </div>
    `;

    sheet.style.position = 'relative';
    sheet.appendChild(_confirmOverlay);

    const keepBtn = _confirmOverlay.querySelector('#modal-confirm-keep');
    const discardBtn = _confirmOverlay.querySelector('#modal-confirm-discard');

    keepBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _removeConfirmOverlay();
      // restore focus back to first input
      const firstInput = sheet.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');
      if (firstInput) firstInput.focus();
    });

    discardBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _removeConfirmOverlay();
      _hasChanges = false;
      onDiscard();
    });

    // Default focus to Keep Editing for safety
    setTimeout(() => {
      if (keepBtn) keepBtn.focus();
    }, 60);
  }

  function _forceClose() {
    if (isClosed) return;
    isClosed = true;

    _removeConfirmOverlay();

    // Remove from stack
    const idx = _modalStack.indexOf(modalRecord);
    if (idx !== -1) {
      _modalStack.splice(idx, 1);
    }
    _updateBodyScrollLock();

    // Visual exit transition
    overlay.classList.remove('modal-open');
    overlay.classList.remove('modal-overlay--open');
    if (sheet) sheet.classList.remove('bs-sheet--open');

    const removeNode = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        try { previousActiveElement.focus(); } catch (_) {}
      }
      if (typeof onClose === 'function') {
        try { onClose(); } catch (err) { console.error('[Modal] onClose error:', err); }
      }
    };

    setTimeout(removeNode, 220);
  }

  function _requestClose(force = false) {
    if (isClosed) return;

    // If discard confirmation is open and Esc was hit, close the confirmation and return to editing
    if (_confirmOverlay) {
      _removeConfirmOverlay();
      return;
    }

    // If form has unsaved modifications and close wasn't forced (e.g. from successful Save), confirm
    if (!force && checkIsDirty()) {
      _showDiscardConfirm(() => _forceClose());
      return;
    }

    _forceClose();
  }

  const modalRecord = {
    overlay,
    sheet,
    close: (force = false) => _requestClose(force),
    markClean: () => { _hasChanges = false; },
    markDirty: () => { _hasChanges = true; },
    getConfirmOverlay: () => _confirmOverlay
  };

  _modalStack.push(modalRecord);
  _updateBodyScrollLock();

  // Backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      _requestClose(false);
    }
  });

  // Close button click if provided
  if (closeBtn) {
    closeBtn.addEventListener('click', () => _requestClose(false));
  }

  // Trigger open animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('modal-open');
      overlay.classList.add('modal-overlay--open');
      if (sheet) sheet.classList.add('bs-sheet--open');

      // Autofocus first interactive element
      if (sheet) {
        const firstInput = sheet.querySelector(
          'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button.btn-primary'
        );
        if (firstInput) {
          try { firstInput.focus(); } catch (_) {}
        }
      }
    });
  });

  return _requestClose;
}

/**
 * Creates and mounts a responsive modal dialog shell with dirty form guard.
 *
 * @param {Object} options
 * @param {string} options.title - Header title text
 * @param {'sm'|'md'|'lg'|'xl'} [options.size='md'] - Dialog size tier on desktop
 * @param {Function} [options.onClose] - Cleanup callback on close
 * @param {boolean} [options.confirmOnDiscard=true] - Guard unsaved changes on Esc/backdrop click
 * @returns {{ overlay: HTMLElement, sheet: HTMLElement, body: HTMLElement, header: HTMLElement, titleEl: HTMLElement, closeBtn: HTMLElement, close: Function, markClean: Function, markDirty: Function }}
 */
export function createModalShell({ title = '', size = 'md', onClose, confirmOnDiscard = true, isDirty = null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const sheet = document.createElement('div');
  sheet.className = `modal-sheet modal-sheet--${size}`;

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'modal-title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal-close-btn';
  closeBtn.setAttribute('aria-label', 'Close dialog (Esc)');
  closeBtn.title = 'Close (Esc)';
  closeBtn.innerHTML = '&times;';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  sheet.appendChild(header);
  overlay.appendChild(sheet);

  document.body.appendChild(overlay);

  const close = registerModal({ overlay, sheet, closeBtn, onClose, confirmOnDiscard, isDirty });

  return {
    overlay,
    sheet,
    header,
    titleEl,
    closeBtn,
    close,
    markClean: () => {
      const top = _modalStack.find(m => m.overlay === overlay);
      if (top) top.markClean();
    },
    markDirty: () => {
      const top = _modalStack.find(m => m.overlay === overlay);
      if (top) top.markDirty();
    }
  };
}

/**
 * Returns whether any modal is currently open.
 */
export function hasOpenModals() {
  return _modalStack.length > 0 || Boolean(document.querySelector('.rpt-panel-open'));
}

/**
 * Dismisses the topmost open modal, if any.
 * @param {boolean} [force=false]
 * @returns {boolean} true if a modal was closed
 */
export function closeTopModal(force = false) {
  if (_modalStack.length === 0) return false;
  const top = _modalStack[_modalStack.length - 1];
  if (top && typeof top.close === 'function') {
    top.close(force);
    return true;
  }
  return false;
}
