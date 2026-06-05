/**
 * modules/reports.js - Sales History & Bill Management
 * Paginated sales list with date-range filter, search, detail panel, and receipt navigation.
 * Exported: render(container, routeParam) - called by app.js on #/reports route.
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
let _invCache = null; // inventory items cache (fetched once per session)

// ── Customers tab state ───────────────────────────────────────────────────────
let _activeTab       = 'sales';   // 'sales' | 'customers'
let _allCustomers    = [];        // { id, name, phone, lastSaleAt } — loaded once
let _custListLoaded  = false;
let _custPhone       = null;      // phone of customer whose bills are shown
let _custBills       = [];        // customer bill QueryDocumentSnapshots
let _custLastDoc     = null;
let _custLoading     = false;
let _custSearchTimer = null;

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _fmt(amount) {
  return CURRENCY + Number(amount || 0).toLocaleString(LOCALE, { minimumFractionDigits: 2 });
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function _switchTab(tab, container) {
  _activeTab = tab;
  container.querySelectorAll('.rpt-tab').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle('rpt-tab--active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  const salesPane = container.querySelector('.reports-list-wrap');
  const salesPagn = container.querySelector('#rpt-pagination');
  const custPane  = container.querySelector('#rpt-customers-pane');
  const filterBar = container.querySelector('.reports-filter-bar');
  const statsBar  = container.querySelector('#rpt-stats-bar');
  if (salesPane)  salesPane.style.display  = tab === 'sales' ? '' : 'none';
  if (salesPagn)  salesPagn.style.display  = tab === 'sales' ? '' : 'none';
  if (custPane)   custPane.style.display   = tab === 'customers' ? '' : 'none';
  if (filterBar)  filterBar.style.display  = tab === 'sales' ? '' : 'none';
  if (statsBar)   statsBar.style.display   = tab === 'sales' ? '' : 'none';
  if (tab === 'customers') _loadAllCustomers(container);
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

  // Stats bar
  const statsEl = document.getElementById('rpt-stats-bar');
  if (statsEl) {
    if (_filtered.length > 0) {
      const totalSum = _filtered.reduce((s, d) => s + (d.data().total || 0), 0);
      statsEl.style.display = 'flex';
      statsEl.innerHTML =
        `<span class="rpt-stat-chip"><strong>${_filtered.length}</strong>&nbsp;sale${_filtered.length !== 1 ? 's' : ''}</span>` +
        `<span class="rpt-stat-chip rpt-stat-total">Total&nbsp;<strong>${_fmt(totalSum)}</strong></span>`;
    } else {
      statsEl.style.display = 'none';
    }
  }

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
  if (overlay) {
    overlay.classList.remove('rpt-panel-open');
    overlay.style.display = 'flex';
    // Trigger slide-in on next paint (double-rAF ensures transition fires)
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('rpt-panel-open')));
  }

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
  if (overlay) {
    overlay.classList.remove('rpt-panel-open');
    // Hide after slide-out completes (250ms); fallback timeout in case transitionend misfires
    const hide = () => { overlay.style.display = 'none'; };
    overlay.addEventListener('transitionend', hide, { once: true });
    setTimeout(hide, 350); // safety fallback
  }
  if (_escKeyHandler) {
    document.removeEventListener('keydown', _escKeyHandler);
    _escKeyHandler = null;
  }
}

// ── Customer section ──────────────────────────────────────────────────────────

async function _loadAllCustomers(container) {
  const resultEl = container.querySelector('#rpt-cust-result');
  if (!resultEl) return;

  if (_custListLoaded) {
    // Already loaded — just re-render with current search value
    const q = container.querySelector('#rpt-cust-phone')?.value.trim() || '';
    _renderCustomerList(_filterCustomers(q), resultEl, container);
    return;
  }

  resultEl.innerHTML = '<div class="rpt-cust-loading"><div class="rpt-spinner"></div> Loading customers...</div>';

  try {
    const snap = await getDocs(collection(db, 'shops', SHOP_ID, 'customers'));
    _allCustomers   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _custListLoaded = true;
    const q = container.querySelector('#rpt-cust-phone')?.value.trim() || '';
    _renderCustomerList(_filterCustomers(q), resultEl, container);
  } catch (err) {
    console.error('Failed to load customers', err);
    resultEl.innerHTML = '<p class="rpt-cust-empty rpt-cust-error">Failed to load customers. Please try again.</p>';
  }
}

function _filterCustomers(q) {
  if (!q) return _allCustomers;
  const lower  = q.toLowerCase();
  const digits = q.replace(/\D/g, '');
  return _allCustomers.filter(c => {
    const nameMatch  = (c.name  || '').toLowerCase().includes(lower);
    const phoneMatch = digits && (c.phone || c.id || '').replace(/\D/g, '').includes(digits);
    return nameMatch || phoneMatch;
  });
}

function _renderCustomerList(customers, resultEl, container) {
  if (customers.length === 0) {
    resultEl.innerHTML = '<p class="rpt-cust-empty">No customers found.</p>';
    return;
  }

  resultEl.innerHTML = customers.map(c => {
    const lastStr = c.lastSaleAt?.toDate
      ? new Date(c.lastSaleAt.toDate()).toLocaleDateString(LOCALE, { dateStyle: 'short' })
      : '';
    return `<div class="rpt-cust-list-row" data-phone="${escapeHtml(c.phone || c.id)}"
                 role="button" tabindex="0">
      <div class="rpt-cust-list-info">
        <span class="rpt-cust-list-name">${escapeHtml(c.name || '—')}</span>
        <span class="rpt-cust-list-phone">${escapeHtml(c.phone || c.id)}</span>
      </div>
      ${lastStr ? `<span class="rpt-cust-list-date">${escapeHtml(lastStr)}</span>` : ''}
    </div>`;
  }).join('');

  // Attach delegated listener once
  resultEl.addEventListener('click', e => {
    const row = e.target.closest('[data-phone]');
    if (row) window.location.hash = '#/reports/customers/' + encodeURIComponent(row.dataset.phone);
  });
  resultEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const row = e.target.closest('[data-phone]');
      if (row) window.location.hash = '#/reports/customers/' + encodeURIComponent(row.dataset.phone);
    }
  });
}

async function _openCustomer(phone, listEl, container) {
  _custPhone  = phone;
  _custBills  = [];
  _custLastDoc = null;
  const cust  = _allCustomers.find(c => (c.phone || c.id) === phone) || { phone };
  const resultEl = container.querySelector('#rpt-cust-result');
  if (!resultEl) return;

  const lastStr = cust.lastSaleAt?.toDate
    ? new Date(cust.lastSaleAt.toDate()).toLocaleDateString(LOCALE, { dateStyle: 'short' })
    : '—';

  resultEl.innerHTML = `
    <button id="rpt-cust-back" class="btn btn-ghost btn-sm" style="margin-bottom:8px;">&#x2190; All customers</button>
    <div class="rpt-cust-card">
      <div class="rpt-cust-card-header">
        <span class="rpt-cust-avatar">&#x1F464;</span>
        <div class="rpt-cust-info">
          <div class="rpt-cust-name">${escapeHtml(cust.name || '—')}</div>
          <div class="rpt-cust-phone-display">${escapeHtml(phone)}</div>
        </div>
      </div>
      <div class="rpt-cust-stats" id="rpt-cust-stats">
        <div class="rpt-cust-stat"><span class="rpt-cust-stat-label">Bills</span><strong id="rpt-cust-stat-count">…</strong></div>
        <div class="rpt-cust-stat"><span class="rpt-cust-stat-label">Total Spend</span><strong id="rpt-cust-stat-total">…</strong></div>
        <div class="rpt-cust-stat"><span class="rpt-cust-stat-label">Last Sale</span><strong>${escapeHtml(lastStr)}</strong></div>
      </div>
    </div>
    <div class="rpt-cust-bills-header">Past Bills</div>
    <div id="rpt-cust-bills-list" class="rpt-cust-bills-list">
      <div class="rpt-cust-loading"><div class="rpt-spinner"></div> Loading...</div>
    </div>
    <div id="rpt-cust-bills-pagination" style="display:none">
      <button id="rpt-cust-load-more" class="btn btn-ghost">Load more</button>
    </div>`;

  resultEl.querySelector('#rpt-cust-back').addEventListener('click', () => {
    _custPhone = null; _custBills = []; _custLastDoc = null;
    window.location.hash = '#/reports/customers';
  });

  await _loadCustomerBills(phone, true, resultEl);
  // If name unknown, pull from first bill's customer_name
  if (!cust.name && _custBills.length > 0) {
    const billName = _custBills[0].data().customer_name;
    if (billName) {
      const nameEl = resultEl.querySelector('.rpt-cust-name');
      if (nameEl) nameEl.textContent = billName;
    }
  }
}

async function _loadCustomerBills(phone, reset, resultEl) {
  if (_custLoading) return;
  _custLoading = true;
  if (reset) { _custBills = []; _custLastDoc = null; }

  const listEl  = resultEl.querySelector('#rpt-cust-bills-list');
  const paginEl = resultEl.querySelector('#rpt-cust-bills-pagination');

  const salesColl   = collection(db, 'shops', SHOP_ID, 'sales');
  // No composite index needed: filter by customer_phone only, sort client-side
  const constraints = [
    where('customer_phone', '==', phone),
    limit(100)
  ];

  try {
    const snap   = await getDocs(query(salesColl, ...constraints));
    const sorted = snap.docs.slice().sort((a, b) => {
      const ta = a.data().timestamp?.seconds ?? 0;
      const tb = b.data().timestamp?.seconds ?? 0;
      return tb - ta;
    });
    _custBills   = reset ? sorted : [..._custBills, ...sorted];
    _custLastDoc = null; // pagination not needed — all loaded at once
    const hasMore = false;

    // Update stats from loaded bills
    const countEl = resultEl.querySelector('#rpt-cust-stat-count');
    const totalEl = resultEl.querySelector('#rpt-cust-stat-total');
    if (countEl || totalEl) {
      const totalSpend = _custBills.reduce((s, d) => s + (d.data().total || 0), 0);
      if (countEl) countEl.textContent = hasMore ? _custBills.length + '+' : String(_custBills.length);
      if (totalEl) totalEl.textContent = _fmt(totalSpend) + (hasMore ? '+' : '');
    }

    const rows = _custBills.map(d => {
      const data    = d.data();
      const dateStr = data.timestamp?.toDate
        ? new Date(data.timestamp.toDate()).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })
        : '—';
      return `<div class="rpt-cust-bill-row" data-doc-id="${escapeHtml(d.id)}"
                   role="button" tabindex="0" aria-label="Bill ${escapeHtml(data.saleId || d.id)}">
        <span class="rpt-cust-bill-date">${escapeHtml(dateStr)}</span>
        <span class="rpt-cust-bill-id">${escapeHtml(data.saleId || d.id)}</span>
        <span class="rpt-cust-bill-total">${escapeHtml(_fmt(data.total))}</span>
      </div>`;
    }).join('');

    if (listEl) {
      listEl.innerHTML = rows || '<p class="rpt-cust-empty">No bills found.</p>';
      if (reset) {
        listEl.addEventListener('click', e => {
          const row = e.target.closest('[data-doc-id]');
          if (row) _openCustBillDetail(row.dataset.docId);
        });
        listEl.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            const row = e.target.closest('[data-doc-id]');
            if (row) _openCustBillDetail(row.dataset.docId);
          }
        });
      }
    }
    if (paginEl) {
      paginEl.style.display = hasMore ? 'block' : 'none';
      if (hasMore) {
        const moreBtn = paginEl.querySelector('#rpt-cust-load-more');
        if (moreBtn) moreBtn.onclick = () => _loadCustomerBills(phone, false, resultEl);
      }
    }
  } catch (err) {
    console.error('Customer bills load failed', err);
    if (listEl) listEl.innerHTML = '<p class="rpt-cust-empty rpt-cust-error">Error loading bills.</p>';
  } finally {
    _custLoading = false;
  }
}

function _openCustBillDetail(docId) {
  const docSnap = _custBills.find(d => d.id === docId);
  if (!docSnap) return;

  const overlay = document.getElementById('rpt-detail-overlay');
  if (overlay) overlay.style.display = 'flex';

  _renderDetailPanel(docSnap.data(), docSnap.id);

  if (_escKeyHandler) document.removeEventListener('keydown', _escKeyHandler);
  _escKeyHandler = (e) => { if (e.key === 'Escape') _closeDetail(); };
  document.addEventListener('keydown', _escKeyHandler);

  _injectEditZone(docSnap.data(), docSnap.id);
}
// ── Detail panel renderer ─────────────────────────────────────────────────────

function _renderDetailPanel(data, docId) {
  const panel = document.getElementById('rpt-detail-panel');
  if (!panel) return;

  const dateStr = data.timestamp?.toDate
    ? new Date(data.timestamp.toDate()).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

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

  const amendedNotice = data.editedAt ? (() => {
    const editedDate = data.editedAt?.toDate
      ? new Date(data.editedAt.toDate()).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    return `<div class="rpt-amendment-notice">
      <span class="rpt-amend-icon">&#x270E;</span>
      Amended by <strong>${escapeHtml(data.editedBy || '—')}</strong> on ${escapeHtml(editedDate)}
      &nbsp;&#xB7;&nbsp; Original total: <strong>${escapeHtml(_fmt(data.originalTotal))}</strong>
    </div>`;
  })() : '';

  const customerSection = (data.customer_name || data.customer_phone) ? (() => {
    const link = data.customer_phone
      ? ` href="#/reports/customers/${encodeURIComponent(data.customer_phone)}" id="rpt-detail-cust-link"`
      : '';
    const tag  = data.customer_phone ? 'a' : 'div';
    return `<${tag} class="rpt-customer-row${data.customer_phone ? ' rpt-customer-row--link' : ''}"${link}>
      <span class="rpt-customer-icon">&#x1F464;</span>
      <span class="rpt-customer-name">${data.customer_name ? escapeHtml(data.customer_name) : ''}</span>
      ${data.customer_phone ? `<span class="rpt-customer-phone">${escapeHtml(data.customer_phone)}</span>` : ''}
      ${data.customer_phone ? `<span class="rpt-customer-hist-hint">&#x2192; history</span>` : ''}
    </${tag}>`;
  })() : '';

  const discountRow = (data.discount && data.discount > 0)
    ? `<tr class="rpt-discount-row"><td colspan="4" class="rpt-cell-right rpt-dim">Discount</td><td class="rpt-cell-right">${escapeHtml(_fmt(data.discount))}</td></tr>`
    : '';

  panel.innerHTML = `
    <div class="rpt-panel-header">
      <div class="rpt-panel-title-wrap">
        <div class="rpt-panel-sale-id">${escapeHtml(data.saleId || docId)}</div>
        <div class="rpt-panel-date">${escapeHtml(dateStr)}</div>
      </div>
      <button class="rpt-close-x" id="rpt-close-x" aria-label="Close">&#x2715;</button>
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
      <button id="rpt-detail-close" class="btn btn-ghost">&#x2190; Back</button>
      <button id="rpt-view-receipt" class="btn btn-primary">&#x1F9FE; View / Resend Receipt</button>
    </div>

    <div id="rpt-edit-zone" class="rpt-edit-zone-wrap"></div>`;

  panel.querySelector('#rpt-close-x').addEventListener('click', _closeDetail);
  panel.querySelector('#rpt-detail-close').addEventListener('click', _closeDetail);
  panel.querySelector('#rpt-view-receipt').addEventListener('click', () => {
    _closeDetail();
    window.location.hash = '#/receipt/' + encodeURIComponent(docId);
  });
}

// ── Inventory fetch + picker ─────────────────────────────────────────────────

async function _fetchInventory() {
  if (_invCache) return _invCache;
  try {
    const snap = await getDocs(collection(db, 'shops', SHOP_ID, 'inventory'));
    _invCache = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return _invCache;
  } catch (e) {
    console.warn('reports: inventory fetch failed', e);
    return [];
  }
}

function _renderPickerList(listEl, items, zone, wrap) {
  if (items.length === 0) {
    listEl.innerHTML = `<div class="rpt-picker-empty">No items found.</div>`;
    return;
  }
  listEl.innerHTML = items.map(item => {
    const priceStr = (item.hasSizes && item.sizes) ? 'Multiple sizes' : _fmt(item.price);
    return `<button type="button" class="rpt-picker-item" data-item-id="${escapeHtml(item.id)}">`
      + `<span class="rpt-picker-name">${escapeHtml(item.name)}</span>`
      + `<span class="rpt-picker-price">${escapeHtml(priceStr)}</span>`
      + `</button>`;
  }).join('');
  listEl.querySelectorAll('.rpt-picker-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = items.find(i => i.id === btn.dataset.itemId);
      if (!item) return;
      if (item.hasSizes && item.sizes && Object.keys(item.sizes).length > 0) {
        _renderSizePicker(listEl, item, zone, wrap, items);
      } else {
        _addEditRow({ name: item.name, price: item.price, qty: 1, unit: item.unit || '',
                     item_id: item.id, adhoc: false });
        _recalcEditTotals();
        wrap.innerHTML = '';
      }
    });
  });
}

function _renderSizePicker(listEl, item, zone, wrap, allItems) {
  listEl.innerHTML =
    `<div class="rpt-picker-size-header">`
    + `<button type="button" class="rpt-picker-back" aria-label="Back to items">&#x2190; Back</button>`
    + `<span class="rpt-picker-size-title">${escapeHtml(item.name)}</span>`
    + `</div>`
    + Object.entries(item.sizes).map(([sizeKey, sd]) =>
        `<button type="button" class="rpt-picker-item rpt-picker-size-row" data-size-key="${escapeHtml(sizeKey)}">`
        + `<span class="rpt-picker-name">${escapeHtml(sd.label || sizeKey)}</span>`
        + `<span class="rpt-picker-price">${escapeHtml(_fmt(sd.price ?? item.price))}</span>`
        + `</button>`
      ).join('');
  listEl.querySelector('.rpt-picker-back')?.addEventListener('click', () =>
    _renderPickerList(listEl, allItems, zone, wrap));
  listEl.querySelectorAll('.rpt-picker-size-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const sd = item.sizes[btn.dataset.sizeKey];
      _addEditRow({ name: item.name, price: sd.price ?? item.price, qty: 1,
                   unit: item.unit || '', item_id: item.id,
                   size_key: btn.dataset.sizeKey, size_label: sd.label || btn.dataset.sizeKey,
                   adhoc: false });
      _recalcEditTotals();
      wrap.innerHTML = '';
    });
  });
}

function _openInvPicker(zone) {
  const wrap = zone.querySelector('#rpt-picker-wrap');
  if (!wrap) return;
  if (wrap.querySelector('.rpt-picker-inner')) { wrap.innerHTML = ''; return; }
  wrap.innerHTML =
    `<div class="rpt-picker-inner">`
    + `<input type="search" id="rpt-picker-q" class="" placeholder="Search inventory..." autocomplete="off" aria-label="Search inventory">`
    + `<div id="rpt-picker-list" class="rpt-picker-list"><div class="rpt-picker-loading">Loading...</div></div>`
    + `</div>`;
  const searchEl = wrap.querySelector('#rpt-picker-q');
  const listEl   = wrap.querySelector('#rpt-picker-list');
  searchEl.focus();
  _fetchInventory().then(items => {
    _renderPickerList(listEl, items, zone, wrap);
    searchEl.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      _renderPickerList(listEl, q ? items.filter(i => i.name.toLowerCase().includes(q)) : items, zone, wrap);
    });
  });
}

// ── Edit bill form ────────────────────────────────────────────────────────────

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
    <td><button class="rpt-rm-row btn-icon" title="Remove" aria-label="Remove row">&#xD7;</button></td>`;
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
      + (discount > 0 ? `<span>Discount <strong class="rpt-discount-val">&#x2212;${escapeHtml(_fmt(discount))}</strong></span>` : '')
      + `<span class="rpt-total-val">Total <strong>${escapeHtml(_fmt(newTotal))}</strong></span>`;
  }
}

async function _saveEdit(originalData, docId, zone) {
  const saveBtn = zone.querySelector('#rpt-save-edit');
  const errorEl = zone.querySelector('#rpt-edit-error');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving...'; }
  if (errorEl) errorEl.style.display = 'none';

  try {
    const rows    = Array.from(document.querySelectorAll('#rpt-edit-tbody tr'));
    const newItems = [];
    for (const tr of rows) {
      const name  = (tr.querySelector('.rpt-edit-name')?.value  ?? '').trim();
      const qty   = parseInt(tr.querySelector('.rpt-edit-qty')?.value,   10);
      const price = parseFloat(tr.querySelector('.rpt-edit-price')?.value);
      if (!name) continue;
      if (qty < 1 || price < 0 || isNaN(qty) || isNaN(price)) {
        throw new Error('Invalid qty or price — must be >= 1 and >= 0 respectively.');
      }
      newItems.push({
        name, qty, price,
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

    const idx = _allDocs.findIndex(d => d.id === docId);
    if (idx !== -1) {
      const updatedData = {
        ...originalData,
        items:         newItems,
        subtotal:      newSubtotal,
        discount:      newDiscount,
        total:         newTotal,
        editedBy:      auth.currentUser?.email ?? '',
        originalTotal: originalTotal,
        amendedTotal:  newTotal,
        editedAt:      { toDate: () => new Date() },
      };
      _allDocs[idx] = { id: docId, data: () => updatedData };
      _applySearch();
      _renderRows();
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

  try {
    const configRef = doc(db, 'shops', SHOP_ID, 'config', 'main');
    const cfgSnap   = await getDoc(configRef);
    const roles     = cfgSnap.exists() ? (cfgSnap.data().staff_roles || {}) : {};
    const isOwner   = roles[auth.currentUser?.email] === 'owner';
    if (!isOwner) return;
  } catch (err) {
    console.warn('reports: role check failed', err);
    return;
  }

  zone.innerHTML = `
    <div class="rpt-edit-section">
      <button id="rpt-edit-btn" class="btn rpt-edit-toggle-btn" aria-expanded="false">
        &#x270E; Edit Bill
      </button>
      <div id="rpt-edit-form" class="rpt-edit-form" style="display:none;">
        <p class="rpt-edit-warning">
          &#x26A0;&#xFE0F; Changes are permanent and logged. Edit only to correct errors.
        </p>
        <table class="rpt-edit-items-table" id="rpt-edit-items">
          <thead><tr>
            <th>Item</th><th>Qty</th><th>Price (${escapeHtml(CURRENCY)})</th><th></th>
          </tr></thead>
          <tbody id="rpt-edit-tbody"></tbody>
        </table>
        <div class="rpt-add-row-actions">
          <button type="button" id="rpt-add-inv" class="btn btn-ghost btn-sm">+ From inventory</button>
          <button type="button" id="rpt-add-custom" class="btn btn-ghost btn-sm">+ Custom item</button>
        </div>
        <div id="rpt-picker-wrap" class="rpt-picker-wrap"></div>
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

  zone.querySelector('#rpt-edit-btn').addEventListener('click', () => {
    const form = zone.querySelector('#rpt-edit-form');
    const btn  = zone.querySelector('#rpt-edit-btn');
    const open = form.style.display === 'none';
    form.style.display = open ? 'block' : 'none';
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('rpt-edit-toggle-btn--open', open);
    if (open) {
      setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  });

  zone.querySelector('#rpt-add-inv').addEventListener('click', () => _openInvPicker(zone));
  zone.querySelector('#rpt-add-custom').addEventListener('click', () => {
    _addEditRow({ name: '', price: 0, qty: 1, unit: '', adhoc: true });
    _recalcEditTotals();
    const wrap = zone.querySelector('#rpt-picker-wrap');
    if (wrap) wrap.innerHTML = '';
  });

  zone.addEventListener('input', e => {
    if (e.target.matches('#rpt-edit-tbody input, #rpt-edit-disc')) _recalcEditTotals();
  });

  zone.querySelector('#rpt-edit-tbody').addEventListener('click', e => {
    if (e.target.closest('.rpt-rm-row')) {
      e.target.closest('tr').remove();
      _recalcEditTotals();
    }
  });

  zone.querySelector('#rpt-cancel-edit').addEventListener('click', () => {
    zone.querySelector('#rpt-edit-form').style.display = 'none';
  });

  zone.querySelector('#rpt-save-edit').addEventListener('click', () =>
    _saveEdit(data, docId, zone));
}

// ── Public render entry point ─────────────────────────────────────────────────

export async function render(container, routeParam = null) {
  // Reset module state on each render
  _allDocs         = [];
  _filtered        = [];
  _lastDoc         = null;
  _loading         = false;
  _fromDate        = null;
  _toDate          = null;
  _fromTime        = null;
  _toTime          = null;
  _activeTab       = 'sales';
  _allCustomers    = [];
  _custListLoaded  = false;
  _custPhone       = null;
  _custBills       = [];
  _custLastDoc     = null;
  _custLoading     = false;
  if (_searchTimer)    { clearTimeout(_searchTimer);    _searchTimer    = null; }
  if (_custSearchTimer){ clearTimeout(_custSearchTimer); _custSearchTimer = null; }
  if (_escKeyHandler)  { document.removeEventListener('keydown', _escKeyHandler); _escKeyHandler = null; }

  container.innerHTML = `
    <div class="reports-screen">
      <!-- Page header -->
      <div class="rpt-page-header">
        <h2 class="rpt-page-title">Reports</h2>
      </div>

      <!-- Tab bar -->
      <div class="rpt-tabs" role="tablist" aria-label="Reports sections">
        <button class="rpt-tab rpt-tab--active" id="rpt-tab-sales"
                role="tab" aria-selected="true" data-tab="sales">Sales</button>
        <button class="rpt-tab" id="rpt-tab-customers"
                role="tab" aria-selected="false" data-tab="customers">Customers</button>
      </div>

      <!-- Filter bar (Sales tab only) -->
      <div class="reports-filter-bar">
        <div class="rpt-filter-group">
          <span class="rpt-filter-label">From</span>
          <div class="rpt-datetime-pair">
            <input type="date" id="rpt-from" class="rpt-date-input" aria-label="From date">
            <input type="time" id="rpt-from-time" class="rpt-time-input" aria-label="From time">
          </div>
        </div>
        <span class="rpt-date-sep">&#x2192;</span>
        <div class="rpt-filter-group">
          <span class="rpt-filter-label">To</span>
          <div class="rpt-datetime-pair">
            <input type="date" id="rpt-to" class="rpt-date-input" aria-label="To date">
            <input type="time" id="rpt-to-time" class="rpt-time-input" aria-label="To time">
          </div>
        </div>
        <div class="rpt-filter-btns">
          <button id="rpt-filter-btn" class="btn btn-primary btn-sm">Filter</button>
          <button id="rpt-clear-btn"  class="btn btn-sm btn-ghost">Clear</button>
        </div>
        <input type="search" id="rpt-search" class="rpt-search-input"
               placeholder="Search by Sale ID, name or phone..." aria-label="Search sales">
      </div>

      <!-- Stats summary (Sales tab only) -->
      <div id="rpt-stats-bar" class="rpt-stats-bar" style="display:none;"></div>

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
          <div class="rpt-spinner"></div> Loading...
        </div>
      </div>
      <div id="rpt-pagination" class="rpt-pagination" style="display:none">
        <button id="rpt-load-more" class="btn btn-ghost">Load more</button>
      </div>

      <!-- Customers pane -->
      <div id="rpt-customers-pane" class="rpt-customers-pane" style="display:none">
        <div class="rpt-cust-search-wrap">
          <input type="tel" id="rpt-cust-phone" class="rpt-cust-phone-input"
                 placeholder="Enter phone number..." autocomplete="tel" inputmode="tel"
                 aria-label="Customer phone number">
        </div>
        <div id="rpt-cust-result"></div>
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

  container.querySelector('#rpt-tbody').addEventListener('click', e => {
    const row = e.target.closest('tr[data-doc-id]');
    if (row) _openDetail(row.dataset.docId);
  });

  container.querySelector('#rpt-detail-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) _closeDetail();
  });

  // Tab bar clicks -> update hash; router re-renders with correct routeParam
  container.querySelectorAll('.rpt-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'sales')     window.location.hash = '#/reports';
      else if (btn.dataset.tab === 'customers') window.location.hash = '#/reports/customers';
    });
  });

  // Customer phone/name input — filter loaded customers client-side
  container.querySelector('#rpt-cust-phone').addEventListener('input', e => {
    if (!_custListLoaded) return; // still loading
    if (_custPhone) return;       // customer detail view open, don't re-render list
    const q = e.target.value.trim();
    const resultEl = container.querySelector('#rpt-cust-result');
    if (resultEl) _renderCustomerList(_filterCustomers(q), resultEl, container);
  });

  // ── Initial load ──────────────────────────────────────────────────────────

  if (routeParam === 'customers') {
    _switchTab('customers', container);
    // load list — _switchTab calls _loadAllCustomers
  } else if (routeParam && routeParam.startsWith('customers/')) {
    const phone = decodeURIComponent(routeParam.slice('customers/'.length));
    _switchTab('customers', container);
    const inp = container.querySelector('#rpt-cust-phone');
    if (inp) { inp.value = phone; }
    // Load all customers then open the specific one
    const resultEl = container.querySelector('#rpt-cust-result');
    if (resultEl) resultEl.innerHTML = '<div class="rpt-cust-loading"><div class="rpt-spinner"></div> Loading...</div>';
    try {
      const snap = await getDocs(collection(db, 'shops', SHOP_ID, 'customers'));
      _allCustomers   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _custListLoaded = true;
      await _openCustomer(phone, resultEl, container);
    } catch (err) {
      console.error('Deep-link customer load failed', err);
      if (resultEl) resultEl.innerHTML = '<p class="rpt-cust-empty rpt-cust-error">Failed to load customer.</p>';
    }
  } else {
    await _loadSales(true);
  }
}
