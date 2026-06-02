/**
 * modules/reports.js - Sales History & Bill Management
 * Paginated sales list with date-range filter, search, detail panel, and receipt navigation.
 * Exported: render(container) - called by app.js on #/reports route.
 */

import { db, auth } from '../lib/firebase-init.js';
import {
  collection, doc, query, orderBy, where, limit, startAfter,
  getDocs, getDoc, updateDoc, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, CURRENCY, LOCALE } from '../shop.config.js';

// ── Module state ──────────────────────────────────────────────────────────────
let _allDocs  = [];   // loaded QueryDocumentSnapshots
let _filtered = [];   // after client-side search filter
let _lastDoc  = null; // pagination cursor
let _loading  = false;
let _fromDate = null; // ISO date string 'YYYY-MM-DD' or null
let _toDate   = null;
let _fromTime = null; // 'HH:MM' or null
let _toTime   = null;
let _searchTimer = null;
let _escKeyHandler = null;

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmt(amount) {
  return CURRENCY + Number(amount || 0).toLocaleString(LOCALE, { minimumFractionDigits: 2 });
}

// ── Firestore query helpers ───────────────────────────────────────────────────

function _buildQuery(afterDoc = null) {
  const salesColl = collection(db, 'shops', SHOP_ID, 'sales');
  const constraints = [orderBy('timestamp', 'desc'), limit(25)];

  if (_fromDate) {
    const timeStr = _fromTime || '00:00';
    constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(`${_fromDate}T${timeStr}:00`))));
  }
  if (_toDate) {
    const timeStr = _toTime || '23:59';
    constraints.push(where('timestamp', '<=', Timestamp.fromDate(new Date(`${_toDate}T${timeStr}:59`))));
  }
  if (afterDoc) {
    constraints.push(startAfter(afterDoc));
  }

  return query(salesColl, ...constraints);
}

