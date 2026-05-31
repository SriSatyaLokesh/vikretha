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
    <div id="billing-screen" style="padding-bottom:96px;">

      <!-- ① Sticky pill search bar -->
      <div style="position:sticky;top:0;background:var(--bg-primary);
                  z-index:20;padding:8px 0 12px;">
        <div style="position:relative;">
          <svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);
                      pointer-events:none;" width="18" height="18"
               viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input id="product-search" type="search" autocomplete="off"
            placeholder="Search products..."
            style="width:100%;height:44px;padding:0 14px 0 40px;
                   border:1.5px solid var(--border);border-radius:9999px;
                   font:inherit;font-size:0.95rem;background:var(--bg-surface);
                   color:var(--text-primary);outline:none;transition:border-color 0.15s;"
            onfocus="this.style.borderColor='var(--theme-color)'"
            onblur="this.style.borderColor='var(--border)'">
        </div>
      </div>

      <!-- ② Product grid (2-col) — populated by _renderGrid() -->
      <div id="product-grid"
           style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"></div>

      <!-- ③ Cart panel — hidden until first item added -->
      <div id="cart-panel" style="display:none;margin-top:20px;">

        <h3 style="font-size:0.75rem;font-weight:600;color:var(--text-secondary);
                   text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">
          Cart
        </h3>

        <!-- Cart item rows -->
        <div id="cart-rows" class="card" style="padding:0 12px;"></div>

        <!-- Discount -->
        <div class="card" style="margin-top:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;
                      margin-bottom:10px;">
            <label style="font-size:0.875rem;font-weight:500;
                          color:var(--text-secondary);">Discount</label>
            <div class="seg-toggle">
              <button id="disc-pct" class="active">%</button>
              <button id="disc-inr">₹</button>
            </div>
          </div>
          <input id="discount-val" type="number" min="0" step="0.01" value="0"
            placeholder="0"
            style="width:100%;height:44px;padding:0 12px;
                   border:1.5px solid var(--border);border-radius:8px;
                   font:inherit;font-size:0.95rem;font-variant-numeric:tabular-nums;
                   background:var(--bg-surface);color:var(--text-primary);outline:none;
                   transition:border-color 0.15s;"
            onfocus="this.style.borderColor='var(--theme-color)'"
            onblur="this.style.borderColor='var(--border)'">
        </div>

        <!-- Customer phone (optional) -->
        <div style="margin-top:10px;">
          <label style="display:block;font-size:0.8rem;font-weight:500;
                        color:var(--text-secondary);margin-bottom:6px;">
            Customer Phone
            <span style="color:var(--text-muted);font-weight:400;">(optional)</span>
          </label>
          <input id="customer-phone" type="tel" autocomplete="tel"
            placeholder="+91 98765 43210"
            style="width:100%;height:44px;padding:0 12px;
                   border:1.5px solid var(--border);border-radius:8px;
                   font:inherit;font-size:0.95rem;background:var(--bg-surface);
                   color:var(--text-primary);outline:none;transition:border-color 0.15s;"
            onfocus="this.style.borderColor='var(--theme-color)'"
            onblur="this.style.borderColor='var(--border)'">
        </div>

        <!-- Totals summary -->
        <div class="card" style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;
                      margin-bottom:7px;">
            <span style="font-size:0.875rem;color:var(--text-secondary);">Subtotal</span>
            <span id="subtotal-val"
                  style="font-size:0.875rem;font-variant-numeric:tabular-nums;">
              ${CURRENCY}0
            </span>
          </div>
          <div id="disc-line"
               style="display:none;justify-content:space-between;align-items:center;
                      margin-bottom:7px;">
            <span style="font-size:0.875rem;color:var(--text-secondary);">Discount</span>
            <span id="disc-val"
                  style="font-size:0.875rem;color:var(--success);
                         font-variant-numeric:tabular-nums;">
              −${CURRENCY}0
            </span>
          </div>
          <hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">
          <div style="display:flex;justify-content:space-between;align-items:center;
                      margin-bottom:16px;">
            <span style="font-size:1.05rem;font-weight:700;">Total</span>
            <span id="total-val"
                  style="font-size:1.15rem;font-weight:700;color:var(--theme-color);
                         font-variant-numeric:tabular-nums;">
              ${CURRENCY}0
            </span>
          </div>
          <div id="submit-err"
               style="display:none;color:var(--danger);font-size:0.8rem;
                      margin-bottom:10px;padding:9px 12px;background:#fef2f2;
                      border-radius:8px;"></div>
          <button id="submit-btn" class="btn btn-primary btn-full"
            style="height:56px;font-size:1rem;font-weight:700;border-radius:12px;
                   box-shadow:0 4px 14px rgba(37,99,235,0.3);">
            Submit Sale —
            <span id="btn-total" style="font-variant-numeric:tabular-nums;">
              ${CURRENCY}0
            </span>
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
  container.querySelector('#product-grid').addEventListener('click', e => {
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
    if (card) {
      const id = card.dataset.id;
      if (!_cart.has(id)) {
        const inv = _inventory.find(p => p.id === id);
        if (inv) _cart.set(id, { id: inv.id, name: inv.name,
          price: Number(inv.price), unit: inv.unit || 'pc', qty: 1 });
      }
      _refresh(container);
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
    const chipBg   = noStock ? '#fef2f2' : lowStock ? '#fffbeb' : '#f0fdf4';
    const chipClr  = noStock ? 'var(--danger)' : lowStock ? '#92400e' : '#166534';
    const chipTxt  = noStock ? 'Out of stock' : `${stock} left`;

    return `
      <button class="product-card${inCart ? ' in-cart' : ''}${noStock ? ' disabled' : ''}"
        data-id="${escapeHtml(item.id)}"
        aria-label="${escapeHtml(item.name)}, ${CURRENCY}${Number(item.price)}"
        ${noStock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>

        <!-- Name + stock chip -->
        <div style="display:flex;justify-content:space-between;
                    align-items:flex-start;gap:6px;">
          <span style="font-size:0.875rem;font-weight:600;color:var(--text-primary);
                       line-height:1.35;overflow:hidden;display:-webkit-box;
                       -webkit-line-clamp:2;-webkit-box-orient:vertical;">
            ${escapeHtml(item.name)}
          </span>
          <span style="flex-shrink:0;font-size:0.65rem;padding:2px 7px;
                       border-radius:9999px;font-weight:500;white-space:nowrap;
                       background:${chipBg};color:${chipClr};">
            ${chipTxt}
          </span>
        </div>

        <!-- Price + unit + action -->
        <div style="display:flex;justify-content:space-between;
                    align-items:center;margin-top:8px;">
          <div>
            <span style="font-size:1.05rem;font-weight:700;color:var(--theme-color);
                         font-variant-numeric:tabular-nums;">
              ${CURRENCY}${Number(item.price)}
            </span>
            <span style="font-size:0.7rem;color:var(--text-muted);margin-left:3px;">
              /${escapeHtml(item.unit || 'pc')}
            </span>
          </div>
          ${inCart ? `
            <div class="qty-stepper" onclick="event.stopPropagation()">
              <button data-step="dec" data-id="${escapeHtml(item.id)}"
                      aria-label="Decrease ${escapeHtml(item.name)}">−</button>
              <span>${qty}</span>
              <button data-step="inc" data-id="${escapeHtml(item.id)}"
                      aria-label="Increase ${escapeHtml(item.name)}">+</button>
            </div>` : `
            <span style="font-size:0.75rem;font-weight:600;color:var(--theme-color);
                         background:rgba(37,99,235,0.1);padding:4px 10px;
                         border-radius:9999px;">
              + Add
            </span>`}
        </div>
      </button>`;
  }).join('');
}

