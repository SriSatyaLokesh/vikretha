/**
 * modules/billing.js — Billing & Sale Recording
 * 2026 seller-optimised UI: product card grid, in-cart stepper,
 * live-total submit, animated confirmation with ⏳/✓ sync badge.
 * Exported: render(container) — called by app.js on #/billing route.
 */
import { db } from '../lib/firebase-init.js';
import { auth } from '../lib/firebase-init.js';
import {
  collection, doc, runTransaction, writeBatch,
  onSnapshot, increment, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, CURRENCY, LOCALE } from '../shop.config.js';

// ── Module State ──────────────────────────────────────────────
let _inventory = [];        // [{ id, name, price, unit, stock }]
let _cart      = new Map(); // item_id → { id, name, price, unit, qty }
let _discMode  = 'pct';     // 'pct' | 'inr'
let _unsubInv  = null;      // inventory onSnapshot unsubscribe

// ── XSS Safety ────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Entry Point ───────────────────────────────────────────────
export function render(container) {
  _unsubInv?.();           // clean up previous listener
  _cart     = new Map();
  _discMode = 'pct';

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
        <div id="product-grid" class="product-grid"></div>
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

          <!-- Customer phone -->
          <div class="form-group" style="margin-top:12px;">
            <label class="form-label">
              Customer Phone <span style="color:var(--text-muted);font-weight:400;">(optional)</span>
            </label>
            <input id="customer-phone" type="tel" autocomplete="tel"
              placeholder="+91 98765 43210" class="form-input">
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
            Submit Sale — <span id="btn-total" style="font-variant-numeric:tabular-nums;">${CURRENCY}0</span>
          </button>
        </div>
      </div>
    </div>`;

  // ── Attach event listeners ────────────────────────────────
  container.querySelector('#product-search')
    .addEventListener('input', e => _renderGrid(e.target.value));

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
      const id = card.dataset.id;
      if (!_cart.has(id)) {
        const inv = _inventory.find(p => p.id === id);
        if (inv) _cart.set(id, { id: inv.id, name: inv.name,
          price: Number(inv.price), unit: inv.unit || 'pc', qty: 1 });
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

  _loadInventory(container);
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

  if (_inventory.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;padding-top:48px;">
        <div style="font-size:2.5rem;margin-bottom:12px;">📦</div>
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
        <div style="font-size:2rem;margin-bottom:12px;">🔍</div>
        <p>No results for &ldquo;${escapeHtml(query)}&rdquo;</p>
      </div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const cartItem = _cart.get(item.id);
    const inCart   = !!cartItem;
    const qty      = cartItem?.qty ?? 0;
    const stock    = Number(item.stock ?? 0);
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
        <div class="product-card-footer">
          <div>
            <span class="product-card-price">${CURRENCY}${Number(item.price)}</span>
            <span class="product-card-stock">/${escapeHtml(item.unit || 'pc')}</span>
          </div>
          ${inCart ? `
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
    <div class="cart-item">
      <div class="cart-item-name">${escapeHtml(item.name)}</div>
      <div class="cart-qty-control">
        <button class="cart-qty-btn" data-cart="dec" data-id="${escapeHtml(item.id)}" aria-label="Decrease">−</button>
        <span style="min-width:28px;text-align:center;font-size:0.875rem;font-weight:600;font-variant-numeric:tabular-nums;">${item.qty}</span>
        <button class="cart-qty-btn" data-cart="inc" data-id="${escapeHtml(item.id)}" aria-label="Increase">+</button>
      </div>
      <span style="font-size:0.875rem;font-weight:600;color:var(--primary);font-variant-numeric:tabular-nums;white-space:nowrap;">${CURRENCY}${(item.price * item.qty).toFixed(2)}</span>
      <button class="cart-remove-btn" data-cart="remove" data-id="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}">
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
  if ($('btn-total'))    $('btn-total').textContent    = fmt(total);
  const dl = $('disc-line');
  if (dl) {
    dl.style.display = disc > 0 ? 'flex' : 'none';
    if ($('disc-val')) $('disc-val').textContent = `−${fmt(disc)}`;
  }
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
    item_id: i.id, name: i.name, price: i.price, unit: i.unit,
    qty: i.qty, line_total: +(i.price * i.qty).toFixed(2)
  }));
  const subtotal   = +cartArr.reduce((s, i) => s + i.line_total, 0).toFixed(2);
  const discRaw    = parseFloat(document.getElementById('discount-val')?.value) || 0;
  const discAmount = +(_discMode === 'pct'
    ? subtotal * Math.min(discRaw, 100) / 100
    : Math.min(discRaw, subtotal)).toFixed(2);
  const total      = +(subtotal - discAmount).toFixed(2);
  const phone      = document.getElementById('customer-phone')?.value.trim() || null;

  try {
    const batch      = writeBatch(db);
    const saleRef    = doc(db, 'shops', SHOP_ID, 'sales', saleId);
    // 1. Sale document
    batch.set(saleRef, {
      saleId, timestamp: serverTimestamp(),
      items: cartArr, subtotal, discount: discAmount, total,
      customer_phone: phone,
      created_by: auth.currentUser?.email ?? null
    });

    // 2. Inventory stock decrement (one update per cart item)
    for (const item of cartArr) {
      batch.update(
        doc(db, 'shops', SHOP_ID, 'inventory', item.item_id),
        { stock: increment(-item.qty) }
      );
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
    _showConfirmation(container, { saleId, total, cartArr });

  } catch (err) {
    console.error('[Billing] submit error', err);
    btn.disabled = false;
    btn.innerHTML = `Submit Sale —
      <span id="btn-total" style="font-variant-numeric:tabular-nums;">${CURRENCY}0</span>`;
    _updateTotals(); // restore total in button
    errEl.textContent = 'Failed to save sale. Check your connection and try again.';
    errEl.style.display = 'block';
  }
}

// ── Success screen with live sync badge ───────────────────────
function _showConfirmation(container, { saleId, total, cartArr }) {
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
          <span style="font-size:0.75rem;color:var(--text-muted);">(coming soon)</span>
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
