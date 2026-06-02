/**
 * modules/export.js — Client-side Excel export for Vikretha
 * Exported: attachExportMenu(container)
 * Requires: SheetJS (lazy-loaded on first export call)
 */

import { db } from '../lib/firebase-init.js';
import {
  collection, getDocs, query, where, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, SHOP_NAME, LOCALE } from '../shop.config.js';

// Cached SheetJS reference after first lazy load
let _XLSX = null;
// Cached outside-click handler (removed on re-attach)
let _outsideClickHandler = null;
// Tracks dropdown currently portaled to <body> (cleaned up on re-render)
let _portaledDropdown = null;

// ── SheetJS Lazy Loader ──────────────────────────────────────────────────────

function _loadSheetJS() {
  if (_XLSX) return Promise.resolve(_XLSX);
  if (window.XLSX) {
    _XLSX = window.XLSX;
    return Promise.resolve(_XLSX);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = () => {
      _XLSX = window.XLSX;
      resolve(_XLSX);
    };
    script.onerror = () => reject(new Error('Failed to load SheetJS. Check network.'));
    document.head.appendChild(script);
  });
}

// ── Progress Overlay ─────────────────────────────────────────────────────────

function _showProgress(container, msg) {
  let overlay = container.querySelector('#export-progress-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'export-progress-overlay';
    overlay.className = 'export-progress-overlay';
    overlay.innerHTML =
      '<div class="export-progress-box">' +
        '<div class="export-progress-spinner"></div>' +
        '<p></p>' +
      '</div>';
    container.appendChild(overlay);
  }
  overlay.querySelector('p').textContent = msg;
  overlay.style.display = 'flex';
}