// ── Render cart item rows ─────────────────────────────────────
function _renderCartRows() {
  const panel = document.getElementById('cart-panel');
  const rows  = document.getElementById('cart-rows');
  if (!panel || !rows) return;
  if (_cart.size === 0) { panel.style.display = 'none'; _updateTotals(); return; }
  panel.style.display = 'block';

  rows.innerHTML = [..._cart.values()].map(item => `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 0;
                border-bottom:1px solid var(--border);">
      <div style="flex:1;min-width:0;">
        <p style="font-size:0.875rem;font-weight:600;overflow:hidden;
                  white-space:nowrap;text-overflow:ellipsis;">
          ${escapeHtml(item.name)}
        </p>
        <p style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;
                  font-variant-numeric:tabular-nums;">
          ${CURRENCY}${item.price} &times; ${item.qty}
          &nbsp;=&nbsp;
          <strong>${CURRENCY}${(item.price * item.qty).toFixed(2)}</strong>
        </p>
      </div>
      <div class="qty-stepper">
        <button data-cart="dec" data-id="${escapeHtml(item.id)}"
                aria-label="Decrease">−</button>
        <span>${item.qty}</span>
        <button data-cart="inc" data-id="${escapeHtml(item.id)}"
                aria-label="Increase">+</button>
      </div>
      <button data-cart="remove" data-id="${escapeHtml(item.id)}"
        aria-label="Remove ${escapeHtml(item.name)}"
        style="width:34px;height:34px;flex-shrink:0;border-radius:50%;border:none;
               cursor:pointer;background:#fef2f2;color:var(--danger);
               font-size:1rem;font-weight:700;display:flex;align-items:center;
               justify-content:center;">
        &times;
      </button>
    </div>`).join('');

  _updateTotals();
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
    const summaryRef = doc(db, 'shops', SHOP_ID, 'summary', 'totals');

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

    // 3. Summary counters — set+merge handles first-sale doc creation
    batch.set(summaryRef, {
      today_count:  increment(1),   today_revenue:  increment(total),
      week_count:   increment(1),   week_revenue:   increment(total),
      month_count:  increment(1),   month_revenue:  increment(total),
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
