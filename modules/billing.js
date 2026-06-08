/**
 * modules/billing.js — Billing & Sale Recording
 * 2026 seller-optimised UI: product card grid, in-cart stepper,
 * live-total submit, animated confirmation with ⏳/✓ sync badge.
 * Exported: render(container) — called by app.js on #/billing route.
 */
import { db } from '../lib/firebase-init.js';
import { auth } from '../lib/firebase-init.js';
import {
  collection, doc, addDoc, runTransaction, writeBatch,
  onSnapshot, increment, serverTimestamp, getDocs, setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, CURRENCY, LOCALE } from '../shop.config.js';
import { toast } from '../lib/toast.js';

// ── Module State ──────────────────────────────────────────────
let _inventory = [];        // [{ id, name, price, unit, stock }]
let _cart      = new Map(); // item_id → { id, name, price, unit, qty }
let _discMode  = 'pct';     // 'pct' | 'inr'
let _unsubInv  = null;      // inventory onSnapshot unsubscribe
let _customers = [];        // [{ name, phone }] — loaded once per billing session
let _billingTypeFilter   = '';
let _billingbrandFilter = '';
let _paymentMode = 'cash';  // 'cash' | 'upi' | 'card' | 'split'

// ── XSS Safety ────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/** Normalises an Indian mobile number for wa.me URLs.
 *  Accepts: 10 digits, 9110-digits, +9110-digits.
 *  Returns "91XXXXXXXXXX", null (empty), or false (invalid). */
function normalizeIndianPhone(raw) {
  if (!raw) return null;
  const stripped = String(raw).trim();
  if (!stripped) return null;
  const digits = stripped.replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return false;
}


// ── Customer Contact Book ─────────────────────────────────────
async function _loadCustomers() {
  try {
    const snap = await getDocs(collection(db, 'shops', SHOP_ID, 'customers'));
    _customers = snap.docs.map(d => d.data());
  } catch (e) {
    console.warn('[Billing] Could not load customers', e);
  }
}