async function _loadSales(reset = true) {
  if (_loading) return;
  _loading = true;

  if (reset) {
    _allDocs = [];
    _lastDoc = null;
  }

  const loadingEl = document.getElementById('rpt-loading');
  const emptyEl   = document.getElementById('rpt-empty');
  const paginEl   = document.getElementById('rpt-pagination');

  if (loadingEl) loadingEl.style.display = 'block';
  if (emptyEl)   emptyEl.style.display   = 'none';
  if (paginEl)   paginEl.style.display   = 'none';

  try {
    const snap = await getDocs(_buildQuery(reset ? null : _lastDoc));
    _allDocs = reset ? snap.docs : [..._allDocs, ...snap.docs];
    _lastDoc = snap.docs.at(-1) ?? null;

    _applySearch();
    _renderRows();

    if (paginEl) {
      paginEl.style.display = snap.docs.length === 25 ? 'flex' : 'none';
    }
  } catch (err) {
    console.error('reports: load failed', err);
    const tbody = document.getElementById('rpt-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--danger,#e55);padding:20px;">
        Failed to load sales. Please refresh.
      </td></tr>`;
    }
  } finally {
    _loading = false;
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

// ── Search & render ───────────────────────────────────────────────────────────

function _applySearch() {
  const q = (document.getElementById('rpt-search')?.value ?? '').trim().toLowerCase();
  if (!q) {
    _filtered = [..._allDocs];
    return;
  }
  _filtered = _allDocs.filter(docSnap => {
    const data = docSnap.data();
    return (
      data.saleId?.toLowerCase().includes(q) ||
      data.customer_name?.toLowerCase().includes(q) ||
      data.customer_phone?.includes(q)
    );
  });
}

function _renderRows() {
  const tbody  = document.getElementById('rpt-tbody');
  const emptyEl = document.getElementById('rpt-empty');
  if (!tbody) return;

  if (_filtered.length === 0) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = _filtered.map(docSnap => {
    const data = docSnap.data();
    let datePart = '—', timePart = '';
    if (data.timestamp?.toDate) {
      const d = new Date(data.timestamp.toDate());
      datePart = d.toLocaleDateString(LOCALE, { dateStyle: 'short' });
      timePart = d.toLocaleTimeString(LOCALE, { timeStyle: 'short' });
    }
    const customer = data.customer_name ? escapeHtml(data.customer_name) : '<span class="rpt-dim">—</span>';
    const amount   = _fmt(data.total);
    const badge    = data.editedAt ? ' <span class="rpt-amended-badge" title="Amended">✏</span>' : '';

    return `<tr data-doc-id="${escapeHtml(docSnap.id)}">
      <td><span class="rpt-date-primary">${escapeHtml(datePart)}</span><span class="rpt-date-time">${escapeHtml(timePart)}</span></td>
      <td class="rpt-sale-id">${escapeHtml(data.saleId || docSnap.id)}</td>
      <td>${customer}</td>
      <td class="rpt-amount-cell">${escapeHtml(amount)}${badge}</td>
    </tr>`;
  }).join('');
}

// ── Detail panel ──────────────────────────────────────────────────────────────

async function _openDetail(docId) {
  const docSnap = _allDocs.find(d => d.id === docId);
  if (!docSnap) return;

  const overlay = document.getElementById('rpt-detail-overlay');
  if (overlay) overlay.style.display = 'flex';

  _renderDetailPanel(docSnap.data(), docSnap.id);

  // Esc key to close
  if (_escKeyHandler) document.removeEventListener('keydown', _escKeyHandler);
  _escKeyHandler = (e) => { if (e.key === 'Escape') _closeDetail(); };
  document.addEventListener('keydown', _escKeyHandler);

  // Inject edit zone (async, fire-and-forget — role check inside)
  _injectEditZone(docSnap.data(), docSnap.id);
}

function _closeDetail() {
  const overlay = document.getElementById('rpt-detail-overlay');
  if (overlay) overlay.style.display = 'none';
  if (_escKeyHandler) {
    document.removeEventListener('keydown', _escKeyHandler);
    _escKeyHandler = null;
  }
}

function _renderDetailPanel(data, docId) {
  const panel = document.getElementById('rpt-detail-panel');
  if (!panel) return;

  const dateStr = data.timestamp?.toDate
    ? new Date(data.timestamp.toDate()).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  // Items table
  const itemRows = (data.items || []).map(item => {
    const lineTotal = (item.qty || 0) * (item.price || 0);
    return `<tr>
      <td>${escapeHtml(item.name || '')}</td>
      <td class="rpt-cell-center">${escapeHtml(item.size_label || '—')}</td>
      <td class="rpt-cell-center">${escapeHtml(String(item.qty || 0))}</td>
      <td class="rpt-cell-right">${escapeHtml(_fmt(item.price))}</td>
      <td class="rpt-cell-right rpt-cell-bold">${escapeHtml(_fmt(lineTotal))}</td>
    </tr>`;
  }).join('');

  // Amendment notice
  const amendedNotice = data.editedAt ? (() => {
    const editedDate = data.editedAt?.toDate
      ? new Date(data.editedAt.toDate()).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    return `<div class="rpt-amendment-notice">
      <span class="rpt-amend-icon">✎</span>
      Amended by <strong>${escapeHtml(data.editedBy || '—')}</strong> on ${escapeHtml(editedDate)}
      &nbsp;·&nbsp; Original total: <strong>${escapeHtml(_fmt(data.originalTotal))}</strong>
    </div>`;
  })() : '';

  // Customer section
  const customerSection = (data.customer_name || data.customer_phone) ? `
    <div class="rpt-customer-row">
      <span class="rpt-customer-icon">👤</span>
      <span class="rpt-customer-name">${data.customer_name ? escapeHtml(data.customer_name) : ''}</span>
      ${data.customer_phone ? `<span class="rpt-customer-phone">${escapeHtml(data.customer_phone)}</span>` : ''}
    </div>` : '';

  // Discount row
  const discountRow = (data.discount && data.discount > 0)
    ? `<tr class="rpt-discount-row"><td colspan="4" class="rpt-cell-right rpt-dim">Discount</td><td class="rpt-cell-right">${escapeHtml(_fmt(data.discount))}</td></tr>`
    : '';

  panel.innerHTML = `
    <div class="rpt-panel-header">
      <div class="rpt-panel-title-wrap">
        <div class="rpt-panel-sale-id">${escapeHtml(data.saleId || docId)}</div>
        <div class="rpt-panel-date">${escapeHtml(dateStr)}</div>
      </div>
      <button class="rpt-close-x" id="rpt-close-x" aria-label="Close">✕</button>
    </div>

    ${amendedNotice}
    ${customerSection}

    <table class="rpt-items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th class="rpt-cell-center">Size</th>
          <th class="rpt-cell-center">Qty</th>
          <th class="rpt-cell-right">Rate</th>
          <th class="rpt-cell-right">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr class="rpt-subtotal-row">
          <td colspan="4" class="rpt-cell-right rpt-dim">Subtotal</td>
          <td class="rpt-cell-right">${escapeHtml(_fmt(data.subtotal))}</td>
        </tr>
        ${discountRow}
        <tr class="rpt-total-row">
          <td colspan="4" class="rpt-cell-right">Total</td>
          <td class="rpt-cell-right">${escapeHtml(_fmt(data.total))}</td>
        </tr>
      </tfoot>
    </table>

    <div class="rpt-detail-actions">
      <button id="rpt-detail-close" class="btn btn-ghost">← Back</button>
      <button id="rpt-view-receipt" class="btn btn-primary">🧾 View / Resend Receipt</button>
    </div>

    <div id="rpt-edit-zone" class="rpt-edit-zone-wrap"></div>`;

  // Bind close buttons
  panel.querySelector('#rpt-close-x').addEventListener('click', _closeDetail);
  panel.querySelector('#rpt-detail-close').addEventListener('click', _closeDetail);

  // Bind receipt navigation
  panel.querySelector('#rpt-view-receipt').addEventListener('click', () => {
    _closeDetail();
    window.location.hash = '#/receipt/' + encodeURIComponent(docId);
  });
}

// ── Edit bill form (Plan 02) ──────────────────────────────────────────────────

function _addEditRow(item) {
  const tbody = document.getElementById('rpt-edit-tbody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.dataset.unit      = item.unit      || '';
  tr.dataset.sizeLabel = item.size_label || '';
  tr.dataset.sizeKey   = item.size_key   || '';
  tr.dataset.itemId    = item.item_id    || '';
  tr.dataset.adhoc     = item.adhoc      ? 'true' : 'false';
  tr.innerHTML = `
    <td><input type="text"   class="rpt-edit-input rpt-edit-name-input  rpt-edit-name"
               value="${escapeHtml(item.name  || '')}"></td>
    <td><input type="number" class="rpt-edit-input rpt-edit-qty-input   rpt-edit-qty"
               value="${escapeHtml(String(item.qty   ?? 1))}"  min="1"   step="1"></td>
    <td><input type="number" class="rpt-edit-input rpt-edit-price-input rpt-edit-price"
               value="${escapeHtml(String(item.price ?? 0))}" min="0"   step="0.01"></td>
    <td><button class="rpt-rm-row btn-icon" title="Remove" aria-label="Remove row">×</button></td>`;
  tbody.appendChild(tr);
}

function _populateEditRows(items) {
  const tbody = document.getElementById('rpt-edit-tbody');
  if (tbody) tbody.innerHTML = '';
  (items || []).forEach(item => _addEditRow(item));
}

function _recalcEditTotals() {
  const rows = document.querySelectorAll('#rpt-edit-tbody tr');
  let subtotal = 0;
  rows.forEach(tr => {
    const qty   = parseFloat(tr.querySelector('.rpt-edit-qty')?.value)  || 0;
    const price = parseFloat(tr.querySelector('.rpt-edit-price')?.value) || 0;
    subtotal += qty * price;
  });
  const discInput = document.getElementById('rpt-edit-disc');
  let discount = parseFloat(discInput?.value) || 0;
  if (discount > subtotal) discount = subtotal;
  const newTotal = subtotal - discount;

  const totalsEl = document.getElementById('rpt-edit-totals');
  if (totalsEl) {
    totalsEl.innerHTML = `<span>Subtotal <strong>${escapeHtml(_fmt(subtotal))}</strong></span>`
      + (discount > 0 ? `<span>Discount <strong class="rpt-discount-val">−${escapeHtml(_fmt(discount))}</strong></span>` : '')
      + `<span class="rpt-total-val">Total <strong>${escapeHtml(_fmt(newTotal))}</strong></span>`;
  }
}

async function _saveEdit(originalData, docId, zone) {
  const saveBtn = zone.querySelector('#rpt-save-edit');
  const errorEl = zone.querySelector('#rpt-edit-error');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
  if (errorEl) errorEl.style.display = 'none';

  try {
    // Parse rows
    const rows    = Array.from(document.querySelectorAll('#rpt-edit-tbody tr'));
    const newItems = [];
    for (const tr of rows) {
      const name  = (tr.querySelector('.rpt-edit-name')?.value  ?? '').trim();
      const qty   = parseInt(tr.querySelector('.rpt-edit-qty')?.value,   10);
      const price = parseFloat(tr.querySelector('.rpt-edit-price')?.value);
      if (!name) continue; // skip blank-name rows
      if (qty < 1 || price < 0 || isNaN(qty) || isNaN(price)) {
        throw new Error('Invalid qty or price — must be ≥ 1 and ≥ 0 respectively.');
      }
      newItems.push({
        name,
        qty,
        price,
        unit:       tr.dataset.unit      || '',
        size_label: tr.dataset.sizeLabel || '',
        size_key:   tr.dataset.sizeKey   || '',
        item_id:    tr.dataset.itemId    || '',
        adhoc:      tr.dataset.adhoc === 'true',
      });
    }
    if (newItems.length === 0) throw new Error('At least one item is required.');

    const newSubtotal = newItems.reduce((s, i) => s + i.qty * i.price, 0);
    const discInput   = document.getElementById('rpt-edit-disc');
    let   newDiscount = parseFloat(discInput?.value) || 0;
    if (newDiscount > newSubtotal) newDiscount = newSubtotal;
    const newTotal    = newSubtotal - newDiscount;

    // Preserve the very first original total (don't overwrite if already amended)
    const originalTotal = originalData.originalTotal ?? originalData.total;

    const saleRef = doc(db, 'shops', SHOP_ID, 'sales', docId);
    await updateDoc(saleRef, {
      items:         newItems,
      subtotal:      newSubtotal,
      discount:      newDiscount,
      total:         newTotal,
      editedAt:      serverTimestamp(),
      editedBy:      auth.currentUser?.email ?? '',
      originalTotal: originalTotal,
      amendedTotal:  newTotal,
    });

    // Update in-memory doc snapshot data by patching _allDocs
    const idx = _allDocs.findIndex(d => d.id === docId);
    if (idx !== -1) {
      // Rebuild a pseudo-snapshot with updated data
      const updatedData = {
        ...originalData,
        items:         newItems,
        subtotal:      newSubtotal,
        discount:      newDiscount,
        total:         newTotal,
        editedBy:      auth.currentUser?.email ?? '',
        originalTotal: originalTotal,
        amendedTotal:  newTotal,
        // editedAt will be serverTimestamp — use a local Date as preview
        editedAt:      { toDate: () => new Date() },
      };
      // Wrap in a minimal snap-like object
      _allDocs[idx] = { id: docId, data: () => updatedData };

      // Re-render rows so ✏️ badge appears
      _applySearch();
      _renderRows();

      // Re-render detail panel with updated data
      _renderDetailPanel(updatedData, docId);
      _injectEditZone(updatedData, docId);
    }
  } catch (err) {
    console.error('reports: save edit failed', err);
    if (errorEl) {
      errorEl.textContent = err.message || 'Save failed. Please try again.';
      errorEl.style.display = 'block';
    }
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save changes'; }
  }
}

async function _injectEditZone(data, docId) {
  const zone = document.getElementById('rpt-edit-zone');
  if (!zone) return;

  // Role check — only render for owner
  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const cfgSnap   = await getDoc(configRef);
    const roles     = cfgSnap.exists() ? (cfgSnap.data().staff_roles || {}) : {};
    const isOwner   = roles[auth.currentUser?.email] === 'owner';
    if (!isOwner) return; // cashier/admin sees nothing
  } catch (err) {
    console.warn('reports: role check failed', err);
    return;
  }

  zone.innerHTML = `
    <div class="rpt-edit-section">
      <button id="rpt-edit-btn" class="btn rpt-edit-toggle-btn" aria-expanded="false">
        ✎ Edit Bill
      </button>
      <div id="rpt-edit-form" class="rpt-edit-form" style="display:none;">
        <p class="rpt-edit-warning">
          ⚠️ Changes are permanent and logged. Edit only to correct errors.
        </p>
        <table class="rpt-edit-items-table" id="rpt-edit-items">
          <thead><tr>
            <th>Item</th><th>Qty</th><th>Price (${escapeHtml(CURRENCY)})</th><th></th>
          </tr></thead>
          <tbody id="rpt-edit-tbody"></tbody>
        </table>
        <button type="button" id="rpt-add-row" class="btn btn-ghost btn-sm rpt-add-row-btn">
          + Add item
        </button>
        <div class="rpt-edit-discount-row">
          <label for="rpt-edit-disc" class="rpt-edit-label">Discount (${escapeHtml(CURRENCY)})</label>
          <input type="number" id="rpt-edit-disc" min="0" step="0.01"
                 class="rpt-edit-input rpt-disc-input"
                 value="${escapeHtml(String(data.discount ?? 0))}">
        </div>
        <div class="rpt-edit-totals-bar" id="rpt-edit-totals"></div>
        <div class="rpt-edit-footer">
          <button type="button" id="rpt-save-edit" class="btn btn-primary">Save changes</button>
          <button type="button" id="rpt-cancel-edit" class="btn btn-ghost">Cancel</button>
        </div>
        <div id="rpt-edit-error" class="rpt-edit-error" style="display:none;"></div>
      </div>
    </div>`;

  _populateEditRows(data.items || []);
  _recalcEditTotals();

  // Toggle form
  zone.querySelector('#rpt-edit-btn').addEventListener('click', () => {
    const form = zone.querySelector('#rpt-edit-form');
    const btn  = zone.querySelector('#rpt-edit-btn');
    const open = form.style.display === 'none';
    form.style.display = open ? 'block' : 'none';
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('rpt-edit-toggle-btn--open', open);
    // Scroll expanded form into view so user doesn't miss it
    if (open) {
      setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  });

  // Add row
  zone.querySelector('#rpt-add-row').addEventListener('click', () => {
    _addEditRow({ name: '', price: 0, qty: 1, unit: '' });
    _recalcEditTotals();
  });

  // Live recalc
  zone.addEventListener('input', e => {
    if (e.target.matches('#rpt-edit-tbody input, #rpt-edit-disc')) _recalcEditTotals();
  });

  // Remove row (delegated)
  zone.querySelector('#rpt-edit-tbody').addEventListener('click', e => {
    if (e.target.closest('.rpt-rm-row')) {
      e.target.closest('tr').remove();
      _recalcEditTotals();
    }
  });

  // Cancel
  zone.querySelector('#rpt-cancel-edit').addEventListener('click', () => {
    zone.querySelector('#rpt-edit-form').style.display = 'none';
  });

  // Save
  zone.querySelector('#rpt-save-edit').addEventListener('click', () =>
    _saveEdit(data, docId, zone));
}

// ── Public render entry point ─────────────────────────────────────────────────

export async function render(container) {
  // Reset module state on each render
  _allDocs    = [];
  _filtered   = [];
  _lastDoc    = null;
  _loading    = false;
  _fromDate   = null;
  _toDate     = null;
  _fromTime   = null;
  _toTime     = null;
  if (_searchTimer)  { clearTimeout(_searchTimer);  _searchTimer  = null; }
  if (_escKeyHandler){ document.removeEventListener('keydown', _escKeyHandler); _escKeyHandler = null; }

  container.innerHTML = `
    <div class="reports-screen">
      <!-- Filter bar -->
      <div class="reports-filter-bar">
        <div class="rpt-filter-group">
          <span class="rpt-filter-label">From</span>
          <div class="rpt-datetime-pair">
            <input type="date" id="rpt-from" class="rpt-date-input" aria-label="From date">
            <input type="time" id="rpt-from-time" class="rpt-time-input" aria-label="From time">
          </div>
        </div>
        <span class="rpt-date-sep">→</span>
        <div class="rpt-filter-group">
          <span class="rpt-filter-label">To</span>
          <div class="rpt-datetime-pair">
            <input type="date" id="rpt-to" class="rpt-date-input" aria-label="To date">
            <input type="time" id="rpt-to-time" class="rpt-time-input" aria-label="To time">
          </div>
        </div>
        <div class="rpt-filter-btns">
          <button id="rpt-filter-btn" class="btn btn-sm">Filter</button>
          <button id="rpt-clear-btn"  class="btn btn-sm btn-ghost">Clear</button>
        </div>
        <input type="search" id="rpt-search" class="rpt-search-input"
               placeholder="Search by Sale ID, name or phone…" aria-label="Search sales">
      </div>

      <!-- Sales list table -->
      <div class="reports-list-wrap">
        <table class="reports-table" id="rpt-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th><th>Sale ID</th><th>Customer</th>
              <th class="rpt-col-amount">Amount</th>
            </tr>
          </thead>
          <tbody id="rpt-tbody"></tbody>
        </table>
        <div id="rpt-empty"   class="rpt-empty"   style="display:none">No sales found.</div>
        <div id="rpt-loading" class="rpt-loading" style="display:none">
          <div class="rpt-spinner"></div> Loading…
        </div>
      </div>
      <div id="rpt-pagination" class="rpt-pagination" style="display:none">
        <button id="rpt-load-more" class="btn btn-ghost">Load more</button>
      </div>

      <!-- Detail panel (hidden until row clicked) -->
      <div id="rpt-detail-overlay" class="rpt-detail-overlay" style="display:none"
           role="dialog" aria-modal="true">
        <div class="rpt-detail-panel" id="rpt-detail-panel"></div>
      </div>
    </div>`;

  // ── Event bindings ────────────────────────────────────────────────────────

  const rptFrom     = container.querySelector('#rpt-from');
  const rptTo       = container.querySelector('#rpt-to');
  const rptFromTime = container.querySelector('#rpt-from-time');
  const rptToTime   = container.querySelector('#rpt-to-time');

  container.querySelector('#rpt-filter-btn').addEventListener('click', () => {
    _fromDate = rptFrom.value     || null;
    _toDate   = rptTo.value       || null;
    _fromTime = rptFromTime.value || null;
    _toTime   = rptToTime.value   || null;
    _loadSales(true);
  });

  container.querySelector('#rpt-clear-btn').addEventListener('click', () => {
    rptFrom.value     = '';
    rptTo.value       = '';
    rptFromTime.value = '';
    rptToTime.value   = '';
    _fromDate = null; _toDate   = null;
    _fromTime = null; _toTime   = null;
    _loadSales(true);
  });

  container.querySelector('#rpt-search').addEventListener('input', () => {
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      _applySearch();
      _renderRows();
    }, 300);
  });

  container.querySelector('#rpt-load-more')?.addEventListener('click', () => {
    _loadSales(false);
  });

  // Delegated row click
  container.querySelector('#rpt-tbody').addEventListener('click', e => {
    const row = e.target.closest('tr[data-doc-id]');
    if (row) _openDetail(row.dataset.docId);
  });

  // Close overlay on backdrop click
  container.querySelector('#rpt-detail-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) _closeDetail();
  });

  // Initial load
  await _loadSales(true);
}