function _hideProgress(container) {
  const overlay = container.querySelector('#export-progress-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ── Security Helpers ─────────────────────────────────────────────────────────

/**
 * Prevent spreadsheet formula injection by prefixing dangerous leading chars.
 */
function _safeStr(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? ' ' + s : s;
}

// ── Safe shop name for filenames ──────────────────────────────────────────────

function _safeName() {
  return SHOP_NAME.replace(/[^a-zA-Z0-9_]/g, '_');
}

// ── Export Functions ─────────────────────────────────────────────────────────

async function _exportSalesMonth(container, year, month) {
  const btn = container.querySelector('#export-btn');
  if (btn) btn.disabled = true;
  try {
    const XLSX = await _loadSheetJS();
    _showProgress(container, 'Fetching sales\u2026');

    const monthStart = new Date(year, month, 1);
    const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const q = query(
      collection(db, 'shops', SHOP_ID, 'sales'),
      where('timestamp', '>=', Timestamp.fromDate(monthStart)),
      where('timestamp', '<=', Timestamp.fromDate(monthEnd)),
      orderBy('timestamp')
    );
    const snap = await getDocs(q);

    if (snap.size > 1000) {
      _showProgress(container, 'Building Excel file\u2026');
    }

    const rows = [
      ['Sale ID', 'Date', 'Items', 'Qty', 'Subtotal', 'Discount', 'Total', 'Phone']
    ];
    snap.forEach(docSnap => {
      const s = docSnap.data();
      const items    = s.items || [];
      const dateStr  = s.timestamp ? s.timestamp.toDate().toLocaleDateString(LOCALE) : '';
      const itemsText = items.map(i => _safeStr(i.name || i.item_id) + '\xd7' + i.quantity).join('; ');
      const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
      rows.push([
        _safeStr(s.sale_id || docSnap.id),
        dateStr,
        itemsText,
        totalQty,
        s.subtotal  || 0,
        s.discount  || 0,
        s.total     || 0,
        _safeStr(s.customer_phone || '')
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    const paddedMonth = String(month + 1).padStart(2, '0');
    XLSX.writeFile(wb, `${_safeName()}_sales_${year}-${paddedMonth}.xlsx`);
  } catch (err) {
    alert('Export failed: ' + err.message);
  } finally {
    _hideProgress(container);
    if (btn) btn.disabled = false;
  }
}

async function _exportSalesAll(container) {
  const btn = container.querySelector('#export-btn');
  if (btn) btn.disabled = true;
  try {
    const XLSX = await _loadSheetJS();
    _showProgress(container, 'Fetching all sales\u2026');

    const q = query(
      collection(db, 'shops', SHOP_ID, 'sales'),
      orderBy('timestamp')
    );
    const snap = await getDocs(q);

    if (snap.size > 1000) {
      _showProgress(container, 'Building Excel file\u2026');
    }

    const rows = [
      ['Sale ID', 'Date', 'Items', 'Qty', 'Subtotal', 'Discount', 'Total', 'Phone']
    ];
    snap.forEach(docSnap => {
      const s = docSnap.data();
      const items    = s.items || [];
      const dateStr  = s.timestamp ? s.timestamp.toDate().toLocaleDateString(LOCALE) : '';
      const itemsText = items.map(i => _safeStr(i.name || i.item_id) + '\xd7' + i.quantity).join('; ');
      const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
      rows.push([
        _safeStr(s.sale_id || docSnap.id),
        dateStr,
        itemsText,
        totalQty,
        s.subtotal  || 0,
        s.discount  || 0,
        s.total     || 0,
        _safeStr(s.customer_phone || '')
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `${_safeName()}_sales_all.xlsx`);
  } catch (err) {
    alert('Export failed: ' + err.message);
  } finally {
    _hideProgress(container);
    if (btn) btn.disabled = false;
  }
}

async function _exportInventory(container) {
  const btn = container.querySelector('#export-btn');
  if (btn) btn.disabled = true;
  try {
    const XLSX = await _loadSheetJS();
    _showProgress(container, 'Fetching inventory\u2026');

    const snap = await getDocs(collection(db, 'shops', SHOP_ID, 'inventory'));

    const rows = [
      ['ID', 'Name', 'Type', 'Branch', 'Color', 'Unit', 'Price', 'Stock', 'Threshold', 'Status']
    ];
    const dataRows = [];
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const threshold = d.threshold ?? 5;
      const status    = d.stock < threshold ? 'Low Stock' : 'OK';
      dataRows.push([
        _safeStr(docSnap.id),
        _safeStr(d.name   || ''),
        _safeStr(d.type   || ''),
        _safeStr(d.branch || ''),
        _safeStr(d.color  || ''),
        _safeStr(d.unit   || ''),
        d.price  || 0,
        d.stock  || 0,
        threshold,
        status
      ]);
    });
    // Sort alphabetically by Name (index 1)
    dataRows.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
    rows.push(...dataRows);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    const todayDate = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${_safeName()}_inventory_${todayDate}.xlsx`);
  } catch (err) {
    alert('Export failed: ' + err.message);
  } finally {
    _hideProgress(container);
    if (btn) btn.disabled = false;
  }
}

// ── Entry Point ────────────────────────────────────────────────────────────

export function attachExportMenu(container) {
  const anchor = container.querySelector('#dash-export-anchor');
  if (!anchor) return;

  // Clean up stale portaled dropdown from previous render
  if (_portaledDropdown && _portaledDropdown.parentNode) {
    _portaledDropdown.parentNode.removeChild(_portaledDropdown);
    _portaledDropdown = null;
  }

  // Remove stale outside-click handler from a previous render
  if (_outsideClickHandler) {
    document.removeEventListener('click', _outsideClickHandler);
    _outsideClickHandler = null;
  }

  anchor.innerHTML =
    '<div class="export-menu-wrap">' +
      '<button id="export-btn" class="export-btn"' +
        ' aria-haspopup="true" aria-expanded="false">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"' +
            ' stroke="currentColor" stroke-width="2.2"' +
            ' stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
          '<polyline points="7 10 12 15 17 10"/>' +
          '<line x1="12" y1="15" x2="12" y2="3"/>' +
        '</svg>' +
        ' Export' +
      '</button>' +
      '<div id="export-dropdown" class="export-dropdown" role="menu" hidden>' +
        '<button class="export-dropdown-item" data-export="sales-month">Sales (This Month)</button>' +
        '<button class="export-dropdown-item" data-export="sales-all">Sales (All Time)</button>' +
        '<button class="export-dropdown-item" data-export="inventory">Inventory</button>' +
      '</div>' +
    '</div>';

  const menuWrap = anchor.querySelector('.export-menu-wrap');
  const btn      = anchor.querySelector('#export-btn');
  const dropdown = anchor.querySelector('#export-dropdown');

  // ── Portal helpers ─────────────────────────────────────────────────────
  // .app-content has overflow-y:auto which clips position:absolute children.
  // Fix: move dropdown to <body> using position:fixed coords from getBoundingClientRect.

  function _openMenu() {
    const rect = btn.getBoundingClientRect();
    // Ensure dropdown doesn't overflow viewport on the left
    const dropW = 200; // min-width from CSS
    const rightEdge = window.innerWidth - rect.right;
    const leftPos = rect.right - dropW;
    dropdown.style.cssText =
      'position:fixed;' +
      `top:${Math.round(rect.bottom + 6)}px;` +
      (leftPos >= 0
        ? `right:${Math.round(rightEdge)}px;left:auto;`
        : `left:${Math.max(8, Math.round(leftPos))}px;right:auto;`);
    document.body.appendChild(dropdown);
    _portaledDropdown = dropdown;
    dropdown.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  }

  function _closeMenu() {
    dropdown.hidden = true;
    dropdown.style.cssText = '';
    if (dropdown.parentNode !== menuWrap) menuWrap.appendChild(dropdown);
    _portaledDropdown = null;
    btn.setAttribute('aria-expanded', 'false');
  }

  // Toggle dropdown
  btn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.hidden ? _openMenu() : _closeMenu();
  });

  // Outside-click to close (check both anchor and portaled dropdown)
  _outsideClickHandler = e => {
    if (!anchor.contains(e.target) && !dropdown.contains(e.target)) {
      _closeMenu();
    }
  };
  document.addEventListener('click', _outsideClickHandler);

  // Close on scroll (dropdown would be misaligned after scroll)
  const _onScroll = () => { if (!dropdown.hidden) _closeMenu(); };
  window.addEventListener('scroll', _onScroll, { passive: true, capture: true });

  // Dropdown item delegation
  dropdown.addEventListener('click', e => {
    const item = e.target.closest('.export-dropdown-item');
    if (!item) return;
    _closeMenu();

    const type = item.dataset.export;
    if (type === 'sales-month') {
      const picker = container.querySelector('#dash-month-picker');
      let year, month;
      if (picker?.value) {
        [year, month] = picker.value.split('-').map(Number);
      } else {
        const now = new Date();
        year  = now.getFullYear();
        month = now.getMonth();
      }
      _exportSalesMonth(container, year, month);
    } else if (type === 'sales-all') {
      _exportSalesAll(container);
    } else if (type === 'inventory') {
      _exportInventory(container);
    }
  });
}