// ── Entry Point ───────────────────────────────────────────────
export function render(container) {
  _unsubInv?.();           // clean up previous listener
  _cart      = new Map();
  _discMode  = 'pct';
  _customers = [];
  _billingTypeFilter   = '';
  _billingbrandFilter = '';
  _paymentMode = 'cash';

  container.innerHTML = `
    <div id="billing-screen" class="billing-screen">

      <!-- Products panel -->
      <div class="billing-products-panel">
        <div class="billing-search-wrap">
          <span class="billing-search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
          <input id="product-search" type="search" autocomplete="off"
            class="billing-search-input" placeholder="Search products..."
            aria-label="Search products">
        </div>
        <div id="billing-filter-row" class="billing-filter-row">
          <select id="billing-type-filter" class="billing-filter-select" aria-label="Filter by type">
            <option value="">All Types</option>
          </select>
          <select id="billing-brand-filter" class="billing-filter-select" aria-label="Filter by brand">
            <option value="">All Brands</option>
          </select>
        </div>
        <div id="product-grid" class="product-grid"></div>
        <div style="padding:8px 4px 4px;">
          <button id="adhoc-item-btn"
            style="width:100%;padding:11px 16px;border-radius:10px;cursor:pointer;
                   background:transparent;border:1.5px dashed var(--border);
                   color:var(--text-secondary);font:inherit;font-size:0.85rem;
                   display:flex;align-items:center;justify-content:center;gap:6px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Other item
          </button>
        </div>
      </div>

      <!-- Mobile sticky cart bar (shown when cart has items) -->
      <div id="mobile-cart-bar" class="mobile-cart-bar" style="display:none;" aria-live="polite">
        <div class="mobile-cart-bar-inner">
          <span id="mcb-count" class="mobile-cart-bar-count"></span>
          <span id="mcb-total" class="mobile-cart-bar-total"></span>
        </div>
        <button id="mcb-toggle" class="mobile-cart-bar-btn">View Cart ↓</button>
      </div>

      <!-- Cart panel -->
      <div class="billing-cart-panel">
        <div class="card">
          <div class="section-header" style="margin-bottom:12px;">
            <span class="section-title">Cart</span>
          </div>

          <div id="cart-rows"></div>
          <div id="cart-empty" class="cart-empty">No items yet. Tap a product to add.</div>

          <!-- Discount -->
          <div style="margin-top:14px;">
            <div class="discount-row">
              <label style="font-size:0.875rem;font-weight:500;color:var(--text-secondary);flex:1;">Discount</label>
              <div class="seg-toggle">
                <button id="disc-pct" class="active">%</button>
                <button id="disc-inr">₹</button>
              </div>
            </div>
            <input id="discount-val" type="number" min="0" step="0.01" value="0"
              placeholder="0" class="form-input" style="margin-top:8px;">
          </div>

          <!-- Customer phone + name -->
          <div class="form-group" style="margin-top:12px;">
            <label class="form-label">
              Customer Phone <span style="color:var(--text-muted);font-weight:400;">(optional)</span>
            </label>
            <input id="customer-phone" type="tel" autocomplete="tel"
              list="phone-suggestions" placeholder="+91 98765 43210" class="form-input">
            <datalist id="phone-suggestions"></datalist>
            <div id="phone-err" style="display:none;font-size:0.78rem;color:var(--danger);margin-top:4px;">Phone must be 10 digits or start with +91</div>
          </div>
          <div class="form-group" style="margin-top:8px;">
            <label class="form-label">
              Customer Name <span style="color:var(--text-muted);font-weight:400;">(optional)</span>
            </label>
            <input id="customer-name" type="text" autocomplete="name"
              placeholder="Auto-fills from phone" class="form-input">
          </div>

          <!-- Payment mode -->
          <div class="form-group" style="margin-top:12px;">
            <label class="form-label">Payment</label>
            <div class="pay-mode-group">
              <button type="button" class="pay-mode-btn active" data-mode="cash">Cash</button>
              <button type="button" class="pay-mode-btn" data-mode="upi">UPI</button>
              <button type="button" class="pay-mode-btn" data-mode="card">Card</button>
              <button type="button" class="pay-mode-btn" data-mode="split">Split</button>
            </div>
            <div id="pay-split-inputs" style="display:none;margin-top:8px;">
              <div class="pay-split-row">
                <span class="pay-split-label">Cash</span>
                <input id="split-cash" type="number" min="0" step="0.01" placeholder="0" class="form-input pay-split-input">
              </div>
              <div class="pay-split-row" style="margin-top:4px;">
                <span class="pay-split-label">UPI</span>
                <input id="split-upi"  type="number" min="0" step="0.01" placeholder="0" class="form-input pay-split-input">
              </div>
              <div class="pay-split-row" style="margin-top:4px;">
                <span class="pay-split-label">Card</span>
                <input id="split-card" type="number" min="0" step="0.01" placeholder="0" class="form-input pay-split-input">
              </div>
            </div>
          </div>
          <!-- Totals -->
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.875rem;color:var(--text-secondary);">Subtotal</span>
            <span id="subtotal-val" style="font-size:0.875rem;font-variant-numeric:tabular-nums;">${CURRENCY}0</span>
          </div>
          <div id="disc-line" style="display:none;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.875rem;color:var(--text-secondary);">Discount</span>
            <span id="disc-val" style="font-size:0.875rem;color:var(--success);font-variant-numeric:tabular-nums;">−${CURRENCY}0</span>
          </div>
          <div class="cart-total-row">
            <span class="cart-total-label">Total</span>
            <span id="total-val" class="cart-total-value">${CURRENCY}0</span>
          </div>

          <div id="submit-err" class="alert alert-error" style="display:none;margin-bottom:10px;"></div>
          <button id="submit-btn" class="btn btn-primary btn-full" style="height:52px;font-size:1rem;">
            Submit Sale
          </button>
        </div>
      </div>
    </div>`;

  // ── Attach event listeners ────────────────────────────────
  container.querySelector('#product-search')
    .addEventListener('input', e => _renderGrid(e.target.value));

  container.querySelector('#billing-type-filter')
    .addEventListener('change', e => {
      _billingTypeFilter = e.target.value;
      _renderGrid(container.querySelector('#product-search')?.value ?? '');
    });
  container.querySelector('#billing-brand-filter')
    .addEventListener('change', e => {
      _billingbrandFilter = e.target.value;
      _renderGrid(container.querySelector('#product-search')?.value ?? '');
    });

  container.querySelector('#discount-val')
    .addEventListener('input', _updateTotals);

  container.querySelector('#disc-pct').addEventListener('click', () => {
    _discMode = 'pct';
    container.querySelector('#disc-pct').classList.add('active');
    container.querySelector('#disc-inr').classList.remove('active');
    _updateTotals();
  });
  container.querySelector('#disc-inr').addEventListener('click', () => {
    _discMode = 'inr';
    container.querySelector('#disc-inr').classList.add('active');
    container.querySelector('#disc-pct').classList.remove('active');
    _updateTotals();
  });

  // Delegated — product grid: card tap + stepper buttons
  const grid = container.querySelector('#product-grid');
  const handleGridClick = e => {
    const stepBtn = e.target.closest('[data-step]');
    const card    = e.target.closest('.product-card');
    if (stepBtn) {
      e.stopPropagation();
      const id   = stepBtn.dataset.id;
      const item = _cart.get(id);
      if (!item) return;
      stepBtn.dataset.step === 'inc' ? item.qty++ : item.qty--;
      if (item.qty <= 0) _cart.delete(id);
      _refresh(container);
      return;
    }
    if (card && card.getAttribute('aria-disabled') !== 'true') {
      const id  = card.dataset.id;
      const inv = _inventory.find(p => p.id === id);
      if (!inv) return;
      if (inv.has_colors && inv.variants && inv.variants.length > 0) {
        _showVariantPicker(container, inv);
        return;
      }
      if (inv.hasSizes && inv.sizes && Object.keys(inv.sizes).length > 0) {
        _showSizePicker(container, inv);
        return;
      }
      if (!_cart.has(id)) {
        _cart.set(id, { id: inv.id, cartKey: inv.id, name: inv.name,
          price: Number(inv.price), unit: inv.unit || 'pc', qty: 1,
          sizeKey: null, sizeLabel: null });
      }
      _refresh(container);
    }
  };
  grid.addEventListener('click', handleGridClick);
  grid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleGridClick(e);
    }
  });

  // Delegated — cart rows: stepper + remove
  container.querySelector('#cart-rows').addEventListener('click', e => {
    const btn = e.target.closest('[data-cart]');
    if (!btn) return;
    const id   = btn.dataset.id;
    const item = _cart.get(id);
    if (!item) return;
    const action = btn.dataset.cart;
    if (action === 'inc')      { item.qty++; }
    else if (action === 'dec') { item.qty--; if (item.qty <= 0) _cart.delete(id); }
    else if (action === 'remove') { _cart.delete(id); }
    _refresh(container);
  });

  container.querySelector('#submit-btn')
    .addEventListener('click', () => _handleSubmit(container));

  // Mobile cart bar — "View Cart" scrolls to cart panel
  container.querySelector('#mcb-toggle')
    ?.addEventListener('click', () => {
      document.querySelector('.billing-cart-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

  container.querySelector('#adhoc-item-btn')
    .addEventListener('click', () => _showAdhocItemForm(container));

  _loadInventory(container);

  // Load customers for phone autocomplete
  _loadCustomers().then(() => {
    const dl = document.getElementById('phone-suggestions');
    if (dl) {
      dl.innerHTML = _customers
        .map(c => `<option value="${escapeHtml(c.phone)}">${escapeHtml(c.name)}</option>`)
        .join('');
    }
  });

  // Phone input: auto-fill name when exact match found
  container.querySelector('#customer-phone').addEventListener('input', e => {
    const raw   = e.target.value.trim();
    const errEl = document.getElementById('phone-err');
    if (raw) {
      const norm = normalizeIndianPhone(raw);
      if (errEl) errEl.style.display = norm === false ? 'block' : 'none';
    } else {
      if (errEl) errEl.style.display = 'none';
    }
    // Auto-fill name when exact match found
    const match = _customers.find(c => c.phone === raw);
    if (match) {
      const nameEl = document.getElementById('customer-name');
      if (nameEl && !nameEl.value) nameEl.value = match.name;
    }
  });

  // Payment mode buttons
  container.querySelector('.pay-mode-group').addEventListener('click', e => {
    const btn = e.target.closest('.pay-mode-btn');
    if (!btn) return;
    _paymentMode = btn.dataset.mode;
    container.querySelectorAll('.pay-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const splitEl = container.querySelector('#pay-split-inputs');
    if (splitEl) splitEl.style.display = _paymentMode === 'split' ? 'block' : 'none';
  });

}

// ── Refresh grid + cart together ─────────────────────────────
function _refresh(container) {
  const q = container.querySelector('#product-search')?.value ?? '';
  _renderGrid(q);
  _renderCartRows();
}

// ── Render 2-column product grid ─────────────────────────────
function _renderGrid(query = '') {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const q     = query.trim().toLowerCase();
  const items = q ? _inventory.filter(p => p.name.toLowerCase().includes(q)) : _inventory;

  // Populate filter dropdowns from all inventory items
  const typeEl   = document.getElementById('billing-type-filter');
  const brandEl = document.getElementById('billing-brand-filter');
  if (typeEl) {
    const types = [...new Set(_inventory.map(p => p.type || '').filter(Boolean))].sort();
    const cur = typeEl.value;
    typeEl.innerHTML = '<option value="">All Types</option>' +
      types.map(t => `<option value="${escapeHtml(t)}"${t === cur ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
    if (!types.includes(cur)) { typeEl.value = ''; _billingTypeFilter = ''; }
    typeEl.classList.toggle('has-value', !!_billingTypeFilter);
  }
  if (brandEl) {
    const brands = [...new Set(_inventory.map(p => p.brand || '').filter(Boolean))].sort();
    const cur = brandEl.value;
    brandEl.innerHTML = '<option value="">All Brands</option>' +
      brands.map(b => `<option value="${escapeHtml(b)}"${b === cur ? ' selected' : ''}>${escapeHtml(b)}</option>`).join('');
    if (!brands.includes(cur)) { brandEl.value = ''; _billingbrandFilter = ''; }
    brandEl.classList.toggle('has-value', !!_billingbrandFilter);
  }

  // Apply type/brand filter
  let filteredItems = items;
  if (_billingTypeFilter)   filteredItems = filteredItems.filter(p => (p.type   ?? '') === _billingTypeFilter);
  if (_billingbrandFilter) filteredItems = filteredItems.filter(p => (p.brand ?? '') === _billingbrandFilter);

  if (_inventory.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding-top:48px;">
        <div style="margin-bottom:12px;color:var(--text-muted);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>
        <p style="font-weight:600;color:var(--text-primary);margin-bottom:4px;">
          No products yet
        </p>
        <p style="font-size:0.8rem;">Add items in the Inventory tab (coming soon)</p>
      </div>`;
    return;
  }
  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding-top:48px;">
        <div style="margin-bottom:12px;color:var(--text-muted);"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>
        <p>No results for &ldquo;${escapeHtml(query)}&rdquo;</p>
      </div>`;
    return;
  }

  grid.innerHTML = filteredItems.map(item => {
    const inCartCheck = item.has_colors
      ? [..._cart.keys()].some(k => k.startsWith(item.id + '__'))
      : item.hasSizes
      ? [..._cart.keys()].some(k => k.startsWith(item.id + '::'))
      : _cart.has(item.id);
    const cartItem = inCartCheck
      ? ((item.has_colors || item.hasSizes)
          ? { qty: [..._cart.values()].filter(e => e.id === item.id).reduce((s, e) => s + e.qty, 0) }
          : _cart.get(item.id))
      : null;
    const inCart   = !!cartItem;
    const qty      = cartItem?.qty ?? 0;
    const stock    = (item.has_colors && item.variants)
      ? item.variants.reduce((s, v) => s + v.qty, 0)
      : (item.hasSizes && item.sizes)
        ? Object.values(item.sizes).reduce((s, v) => s + (v.stock ?? 0), 0)
        : Number(item.stock ?? 0);
    const lowStock = stock > 0 && stock <= 5;
    const noStock  = stock === 0;
    const stockBadge = noStock
      ? '<span class="badge badge-red">Out of stock</span>'
      : lowStock
        ? `<span class="badge badge-orange">${stock} left</span>`
        : '';
    // NOTE: use <div role="button"> not <button> — nested buttons are invalid HTML
    //       and browsers eject inner buttons outside the parent card.
    return `
      <div class="product-card${inCart ? ' in-cart' : ''}${noStock ? ' disabled' : ''}"
        data-id="${escapeHtml(item.id)}"
        role="button" tabindex="${noStock ? '-1' : '0'}"
        aria-label="${escapeHtml(item.name)}, ${CURRENCY}${Number(item.price)}"
        aria-disabled="${noStock}">
        <div class="product-card-name">${escapeHtml(item.name)}</div>
        ${stockBadge}
        ${(!item.has_colors && item.color) ? `<div style="margin-bottom:2px;"><span style="display:inline-block;font-size:0.7rem;background:var(--bg-surface);color:var(--text-secondary);border:1px solid var(--border);border-radius:4px;padding:1px 5px;">${escapeHtml(item.color)}</span></div>` : ''}
        <div class="product-card-footer">
          <div>
            <span class="product-card-price">${CURRENCY}${Number(item.price)}</span>
            <span class="product-card-stock">/${escapeHtml(item.unit || 'pc')}</span>
          </div>
          ${((item.has_colors || item.hasSizes) && inCart) ? `
            <span style="font-size:0.75rem;color:var(--primary);font-weight:600;">In cart ✓</span>` :
            inCart ? `
            <div class="card-qty-ctrl" role="group" aria-label="Quantity">
              <button class="card-qty-btn" data-step="dec" data-id="${escapeHtml(item.id)}" aria-label="Decrease">−</button>
              <span class="card-qty-num">${qty}</span>
              <button class="card-qty-btn" data-step="inc" data-id="${escapeHtml(item.id)}" aria-label="Increase">+</button>
            </div>` : `
            <span class="product-card-add">+ Add</span>`}
        </div>
      </div>`;
  }).join('');
}

// ── Render cart item rows ─────────────────────────────────────
function _renderCartRows() {
  const rows     = document.getElementById('cart-rows');
  const emptyEl  = document.getElementById('cart-empty');
  if (!rows) return;

  if (_cart.size === 0) {
    rows.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    _updateMobileCartBar(0, 0);
    _updateTotals();
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  rows.innerHTML = [..._cart.values()].map(item => `
    <div class="cart-item cart-item-enter">
      <div>
        <div class="cart-item-name">${escapeHtml(item.name)}</div>
        ${item.sizeLabel ? `<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">${escapeHtml(item.sizeLabel)}</div>` : ''}
      </div>
      <div class="cart-qty-control">
        <button class="cart-qty-btn" data-cart="dec" data-id="${escapeHtml(item.cartKey || item.id)}" aria-label="Decrease">−</button>
        <span style="min-width:28px;text-align:center;font-size:0.875rem;font-weight:600;font-variant-numeric:tabular-nums;">${item.qty}</span>
        <button class="cart-qty-btn" data-cart="inc" data-id="${escapeHtml(item.cartKey || item.id)}" aria-label="Increase">+</button>
      </div>
      <span style="font-size:0.875rem;font-weight:600;color:var(--primary);font-variant-numeric:tabular-nums;white-space:nowrap;">${CURRENCY}${(item.price * item.qty).toFixed(2)}</span>
      <button class="cart-remove-btn" data-cart="remove" data-id="${escapeHtml(item.cartKey || item.id)}" aria-label="Remove ${escapeHtml(item.name)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');

  const subtotal = [..._cart.values()].reduce((s, i) => s + i.price * i.qty, 0);
  _updateMobileCartBar(_cart.size, subtotal);
  _updateTotals();
}

// ── Mobile cart bar ───────────────────────────────────────────
function _updateMobileCartBar(count, subtotal) {
  const bar     = document.getElementById('mobile-cart-bar');
  const countEl = document.getElementById('mcb-count');
  const totalEl = document.getElementById('mcb-total');
  if (!bar) return;
  if (count === 0) { bar.style.display = 'none'; return; }
  bar.style.display = '';
  if (countEl) countEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;
  if (totalEl) totalEl.textContent = `${CURRENCY}${subtotal.toLocaleString(LOCALE, { minimumFractionDigits: 2 })}`;
}

// ── Update order totals + submit button ───────────────────────
function _updateTotals() {
  const subtotal = [..._cart.values()].reduce((s, i) => s + i.price * i.qty, 0);
  const discRaw  = parseFloat(document.getElementById('discount-val')?.value) || 0;
  const disc     = _discMode === 'pct'
    ? subtotal * Math.min(Math.max(discRaw, 0), 100) / 100
    : Math.min(Math.max(discRaw, 0), subtotal);
  const total    = Math.max(0, subtotal - disc);
  const fmt      = v => `${CURRENCY}${v.toLocaleString(LOCALE, { minimumFractionDigits: 2 })}`;
  const $        = id => document.getElementById(id);

  if ($('subtotal-val')) $('subtotal-val').textContent = fmt(subtotal);
  if ($('total-val'))    $('total-val').textContent    = fmt(total);
  const dl = $('disc-line');
  if (dl) {
    dl.style.display = disc > 0 ? 'flex' : 'none';
    if ($('disc-val')) $('disc-val').textContent = `−${fmt(disc)}`;
  }
}


// ── Color/size variant picker (Phase-27) ─────────────────────
function _showVariantPicker(container, inv) {
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:50;display:flex;align-items:flex-end;';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--bg-primary);border-radius:16px 16px 0 0;padding:24px 16px;width:100%;max-height:80vh;overflow-y:auto;box-sizing:border-box;';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
  const titleEl = document.createElement('h2');
  titleEl.style.cssText = 'font-size:1.05rem;font-weight:700;color:var(--text-primary);margin:0;';
  titleEl.textContent = (inv.has_sizes ? 'Select Color & Size' : 'Select Color') + ' — ' + inv.name;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = 'background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);line-height:1;padding:0;';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  const optionsList = document.createElement('div');

  if (inv.has_sizes) {
    // Group by color, then show sizes under each
    const colorGroups = {};
    inv.variants.forEach(v => {
      if (!colorGroups[v.color]) colorGroups[v.color] = [];
      colorGroups[v.color].push(v);
    });
    Object.entries(colorGroups).forEach(([color, sizeVariants]) => {
      const colorHeader = document.createElement('div');
      colorHeader.style.cssText = 'font-size:0.85rem;font-weight:600;color:var(--text-secondary);margin:10px 0 6px;';
      colorHeader.textContent = color;
      optionsList.appendChild(colorHeader);
      sizeVariants.forEach(v => {
        const outOfStock = v.qty <= 0;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px;border-radius:10px;margin-bottom:6px;border:1.5px solid var(--border);cursor:' + (outOfStock ? 'default' : 'pointer') + ';opacity:' + (outOfStock ? '0.4' : '1') + ';background:var(--bg-surface);';
        const sizeLabel = document.createElement('div');
        sizeLabel.style.cssText = 'font-weight:700;font-size:0.9rem;color:var(--text-primary);';
        sizeLabel.textContent = v.size;
        const stockEl = document.createElement('div');
        stockEl.style.cssText = 'font-size:0.8rem;color:var(--text-secondary);';
        stockEl.textContent = v.qty + ' in stock';
        row.appendChild(sizeLabel);
        row.appendChild(stockEl);
        if (!outOfStock) {
          row.addEventListener('click', () => {
            const cartKey = inv.id + '__' + v.color + '__' + v.size;
            if (_cart.has(cartKey)) {
              _cart.get(cartKey).qty++;
            } else {
              _cart.set(cartKey, { id: inv.id, cartKey, name: inv.name,
                price: Number(inv.price), unit: inv.unit || 'pcs', qty: 1,
                sizeKey: v.color + '/' + v.size, sizeLabel: v.color + ' · ' + v.size });
            }
            _close();
            _refresh(container);
          });
        }
        optionsList.appendChild(row);
      });
    });
  } else {
    // Colors only
    inv.variants.forEach(v => {
      const outOfStock = v.qty <= 0;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 12px;border-radius:10px;margin-bottom:8px;border:1.5px solid var(--border);cursor:' + (outOfStock ? 'default' : 'pointer') + ';opacity:' + (outOfStock ? '0.4' : '1') + ';background:var(--bg-surface);';
      const colorLbl = document.createElement('div');
      colorLbl.style.cssText = 'font-weight:700;font-size:0.95rem;color:var(--text-primary);';
      colorLbl.textContent = v.color;
      const stockEl = document.createElement('div');
      stockEl.style.cssText = 'font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;';
      stockEl.textContent = v.qty + ' in stock';
      row.appendChild(colorLbl);
      row.appendChild(stockEl);
      if (!outOfStock) {
        row.addEventListener('click', () => {
          const cartKey = inv.id + '__' + v.color;
          if (_cart.has(cartKey)) {
            _cart.get(cartKey).qty++;
          } else {
            _cart.set(cartKey, { id: inv.id, cartKey, name: inv.name,
              price: Number(inv.price), unit: inv.unit || 'pcs', qty: 1,
              sizeKey: v.color, sizeLabel: v.color });
          }
          _close();
          _refresh(container);
        });
      }
      optionsList.appendChild(row);
    });
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn btn-secondary btn-full';
  cancelBtn.style.marginTop = '8px';
  cancelBtn.addEventListener('click', _close);
  function _close() { document.body.style.overflow = ''; if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  closeBtn.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
  sheet.appendChild(header);
  sheet.appendChild(optionsList);
  sheet.appendChild(cancelBtn);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}
// ── Size picker sheet for sized inventory items ────────────────────
function _showSizePicker(container, inv) {
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:50;display:flex;align-items:flex-end;';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--bg-primary);border-radius:16px 16px 0 0;padding:24px 16px;width:100%;max-height:80vh;overflow-y:auto;box-sizing:border-box;';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;';
  const titleEl = document.createElement('h2');
  titleEl.style.cssText = 'font-size:1.05rem;font-weight:700;color:var(--text-primary);margin:0;';
  titleEl.textContent = 'Select Size — ' + inv.name;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = 'background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);line-height:1;padding:0;';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  const optionsList = document.createElement('div');
  Object.entries(inv.sizes).forEach(([sizeKey, sizeData]) => {
    const outOfStock = sizeData.stock <= 0;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 12px;border-radius:10px;margin-bottom:8px;border:1.5px solid var(--border);cursor:' + (outOfStock ? 'default' : 'pointer') + ';opacity:' + (outOfStock ? '0.4' : '1') + ';background:var(--bg-surface);';
    const info = document.createElement('div');
    const sizeLabelEl = document.createElement('div');
    sizeLabelEl.style.cssText = 'font-weight:700;font-size:0.95rem;color:var(--text-primary);';
    sizeLabelEl.textContent = sizeData.color ? sizeData.label + ' · ' + sizeData.color : sizeData.label;
    const meta = document.createElement('div');
    meta.style.cssText = 'font-size:0.78rem;color:var(--text-secondary);margin-top:2px;';
    const parts = [];
    if (sizeData.width) parts.push('W: ' + sizeData.width);
    if (sizeData.psi)   parts.push('PSI: ' + sizeData.psi);
    meta.textContent = parts.join(' · ');
    info.appendChild(sizeLabelEl);
    if (parts.length) info.appendChild(meta);
    const stockEl = document.createElement('div');
    stockEl.style.cssText = 'font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;';
    stockEl.textContent = sizeData.stock + ' in stock';
    row.appendChild(info);
    row.appendChild(stockEl);
    if (!outOfStock) {
      row.addEventListener('click', () => {
        const cartKey = inv.id + '::' + sizeKey;
        const sizeLabel = sizeData.color ? sizeData.label + ' · ' + sizeData.color : sizeData.label;
        if (_cart.has(cartKey)) {
          _cart.get(cartKey).qty++;
        } else {
          _cart.set(cartKey, { id: inv.id, cartKey, name: inv.name,
            price: Number(inv.price), unit: 'pcs', qty: 1,
            sizeKey, sizeLabel });
        }
        _close();
        _refresh(container);
      });
    }
    optionsList.appendChild(row);
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn btn-secondary btn-full';
  cancelBtn.style.marginTop = '8px';
  cancelBtn.addEventListener('click', _close);
  function _close() { document.body.style.overflow = ''; if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  closeBtn.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
  sheet.appendChild(header);
  sheet.appendChild(optionsList);
  sheet.appendChild(cancelBtn);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}


// ── Ad-hoc item entry bottom-sheet ───────────────────────────
function _showAdhocItemForm(container) {
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:50;display:flex;align-items:flex-end;';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--bg-primary);border-radius:16px 16px 0 0;padding:24px 16px;width:100%;box-sizing:border-box;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
  const title = document.createElement('h2');
  title.style.cssText = 'font-size:1.05rem;font-weight:700;color:var(--text-primary);margin:0;';
  title.textContent = 'Add Other Item';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = 'background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);line-height:1;padding:0;';
  header.appendChild(title);
  header.appendChild(closeBtn);

  const nameLabel = document.createElement('label');
  nameLabel.style.cssText = 'display:block;font-size:0.85rem;font-weight:500;color:var(--text-secondary);margin-bottom:5px;';
  nameLabel.textContent = 'Item Name';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'e.g. Labour charge';
  nameInput.autocomplete = 'off';
  nameInput.className = 'form-input';
  nameInput.style.marginBottom = '14px';

  const priceLabel = document.createElement('label');
  priceLabel.style.cssText = 'display:block;font-size:0.85rem;font-weight:500;color:var(--text-secondary);margin-bottom:5px;';
  priceLabel.textContent = 'Price';
  const priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.min = '0.01';
  priceInput.step = '0.01';
  priceInput.placeholder = '0.00';
  priceInput.className = 'form-input';
  priceInput.style.marginBottom = '6px';

  const errEl = document.createElement('p');
  errEl.style.cssText = 'font-size:0.8rem;color:var(--danger,#ef4444);margin:4px 0 12px;display:none;';
  errEl.textContent = 'Enter a name and a price greater than 0.';

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add to Cart';
  addBtn.className = 'btn btn-primary btn-full';
  addBtn.style.marginTop = '8px';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn btn-secondary btn-full';
  cancelBtn.style.marginTop = '8px';

  function _close() {
    document.body.style.overflow = '';
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  addBtn.addEventListener('click', () => {
    const name  = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    if (!name || !(price > 0)) {
      errEl.style.display = '';
      return;
    }
    const cartKey = 'adhoc::' + Date.now().toString(36);
    _cart.set(cartKey, {
      id: null, cartKey, name, price, unit: 'pc', qty: 1,
      adhoc: true, sizeKey: null, sizeLabel: null
    });
    _close();
    _refresh(container);
  });
  cancelBtn.addEventListener('click', _close);
  closeBtn.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

  sheet.appendChild(header);
  sheet.appendChild(nameLabel);
  sheet.appendChild(nameInput);
  sheet.appendChild(priceLabel);
  sheet.appendChild(priceInput);
  sheet.appendChild(errEl);
  sheet.appendChild(addBtn);
  sheet.appendChild(cancelBtn);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
  setTimeout(() => nameInput.focus(), 50);
}

// ── Save ad-hoc items to inventory prompt ────────────────────
function _promptSaveAdhocItems(container, items, onDone) {
  if (!items || items.length === 0) { onDone(); return; }

  function _next(idx) {
    if (idx >= items.length) { onDone(); return; }
    const item = items[idx];

    document.body.style.overflow = 'hidden';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:60;display:flex;align-items:flex-end;';
    const sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--bg-primary);border-radius:16px 16px 0 0;padding:24px 16px;width:100%;box-sizing:border-box;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;';
    const titleEl = document.createElement('h2');
    titleEl.style.cssText = 'font-size:1rem;font-weight:700;color:var(--text-primary);margin:0;';
    titleEl.textContent = 'Save to Inventory?';
    const skipXBtn = document.createElement('button');
    skipXBtn.textContent = '×';
    skipXBtn.setAttribute('aria-label', 'Skip');
    skipXBtn.style.cssText = 'background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);line-height:1;padding:0;';
    header.appendChild(titleEl);
    header.appendChild(skipXBtn);

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);margin:0 0 20px;';
    subtitle.textContent = `Add "${item.name}" to inventory for future use?`;

    const priceRow = document.createElement('div');
    priceRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg-surface);border-radius:10px;margin-bottom:14px;border:1px solid var(--border);';
    const priceRowLabel = document.createElement('span');
    priceRowLabel.style.cssText = 'font-size:0.85rem;color:var(--text-secondary);';
    priceRowLabel.textContent = 'Price per unit';
    const priceRowVal = document.createElement('span');
    priceRowVal.style.cssText = 'font-weight:700;color:var(--text-primary);';
    priceRowVal.textContent = `${CURRENCY}${item.price.toFixed(2)}`;
    priceRow.appendChild(priceRowLabel);
    priceRow.appendChild(priceRowVal);

    const stockLabel = document.createElement('label');
    stockLabel.style.cssText = 'display:block;font-size:0.85rem;font-weight:500;color:var(--text-secondary);margin-bottom:5px;';
    stockLabel.textContent = 'Starting stock (optional)';
    const stockInput = document.createElement('input');
    stockInput.type = 'number';
    stockInput.min = '0';
    stockInput.step = '1';
    stockInput.placeholder = '0';
    stockInput.className = 'form-input';
    stockInput.style.marginBottom = '16px';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Yes, Add to Inventory';
    saveBtn.className = 'btn btn-primary btn-full';
    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip';
    skipBtn.className = 'btn btn-secondary btn-full';
    skipBtn.style.marginTop = '8px';

    function _close() {
      document.body.style.overflow = '';
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      const stock = parseInt(stockInput.value, 10) || 0;
      try {
        await addDoc(collection(db, 'shops', SHOP_ID, 'inventory'), {
          name:      item.name,
          price:     item.price,
          unit:      'pc',
          stock,
          threshold: 5,
          unitType:  'other',
          hasSizes:  false
        });
      } catch (e) {
        console.warn('[Billing] save adhoc to inventory failed', e);
      }
      _close();
      _next(idx + 1);
    });

    skipXBtn.addEventListener('click', () => { _close(); _next(idx + 1); });
    skipBtn.addEventListener('click',  () => { _close(); _next(idx + 1); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { _close(); _next(idx + 1); } });

    sheet.appendChild(header);
    sheet.appendChild(subtitle);
    sheet.appendChild(priceRow);
    sheet.appendChild(stockLabel);
    sheet.appendChild(stockInput);
    sheet.appendChild(saveBtn);
    sheet.appendChild(skipBtn);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  _next(0);
}

// ── Subscribe to inventory collection ────────────────────────
function _loadInventory(container) {
  const ref = collection(db, 'shops', SHOP_ID, 'inventory');
  _unsubInv = onSnapshot(ref, snap => {
    _inventory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const q = container.querySelector('#product-search')?.value ?? '';
    _renderGrid(q);
  }, err => console.error('[Billing] inventory snapshot error', err));
}

// ── Sequential Sale ID via Firestore transaction ──────────────
async function _generateSaleId() {
  const counterRef = doc(db, 'shops', SHOP_ID, 'counters', 'sales_counter');
  return runTransaction(db, async tx => {
    const snap = await tx.get(counterRef);
    const next = snap.exists() ? snap.data().last_seq + 1 : 1;
    snap.exists()
      ? tx.update(counterRef, { last_seq: next })
      : tx.set(counterRef,    { last_seq: next });
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${today}-${String(next).padStart(4, '0')}`;
  });
}

// ── Timestamp fallback Sale ID when offline ───────────────────
function _generateOfflineSaleId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${date}-OFF-${Date.now().toString(36).toUpperCase()}`;
}

// ── Validate, generate ID, atomic batch write ─────────────────
async function _handleSubmit(container) {
  const errEl = document.getElementById('submit-err');
  const btn   = document.getElementById('submit-btn');
  if (_cart.size === 0) {
    errEl.textContent = 'Add at least one product to the cart.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"
    style="width:22px;height:22px;margin:0 auto;border-width:2px;"></div>`;

  // Try sequential ID; fall back to offline ID if no network
  let saleId;
  try   { saleId = await _generateSaleId(); }
  catch { saleId = _generateOfflineSaleId(); }

  const cartArr = [..._cart.values()].map(i => ({
    item_id:    i.id,
    name:       i.name,
    price:      i.price,
    unit:       i.unit,
    qty:        i.qty,
    line_total: +(i.price * i.qty).toFixed(2),
    size_key:   i.sizeKey   || null,
    size_label: i.sizeLabel || null,
    adhoc:      i.adhoc     || false
  }));
  const subtotal   = +cartArr.reduce((s, i) => s + i.line_total, 0).toFixed(2);
  const discRaw    = parseFloat(document.getElementById('discount-val')?.value) || 0;
  const discAmount = +(_discMode === 'pct'
    ? subtotal * Math.min(discRaw, 100) / 100
    : Math.min(discRaw, subtotal)).toFixed(2);
  const total      = +(subtotal - discAmount).toFixed(2);
  const _rawPhone  = document.getElementById('customer-phone')?.value.trim() || '';
  const phone      = _rawPhone ? normalizeIndianPhone(_rawPhone) : null;
  if (phone === false) {
    const errEl = document.getElementById('submit-err');
    if (errEl) { errEl.textContent = 'Customer phone must be 10 digits or +91XXXXXXXXXX.'; errEl.style.display = 'block'; }
    return;
  }
  const customerName = document.getElementById('customer-name')?.value.trim() || null;
  const payMode  = _paymentMode;
  const paySplit = payMode === 'split' ? {
    cash: +(parseFloat(document.getElementById('split-cash')?.value) || 0).toFixed(2),
    upi:  +(parseFloat(document.getElementById('split-upi')?.value)  || 0).toFixed(2),
    card: +(parseFloat(document.getElementById('split-card')?.value) || 0).toFixed(2),
  } : null;

  try {
    const batch      = writeBatch(db);
    const saleRef    = doc(db, 'shops', SHOP_ID, 'sales', saleId);
    // 1. Sale document
    batch.set(saleRef, {
      saleId, timestamp: serverTimestamp(),
      items: cartArr, subtotal, discount: discAmount, total,
      customer_name: customerName,
      customer_phone: phone,
      payment_mode:  payMode,
      payment_split: paySplit,
      created_by: auth.currentUser?.email ?? null
    });

    // 2. Inventory stock decrement (per-size or total)
    for (const item of cartArr) {
      if (!item.item_id) continue;   // skip ad-hoc items (no inventory doc)
      const invRef = doc(db, 'shops', SHOP_ID, 'inventory', item.item_id);
      if (item.size_key) {
        batch.update(invRef, { [`sizes.${item.size_key}.stock`]: increment(-item.qty) });
      } else {
        batch.update(invRef, { stock: increment(-item.qty) });
      }
    }

    // 4. Daily summary — date-keyed, no stale counter problem
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const dailyRef = doc(db, 'shops', SHOP_ID, 'daily_summary', today);
    batch.set(dailyRef, {
      date: today,
      count: increment(1),
      revenue: increment(total),
      last_updated: serverTimestamp()
    }, { merge: true });

    // 5. Monthly summary — month-keyed
    const month = today.slice(0, 7); // "YYYY-MM"
    const monthlyRef = doc(db, 'shops', SHOP_ID, 'monthly_summary', month);
    batch.set(monthlyRef, {
      month,
      count: increment(1),
      revenue: increment(total),
      last_updated: serverTimestamp()
    }, { merge: true });

    await batch.commit(); // returns immediately from IndexedDB when offline

    // Upsert customer contact (fire-and-forget, offline-safe)
    if (phone) {
      const phoneKey = phone.replace(/\s+/g, '');
      const custRef  = doc(db, 'shops', SHOP_ID, 'customers', phoneKey);
      setDoc(custRef, {
        name: customerName || '',
        phone,
        lastSaleAt: serverTimestamp()
      }, { merge: true }).catch(e => console.warn('[Billing] customer upsert failed', e));
      // Add to in-memory list immediately so datalist updates in this session
      if (!_customers.find(c => c.phone === phone)) {
        _customers.push({ name: customerName || '', phone });
      } else {
        const existing = _customers.find(c => c.phone === phone);
        if (existing && customerName) existing.name = customerName;
      }
    }

    // Collect unique ad-hoc items by name (deduplicate repeated ad-hoc entries)
    const adhocMap = new Map();
    for (const item of cartArr) {
      if (item.adhoc && !adhocMap.has(item.name)) {
        adhocMap.set(item.name, { name: item.name, price: item.price });
      }
    }
    const adhocItems = [...adhocMap.values()];

    _promptSaveAdhocItems(container, adhocItems, () => {
      _showConfirmation(container, { saleId, total, cartArr, payMode, paySplit });
    });
    toast.success('Sale recorded ✓');

  } catch (err) {
    console.error('[Billing] submit error', err);
    btn.disabled = false;
    btn.textContent = 'Submit Sale';
    errEl.textContent = 'Failed to save sale. Check your connection and try again.';
    errEl.style.display = 'block';
    toast.error('Failed to save sale. Check your connection and try again.');
  }
}

// ── Success screen with live sync badge ───────────────────────
function _showConfirmation(container, { saleId, total, cartArr, payMode, paySplit }) {
  const PAY_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card', split: 'Split' };
  let payBadgeText = PAY_LABELS[payMode] || payMode || '';
  if (payMode === 'split' && paySplit) {
    const parts = [];
    if (paySplit.cash > 0) parts.push(`${CURRENCY}${paySplit.cash.toFixed(2)} Cash`);
    if (paySplit.upi  > 0) parts.push(`${CURRENCY}${paySplit.upi.toFixed(2)} UPI`);
    if (paySplit.card > 0) parts.push(`${CURRENCY}${paySplit.card.toFixed(2)} Card`);
    if (parts.length) payBadgeText = parts.join(' + ');
  }

  _unsubInv?.(); // stop inventory listener — no longer needed
  const fmt = v => `${CURRENCY}${v.toLocaleString(LOCALE, { minimumFractionDigits: 2 })}`;

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;
                padding:48px 16px 32px;text-align:center;gap:20px;
                min-height:70dvh;justify-content:center;">

      <!-- Animated success checkmark -->
      <div style="width:72px;height:72px;background:#f0fdf4;border-radius:50%;
                  display:flex;align-items:center;justify-content:center;
                  animation:scaleIn 0.25s ease-out;box-shadow:0 0 0 8px #dcfce7;">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
             stroke="#22c55e" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>

      <!-- Bill number -->
      <div>
        <p style="font-size:0.7rem;color:var(--text-secondary);
                  text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
          Bill Number
        </p>
        <p style="font-size:1.5rem;font-weight:700;font-family:monospace;
                  letter-spacing:0.06em;color:var(--text-primary);">
          #${escapeHtml(saleId)}
        </p>
      </div>

      <!-- Total collected -->
      <div style="background:linear-gradient(135deg,#eff6ff,#dbeafe);
                  border:1px solid #bfdbfe;border-radius:16px;
                  padding:18px 48px;">
        <p style="font-size:0.7rem;color:#3b82f6;margin-bottom:4px;
                  text-transform:uppercase;letter-spacing:0.08em;">
          Total Collected
        </p>
        <p style="font-size:2.25rem;font-weight:800;color:#1e40af;
                  font-variant-numeric:tabular-nums;line-height:1.1;">
          ${fmt(total)}
        </p>
        <p style="font-size:0.8rem;color:#60a5fa;margin-top:4px;">
          ${cartArr.length} item${cartArr.length !== 1 ? 's' : ''}
        </p>
      </div>

      <!-- Payment mode badge -->
      <div style="font-size:0.8rem;color:var(--text-secondary);background:var(--bg-surface);
                  border:1px solid var(--border);border-radius:8px;padding:5px 14px;">
        Paid via: <strong style="color:var(--text-primary);">${escapeHtml(payBadgeText)}</strong>
      </div>

      <!-- Sync status badge -->
      <span id="sync-badge" class="sync-badge pending"
            style="font-size:0.8rem;padding:5px 14px;">
        ⏳ Syncing to server...
      </span>

      <!-- Action buttons -->
      <div style="display:flex;flex-direction:column;gap:10px;
                  width:100%;max-width:360px;margin-top:8px;">
        <button id="new-sale-after" class="btn btn-primary btn-full"
          style="height:52px;font-size:1rem;font-weight:700;border-radius:12px;
                 box-shadow:0 4px 12px rgba(37,99,235,0.25);">
          + New Sale
        </button>
        <button id="view-receipt"
          style="height:46px;width:100%;border-radius:10px;cursor:pointer;
                 background:transparent;border:1.5px solid var(--border);
                 color:var(--text-secondary);font:inherit;font-size:0.875rem;">
          View Receipt
        </button>
      </div>
    </div>`;

  container.querySelector('#new-sale-after')
    .addEventListener('click', () => render(container));
  container.querySelector('#view-receipt')
    .addEventListener('click', () => {
      window.location.hash = `#/receipt/${encodeURIComponent(saleId)}`;
    });

  // Live sync indicator — auto-unsubscribes after confirming server write
  const saleRef   = doc(db, 'shops', SHOP_ID, 'sales', saleId);
  const unsubSync = onSnapshot(
    saleRef,
    { includeMetadataChanges: true },
    snap => {
      if (!snap.metadata.hasPendingWrites) {
        const badge = document.getElementById('sync-badge');
        if (badge) {
          badge.className   = 'sync-badge synced';
          badge.textContent = '✓ Synced to server';
        }
        unsubSync(); // clean up — no longer needed
      }
    }
  );
}
