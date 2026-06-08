/**
 * modules/inventory.js — Inventory Management
 * Live-updating stock list with low-stock badges, client-side search/sort,
 * and full CRUD via Firestore bottom-sheet modals.
 * Exported: render(container) — called by app.js on #/inventory route.
 */
import { db } from '../lib/firebase-init.js';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { SHOP_ID, CURRENCY } from '../shop.config.js';

// ── Module State ──────────────────────────────────────────────
let _items        = [];
let _sortMode     = 'name';
let _search       = '';
let _unsub        = null;
let _typeFilter   = '';
let _brandFilter = '';

// ── XSS Safety ────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Low-stock check ───────────────────────────────────────────
const isLow = it => {
  if (it.hasSizes && it.sizes) {
    return Object.values(it.sizes).some(s => s.stock < (it.threshold ?? 5));
  }
  return it.stock < (it.threshold ?? 5);
};

// ── Entry Point ───────────────────────────────────────────────
export function render(container) {
  _unsub?.();
  _items        = [];
  _sortMode     = 'name';
  _search       = '';
  _typeFilter   = '';
  _brandFilter = '';

  container.innerHTML = `
    <div id="inv-screen">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <div class="billing-search-wrap" style="flex:1;min-width:200px;margin-bottom:0;">
          <span class="billing-search-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
          <input id="inv-search" type="search" autocomplete="off"
            class="billing-search-input" placeholder="Search items…"
            aria-label="Search inventory items">
        </div>
        <div class="seg-toggle">
          <button id="sort-name" class="active">Name</button>
          <button id="sort-low">Low Stock</button>
        </div>
        <button id="inv-add-fab" class="btn btn-primary btn-sm">+ Add Item</button>
      </div>
      <div id="inv-filter-row" class="billing-filter-row" style="margin-bottom:12px;">
        <select id="inv-type-filter" class="billing-filter-select" aria-label="Filter by type">
          <option value="">All Types</option>
        </select>
        <select id="inv-brand-filter" class="billing-filter-select" aria-label="Filter by brand">
          <option value="">All Brands</option>
        </select>
      </div>
      <div class="inv-table-wrap">
        <table class="inv-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Brand</th>
              <th>Stock</th>
              <th>Price</th>
              <th>Unit</th>
              <th class="cell-actions"></th>
            </tr>
          </thead>
          <tbody id="inv-table-body"></tbody>
        </table>
      </div>
      <div id="inv-mobile-list" class="inv-mobile-list"></div>
    </div>
  `;

  const searchEl = container.querySelector('#inv-search');
  const sortName = container.querySelector('#sort-name');
  const sortLow  = container.querySelector('#sort-low');
  const fab      = container.querySelector('#inv-add-fab');

  searchEl.addEventListener('input', () => { _search = searchEl.value; _renderList(container); });
  sortName.addEventListener('click', () => {
    _sortMode = 'name';
    sortName.classList.add('active');
    sortLow.classList.remove('active');
    _renderList(container);
  });
  sortLow.addEventListener('click', () => {
    _sortMode = 'lowstock';
    sortLow.classList.add('active');
    sortName.classList.remove('active');
    _renderList(container);
  });
  fab.addEventListener('click', () => _showAddModal(container));

  const typeFilterEl   = container.querySelector('#inv-type-filter');
  const brandFilterEl = container.querySelector('#inv-brand-filter');
  typeFilterEl.addEventListener('change', () => { _typeFilter = typeFilterEl.value; _renderList(container); });
  brandFilterEl.addEventListener('change', () => { _brandFilter = brandFilterEl.value; _renderList(container); });

  const attachClick = id => {
    const el = container.querySelector(id);
    if (!el) return;
    el.addEventListener('click', e => {
      const row = e.target.closest('[data-item-id]');
      if (!row) return;
      const item = _items.find(it => it.id === row.dataset.itemId);
      if (item) _showEditModal(container, item);
    });
  };
  attachClick('#inv-table-body');
  attachClick('#inv-mobile-list');

  _unsub = onSnapshot(
    collection(db, 'shops', SHOP_ID, 'inventory'),
    snapshot => {
      _items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      _renderList(container);
    }
  );
}

// ── List Renderer ─────────────────────────────────────────────
function _renderList(container) {
  const tableBody  = container.querySelector('#inv-table-body');
  const mobileList = container.querySelector('#inv-mobile-list');
  if (!tableBody || !mobileList) return;

  const typeEl   = container.querySelector('#inv-type-filter');
  const brandEl = container.querySelector('#inv-brand-filter');
  if (typeEl) {
    const types    = [...new Set(_items.map(it => it.type   || '').filter(Boolean))].sort();
    const curType  = typeEl.value;
    typeEl.innerHTML = '<option value="">All Types</option>' +
      types.map(t => `<option value="${escapeHtml(t)}"${t === curType ? ' selected' : ''}>${escapeHtml(t)}</option>`).join('');
    if (!types.includes(curType)) { typeEl.value = ''; _typeFilter = ''; }
  }
  if (brandEl) {
    const brands  = [...new Set(_items.map(it => it.brand || '').filter(Boolean))].sort();
    const curbrand = brandEl.value;
    brandEl.innerHTML = '<option value="">All Brands</option>' +
      brands.map(b => `<option value="${escapeHtml(b)}"${b === curbrand ? ' selected' : ''}>${escapeHtml(b)}</option>`).join('');
    if (!brands.includes(curbrand)) { brandEl.value = ''; _brandFilter = ''; }
  }

  const q = _search.toLowerCase();
  let list = _items.filter(it => it.name.toLowerCase().includes(q));
  if (_typeFilter)   list = list.filter(it => (it.type   ?? '') === _typeFilter);
  if (_brandFilter) list = list.filter(it => (it.brand ?? '') === _brandFilter);

  if (_sortMode === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    list.sort((a, b) => {
      const aLow = isLow(a) ? 0 : 1;
      const bLow = isLow(b) ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return a.name.localeCompare(b.name);
    });
  }

  const emptyHtml = `<div class="empty-state" style="padding:48px 24px;"><div class="empty-state-icon">📦</div><h3>No inventory items yet</h3><p>Tap <strong>+ Add Item</strong> to get started.</p></div>`;
  const noMatchHtml = `<div class="empty-state" style="padding:32px 24px;"><p>No items match "<strong>${escapeHtml(_search)}</strong>".</p></div>`;

  if (_items.length === 0) { tableBody.innerHTML = `<tr><td colspan="7">${emptyHtml}</td></tr>`; mobileList.innerHTML = emptyHtml; return; }
  if (list.length === 0)   { tableBody.innerHTML = `<tr><td colspan="7">${noMatchHtml}</td></tr>`; mobileList.innerHTML = noMatchHtml; return; }

  const fmtPrice = p => `${CURRENCY}${parseFloat(p ?? 0).toFixed(2)}`;

  tableBody.innerHTML = list.map(item => {
    const low = isLow(item);
    const lowBadge = low ? '<span class="badge badge-red" style="margin-left:6px;">Low</span>' : '';
    let stockDisplay, variantBadge = '';
    if (item.has_colors && item.variants) {
      if (item.has_sizes) {
        const colorSet = new Set(item.variants.map(v => v.color));
        const sizeSet  = new Set(item.variants.map(v => v.size));
        stockDisplay = escapeHtml(String(item.stock ?? 0));
        variantBadge = `<span class="badge badge-blue" style="margin-left:4px;">${colorSet.size} colors × ${sizeSet.size} sizes</span>`;
      } else {
        stockDisplay = escapeHtml(String(item.stock ?? 0));
        variantBadge = `<span class="badge badge-blue" style="margin-left:4px;">${item.variants.length} colors</span>`;
      }
    } else if (item.hasSizes && item.sizes) {
      const n = Object.keys(item.sizes).length;
      const total = Object.values(item.sizes).reduce((s, v) => s + (v.stock ?? 0), 0);
      stockDisplay = escapeHtml(String(total));
      variantBadge = `<span class="badge badge-blue" style="margin-left:4px;">${n} sizes</span>`;
    } else {
      stockDisplay = escapeHtml(String(item.stock ?? 0));
    }
    return `<tr data-item-id="${escapeHtml(item.id)}" style="cursor:pointer;">
      <td class="cell-name">${escapeHtml(item.name)}${lowBadge}</td>
      <td>${escapeHtml(item.type   ?? '')}</td>
      <td>${escapeHtml(item.brand ?? '')}</td>
      <td style="font-variant-numeric:tabular-nums;">${stockDisplay}${variantBadge}</td>
      <td style="font-variant-numeric:tabular-nums;">${fmtPrice(item.price)}</td>
      <td>${escapeHtml(item.unit ?? '')}</td>
      <td class="cell-actions"><button class="btn btn-ghost btn-sm">Edit</button></td>
    </tr>`;
  }).join('');

  mobileList.innerHTML = list.map(item => {
    const low = isLow(item);
    let stockDisplay, variantBadge = '';
    if (item.has_colors && item.variants) {
      if (item.has_sizes) {
        const colorSet = new Set(item.variants.map(v => v.color));
        const sizeSet  = new Set(item.variants.map(v => v.size));
        stockDisplay = `${escapeHtml(String(item.stock ?? 0))} ${escapeHtml(item.unit ?? '')}`;
        variantBadge = `<div style="margin-top:3px;"><span class="badge badge-blue">${colorSet.size} colors × ${sizeSet.size} sizes</span></div>`;
      } else {
        stockDisplay = `${escapeHtml(String(item.stock ?? 0))} ${escapeHtml(item.unit ?? '')}`;
        variantBadge = `<div style="margin-top:3px;"><span class="badge badge-blue">${item.variants.length} colors</span></div>`;
      }
    } else if (item.hasSizes && item.sizes) {
      const n = Object.keys(item.sizes).length;
      const total = Object.values(item.sizes).reduce((s, v) => s + (v.stock ?? 0), 0);
      stockDisplay = `${total} ${escapeHtml(item.unit ?? '')}`;
      variantBadge = `<div style="margin-top:3px;"><span class="badge badge-blue">${n} sizes</span></div>`;
    } else {
      stockDisplay = `${escapeHtml(String(item.stock ?? 0))} ${escapeHtml(item.unit ?? '')}`;
    }
    return `<div class="inv-card" data-item-id="${escapeHtml(item.id)}">
      <div>
        <div class="inv-card-name">${escapeHtml(item.name)}</div>
        ${(!item.has_colors && item.color) ? `<div style="margin-top:2px;"><span class="badge" style="font-size:0.7rem;background:var(--bg-surface);border:1px solid var(--border);color:var(--text-secondary);border-radius:4px;padding:1px 5px;">${escapeHtml(item.color)}</span></div>` : ''}
        ${(item.type || item.brand) ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${[item.type, item.brand].filter(Boolean).map(escapeHtml).join(' · ')}</div>` : ''}
        <div class="inv-card-meta">${fmtPrice(item.price)} / ${escapeHtml(item.unit ?? 'pc')}</div>
      </div>
      <div class="inv-card-right">
        <div class="inv-card-stock">${stockDisplay}</div>
        ${variantBadge}
        ${low ? '<div style="margin-top:3px;"><span class="badge badge-red">Low</span></div>' : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Generic Bottom-Sheet Modal ────────────────────────────────
function _showModal(container, titleText, fields, onSave, onDelete) {
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:50;display:flex;align-items:flex-end;';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--bg-primary);border-radius:16px 16px 0 0;padding:24px 16px;width:100%;max-height:85vh;overflow-y:auto;box-sizing:border-box;';
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
  const title = document.createElement('h2');
  title.style.cssText = 'font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:0;';
  title.textContent = titleText;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = 'background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);line-height:1;padding:0;';
  header.appendChild(title);
  header.appendChild(closeBtn);
  const form = document.createElement('form');
  form.addEventListener('submit', e => e.preventDefault());
  fields.forEach(f => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom:14px;';
    const label = document.createElement('label');
    label.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
    label.textContent = f.label;
    const input = document.createElement('input');
    input.id = f.id;
    input.type = f.type ?? 'text';
    if (f.value !== undefined) input.value = f.value;
    if (f.required) input.required = true;
    if (f.min !== undefined) input.min = f.min;
    if (f.step) input.step = f.step;
    if (f.placeholder) input.placeholder = f.placeholder;
    if (f.readonly) { input.readOnly = true; input.style.cssText = 'opacity:0.6;cursor:not-allowed;'; }
    input.style.cssText += 'width:100%;height:44px;padding:0 12px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.95rem;background:var(--bg-surface);color:var(--text-primary);outline:none;transition:border-color 0.15s;box-sizing:border-box;';
    if (!f.readonly) {
      input.addEventListener('focus', () => { input.style.borderColor = 'var(--theme-color)'; });
      input.addEventListener('blur',  () => { input.style.borderColor = 'var(--border)'; });
    }
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    if (f.readonly && f.hint) {
      const hint = document.createElement('small');
      hint.style.cssText = 'color:var(--text-muted);font-size:0.75rem;';
      hint.textContent = f.hint;
      wrapper.appendChild(hint);
    }
    form.appendChild(wrapper);
  });
  const errEl = document.createElement('p');
  errEl.style.cssText = 'color:var(--danger);font-size:0.85rem;margin:8px 0 0;display:none;';
  form.appendChild(errEl);
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'btn btn-primary btn-full';
  saveBtn.style.marginTop = '16px';
  saveBtn.addEventListener('click', async () => {
    errEl.style.display = 'none';
    const data = {};
    for (const f of fields) {
      const el = form.querySelector(`#${f.id}`);
      data[f.id] = el ? el.value.trim() : '';
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      await onSave(data, errEl);
      _close();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
  form.appendChild(saveBtn);
  if (onDelete) {
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'btn btn-danger btn-full';
    delBtn.style.marginTop = '8px';
    const confirmRow = document.createElement('div');
    confirmRow.style.cssText = 'margin-top:8px;display:none;text-align:center;font-size:0.9rem;';
    confirmRow.innerHTML = `Are you sure? <button id="confirm-del" class="btn btn-danger" style="margin:0 6px;padding:6px 16px;">Yes, delete</button><button id="cancel-del" class="btn btn-secondary" style="padding:6px 16px;">Cancel</button>`;
    delBtn.addEventListener('click', () => { delBtn.style.display = 'none'; confirmRow.style.display = 'block'; });
    confirmRow.querySelector('#cancel-del').addEventListener('click', () => { confirmRow.style.display = 'none'; delBtn.style.display = ''; });
    confirmRow.querySelector('#confirm-del').addEventListener('click', async () => {
      try { await onDelete(); _close(); }
      catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; confirmRow.style.display = 'none'; delBtn.style.display = ''; }
    });
    form.appendChild(delBtn);
    form.appendChild(confirmRow);
  }
  function _close() { document.body.style.overflow = ''; if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  closeBtn.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
  sheet.appendChild(header);
  sheet.appendChild(form);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

// ── Shared input style ────────────────────────────────────────
function _inputStyle(extra) {
  return 'width:100%;height:44px;padding:0 12px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.95rem;background:var(--bg-surface);color:var(--text-primary);outline:none;transition:border-color 0.15s;box-sizing:border-box;' + (extra || '');
}

// ── Sanitise size key (label + optional color for uniqueness) ──
function _sizeKey(label, color) {
  const base = label.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 25);
  if (!color) return base;
  const col  = color.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20);
  return (base + '-' + col).substring(0, 40);
}

// ── Append a size variant row (Phase-13) ──────────────────────
function _appendSizeRow(sizesList, { label = '', color = '', width = '', psi = '', stock = '' } = {}) {
  const row = document.createElement('div');
  row.className = 'size-row';
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:8px;background:var(--bg-surface);border-radius:8px;padding:8px;';
  const mkInput = (cls, placeholder, val, type) => {
    const el = document.createElement('input');
    el.type = type || 'text';
    el.className = cls;
    el.placeholder = placeholder;
    el.value = val || '';
    el.style.cssText = 'width:100%;height:36px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.85rem;background:var(--bg-primary);color:var(--text-primary);outline:none;box-sizing:border-box;';
    el.addEventListener('focus', () => { el.style.borderColor = 'var(--theme-color)'; });
    el.addEventListener('blur',  () => { el.style.borderColor = 'var(--border)'; });
    if (type === 'number') el.min = '0';
    return el;
  };
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.style.cssText = 'background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--danger);align-self:center;padding:0 4px;';
  removeBtn.addEventListener('click', () => row.remove());
  row.appendChild(mkInput('size-label-input', 'Size (e.g. 8, L, 10x12)', label));
  row.appendChild(mkInput('size-color-input', 'Color (e.g. White)', color));
  row.appendChild(mkInput('size-width-input', 'Width (opt)', width));
  row.appendChild(mkInput('size-psi-input',   'PSI (opt)', psi));
  row.appendChild(mkInput('size-stock-input', 'Qty', stock, 'number'));
  row.appendChild(removeBtn);
  sizesList.appendChild(row);
}

// ── Color variant row helper (Phase-27) ──────────────────────
function _appendColorRow(colorRowsList, { color = '', qty = 0, sizes = [] } = {}, showSizes = false) {
  const row = document.createElement('div');
  row.className = 'inv-color-row';

  const colorNameInput = document.createElement('input');
  colorNameInput.type = 'text';
  colorNameInput.className = 'inv-color-name-input';
  colorNameInput.placeholder = 'Color (e.g. Blue, Red)';
  colorNameInput.value = color;
  colorNameInput.style.cssText = 'flex:1;height:38px;padding:0 10px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.9rem;background:var(--bg-surface);color:var(--text-primary);outline:none;box-sizing:border-box;min-width:0;';
  colorNameInput.addEventListener('focus', () => { colorNameInput.style.borderColor = 'var(--theme-color)'; });
  colorNameInput.addEventListener('blur',  () => { colorNameInput.style.borderColor = 'var(--border)'; });

  const colorQtyInput = document.createElement('input');
  colorQtyInput.type = 'number';
  colorQtyInput.min = '0';
  colorQtyInput.className = 'inv-color-qty-input';
  colorQtyInput.placeholder = 'Qty';
  colorQtyInput.value = qty;
  colorQtyInput.style.cssText = 'width:70px;height:38px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.9rem;background:var(--bg-surface);color:var(--text-primary);outline:none;box-sizing:border-box;flex-shrink:0;' + (showSizes ? 'display:none;' : '');
  colorQtyInput.addEventListener('focus', () => { colorQtyInput.style.borderColor = 'var(--theme-color)'; });
  colorQtyInput.addEventListener('blur',  () => { colorQtyInput.style.borderColor = 'var(--border)'; });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.setAttribute('aria-label', 'Remove color');
  removeBtn.style.cssText = 'background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--danger);flex-shrink:0;padding:0 4px;align-self:center;';
  removeBtn.addEventListener('click', () => row.remove());

  const rowHeader = document.createElement('div');
  rowHeader.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:6px;';
  rowHeader.appendChild(colorNameInput);
  rowHeader.appendChild(colorQtyInput);
  rowHeader.appendChild(removeBtn);
  row.appendChild(rowHeader);

  const sizesSub = document.createElement('div');
  sizesSub.className = 'inv-color-sizes-sub';
  sizesSub.style.display = showSizes ? '' : 'none';

  const sizesSubList = document.createElement('div');
  const addSizeSubBtn = document.createElement('button');
  addSizeSubBtn.type = 'button';
  addSizeSubBtn.textContent = '+ Add Size';
  addSizeSubBtn.className = 'btn btn-ghost btn-sm';
  addSizeSubBtn.style.cssText = 'margin-top:4px;font-size:0.78rem;';
  addSizeSubBtn.addEventListener('click', () => _appendSizeSubRow(sizesSubList, {}));
  sizesSub.appendChild(sizesSubList);
  sizesSub.appendChild(addSizeSubBtn);
  row.appendChild(sizesSub);

  if (sizes && sizes.length) sizes.forEach(s => _appendSizeSubRow(sizesSubList, s));
  colorRowsList.appendChild(row);
}

// ── Size sub-row helper (for color+size variants, Phase-27) ──
function _appendSizeSubRow(list, { size = '', qty = 0 } = {}) {
  const row = document.createElement('div');
  row.className = 'inv-size-sub-row';

  const sizeInput = document.createElement('input');
  sizeInput.type = 'text';
  sizeInput.className = 'inv-size-sub-label';
  sizeInput.placeholder = 'Size (e.g. S, M, L, 38)';
  sizeInput.value = size;
  sizeInput.style.cssText = 'flex:1;height:34px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.85rem;background:var(--bg-surface);color:var(--text-primary);outline:none;box-sizing:border-box;min-width:0;';
  sizeInput.addEventListener('focus', () => { sizeInput.style.borderColor = 'var(--theme-color)'; });
  sizeInput.addEventListener('blur',  () => { sizeInput.style.borderColor = 'var(--border)'; });

  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.className = 'inv-size-sub-qty';
  qtyInput.placeholder = 'Qty';
  qtyInput.value = qty;
  qtyInput.style.cssText = 'width:60px;height:34px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.85rem;background:var(--bg-surface);color:var(--text-primary);outline:none;box-sizing:border-box;flex-shrink:0;';
  qtyInput.addEventListener('focus', () => { qtyInput.style.borderColor = 'var(--theme-color)'; });
  qtyInput.addEventListener('blur',  () => { qtyInput.style.borderColor = 'var(--border)'; });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = '×';
  removeBtn.setAttribute('aria-label', 'Remove size');
  removeBtn.style.cssText = 'background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--danger);flex-shrink:0;padding:0 2px;';
  removeBtn.addEventListener('click', () => row.remove());

  row.appendChild(sizeInput);
  row.appendChild(qtyInput);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

// ── Custom piece/sizes modal ──────────────────────────────────
function _showPieceModal(container, titleText, item, onSave, onDelete) {
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:50;display:flex;align-items:flex-end;';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'background:var(--bg-primary);border-radius:16px 16px 0 0;padding:24px 16px;width:100%;max-height:90vh;overflow-y:auto;box-sizing:border-box;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
  const titleEl = document.createElement('h2');
  titleEl.style.cssText = 'font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:0;';
  titleEl.textContent = titleText;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.style.cssText = 'background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);line-height:1;padding:0;';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const form = document.createElement('form');
  form.addEventListener('submit', e => e.preventDefault());

  // 1. Name
  const nameWrap = document.createElement('div');
  nameWrap.style.cssText = 'margin-bottom:14px;';
  const nameLbl = document.createElement('label');
  nameLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  nameLbl.textContent = 'Name';
  const nameInput = document.createElement('input');
  nameInput.id = 'inv-name';
  nameInput.type = 'text';
  if (item) {
    nameInput.value = item.name;
    nameInput.readOnly = true;
    nameInput.style.cssText = _inputStyle('opacity:0.6;cursor:not-allowed;');
    const nameHint = document.createElement('small');
    nameHint.style.cssText = 'color:var(--text-muted);font-size:0.75rem;';
    nameHint.textContent = 'Name is the item identifier — to rename, delete and re-add.';
    nameWrap.appendChild(nameLbl);
    nameWrap.appendChild(nameInput);
    nameWrap.appendChild(nameHint);
  } else {
    nameInput.required = true;
    nameInput.placeholder = 'Item name';
    nameInput.style.cssText = _inputStyle();
    nameInput.addEventListener('focus', () => { nameInput.style.borderColor = 'var(--theme-color)'; });
    nameInput.addEventListener('blur',  () => { nameInput.style.borderColor = 'var(--border)'; });
    nameWrap.appendChild(nameLbl);
    nameWrap.appendChild(nameInput);
  }
  form.appendChild(nameWrap);

  // 2. Brand (directly below Name)
  const brandWrap = document.createElement('div');
  brandWrap.style.cssText = 'margin-bottom:14px;';
  const brandLbl = document.createElement('label');
  brandLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  brandLbl.textContent = 'Brand';
  const brandInput = document.createElement('input');
  brandInput.id = 'inv-brand';
  brandInput.type = 'text';
  brandInput.placeholder = 'e.g. Nike, Samsung, Local';
  brandInput.style.cssText = _inputStyle();
  if (item) brandInput.value = item.brand ?? '';
  brandInput.addEventListener('focus', () => { brandInput.style.borderColor = 'var(--theme-color)'; });
  brandInput.addEventListener('blur',  () => { brandInput.style.borderColor = 'var(--border)'; });
  const brandListId = 'inv-brand-list-' + Date.now();
  const brandDatalist = document.createElement('datalist');
  brandDatalist.id = brandListId;
  brandInput.setAttribute('list', brandListId);
  [...new Set(_items.map(it => it.brand || '').filter(Boolean))].sort()
    .forEach(v => { const opt = document.createElement('option'); opt.value = v; brandDatalist.appendChild(opt); });
  brandWrap.appendChild(brandLbl);
  brandWrap.appendChild(brandInput);
  brandWrap.appendChild(brandDatalist);
  form.appendChild(brandWrap);

  // 3. Unit type toggle
  const unitTypeLbl = document.createElement('label');
  unitTypeLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  unitTypeLbl.textContent = 'Unit';
  const toggleWrap = document.createElement('div');
  toggleWrap.style.cssText = 'margin-bottom:14px;';
  toggleWrap.appendChild(unitTypeLbl);
  const segToggle = document.createElement('div');
  segToggle.className = 'seg-toggle';
  const btnPieces = document.createElement('button');
  btnPieces.type = 'button';
  btnPieces.textContent = 'Pieces';
  const btnOther = document.createElement('button');
  btnOther.type = 'button';
  btnOther.textContent = 'Other';
  segToggle.appendChild(btnPieces);
  segToggle.appendChild(btnOther);
  toggleWrap.appendChild(segToggle);
  const customUnitInput = document.createElement('input');
  customUnitInput.id = 'inv-unit-custom';
  customUnitInput.type = 'text';
  customUnitInput.placeholder = 'e.g. kg / ltr / CG';
  customUnitInput.style.cssText = _inputStyle('margin-top:8px;');
  customUnitInput.addEventListener('focus', () => { customUnitInput.style.borderColor = 'var(--theme-color)'; });
  customUnitInput.addEventListener('blur',  () => { customUnitInput.style.borderColor = 'var(--border)'; });
  toggleWrap.appendChild(customUnitInput);
  form.appendChild(toggleWrap);

  // 4. Has Colors
  const hasColorsWrap = document.createElement('div');
  hasColorsWrap.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:10px;';
  const hasColorsCb = document.createElement('input');
  hasColorsCb.id = 'inv-has-colors';
  hasColorsCb.type = 'checkbox';
  hasColorsCb.style.cssText = 'width:18px;height:18px;cursor:pointer;';
  const hasColorsLbl = document.createElement('label');
  hasColorsLbl.htmlFor = 'inv-has-colors';
  hasColorsLbl.textContent = 'Has Colors';
  hasColorsLbl.style.cssText = 'font-size:0.9rem;font-weight:500;color:var(--text-primary);cursor:pointer;';
  hasColorsWrap.appendChild(hasColorsCb);
  hasColorsWrap.appendChild(hasColorsLbl);
  form.appendChild(hasColorsWrap);

  // 5. Has Sizes (only active when Has Colors on)
  const hasSizesVariantWrap = document.createElement('div');
  hasSizesVariantWrap.style.cssText = 'margin-bottom:10px;display:flex;align-items:center;gap:10px;padding-left:28px;';
  const hasSizesVariantCb = document.createElement('input');
  hasSizesVariantCb.id = 'inv-has-colors-sizes';
  hasSizesVariantCb.type = 'checkbox';
  hasSizesVariantCb.disabled = true;
  hasSizesVariantCb.style.cssText = 'width:18px;height:18px;cursor:pointer;';
  const hasSizesVariantLbl = document.createElement('label');
  hasSizesVariantLbl.htmlFor = 'inv-has-colors-sizes';
  hasSizesVariantLbl.textContent = 'Has Sizes';
  hasSizesVariantLbl.style.cssText = 'font-size:0.9rem;font-weight:500;color:var(--text-muted);cursor:pointer;';
  hasSizesVariantWrap.appendChild(hasSizesVariantCb);
  hasSizesVariantWrap.appendChild(hasSizesVariantLbl);
  form.appendChild(hasSizesVariantWrap);

  // 6. Color variant section
  const colorVariantSection = document.createElement('div');
  colorVariantSection.style.cssText = 'margin-bottom:14px;display:none;';
  const colorVariantLbl = document.createElement('div');
  colorVariantLbl.style.cssText = 'font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:8px;';
  colorVariantLbl.textContent = 'Color Variants';
  const colorRowsList = document.createElement('div');
  colorRowsList.id = 'inv-color-rows';
  const addColorBtn = document.createElement('button');
  addColorBtn.type = 'button';
  addColorBtn.textContent = '+ Add Color';
  addColorBtn.className = 'btn btn-secondary btn-sm';
  addColorBtn.style.cssText = 'margin-top:8px;';
  addColorBtn.addEventListener('click', () => _appendColorRow(colorRowsList, {}, hasSizesVariantCb.checked));
  colorVariantSection.appendChild(colorVariantLbl);
  colorVariantSection.appendChild(colorRowsList);
  colorVariantSection.appendChild(addColorBtn);
  form.appendChild(colorVariantSection);

  // 7. Has sizes? (Phase-13)
  const hasSizesWrap = document.createElement('div');
  hasSizesWrap.style.cssText = 'margin-bottom:14px;display:flex;align-items:center;gap:10px;';
  const hasSizesCb = document.createElement('input');
  hasSizesCb.id = 'inv-has-sizes';
  hasSizesCb.type = 'checkbox';
  hasSizesCb.style.cssText = 'width:18px;height:18px;cursor:pointer;';
  const hasSizesLbl = document.createElement('label');
  hasSizesLbl.htmlFor = 'inv-has-sizes';
  hasSizesLbl.style.cssText = 'font-size:0.9rem;font-weight:500;color:var(--text-primary);cursor:pointer;';
  hasSizesLbl.textContent = 'Has sizes?';
  hasSizesWrap.appendChild(hasSizesCb);
  hasSizesWrap.appendChild(hasSizesLbl);
  form.appendChild(hasSizesWrap);

  // 8. Qty
  const qtyWrap = document.createElement('div');
  qtyWrap.style.cssText = 'margin-bottom:14px;';
  const qtyLbl = document.createElement('label');
  qtyLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  qtyLbl.textContent = 'Quantity (stock)';
  const qtyInput = document.createElement('input');
  qtyInput.id = 'inv-qty';
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.style.cssText = _inputStyle();
  qtyInput.addEventListener('focus', () => { qtyInput.style.borderColor = 'var(--theme-color)'; });
  qtyInput.addEventListener('blur',  () => { qtyInput.style.borderColor = 'var(--border)'; });
  qtyWrap.appendChild(qtyLbl);
  qtyWrap.appendChild(qtyInput);
  form.appendChild(qtyWrap);

  // 9. Phase-13 Sizes section
  const sizesSection = document.createElement('div');
  sizesSection.style.cssText = 'margin-bottom:14px;display:none;';
  const sizesLbl = document.createElement('label');
  sizesLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:8px;';
  sizesLbl.textContent = 'Size Variants';
  const sizesList = document.createElement('div');
  const addSizeBtn = document.createElement('button');
  addSizeBtn.type = 'button';
  addSizeBtn.textContent = '+ Add size';
  addSizeBtn.className = 'btn btn-secondary btn-sm';
  addSizeBtn.style.cssText = 'margin-top:8px;';
  addSizeBtn.addEventListener('click', () => _appendSizeRow(sizesList, {}));
  sizesSection.appendChild(sizesLbl);
  sizesSection.appendChild(sizesList);
  sizesSection.appendChild(addSizeBtn);
  form.appendChild(sizesSection);

  // 10. Price
  const priceWrap = document.createElement('div');
  priceWrap.style.cssText = 'margin-bottom:14px;';
  const priceLbl = document.createElement('label');
  priceLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  priceLbl.textContent = 'Price';
  const priceInput = document.createElement('input');
  priceInput.id = 'inv-price';
  priceInput.type = 'number';
  priceInput.min = '0.01';
  priceInput.step = '0.01';
  priceInput.style.cssText = _inputStyle();
  priceInput.addEventListener('focus', () => { priceInput.style.borderColor = 'var(--theme-color)'; });
  priceInput.addEventListener('blur',  () => { priceInput.style.borderColor = 'var(--border)'; });
  priceWrap.appendChild(priceLbl);
  priceWrap.appendChild(priceInput);
  form.appendChild(priceWrap);

  // 11. Threshold
  const threshWrap = document.createElement('div');
  threshWrap.style.cssText = 'margin-bottom:14px;';
  const threshLbl = document.createElement('label');
  threshLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  threshLbl.textContent = 'Low-stock threshold';
  const threshInput = document.createElement('input');
  threshInput.id = 'inv-threshold';
  threshInput.type = 'number';
  threshInput.min = '0';
  threshInput.style.cssText = _inputStyle();
  threshInput.addEventListener('focus', () => { threshInput.style.borderColor = 'var(--theme-color)'; });
  threshInput.addEventListener('blur',  () => { threshInput.style.borderColor = 'var(--border)'; });
  threshWrap.appendChild(threshLbl);
  threshWrap.appendChild(threshInput);
  form.appendChild(threshWrap);

  // 12. Type (with datalist)
  const typeWrap = document.createElement('div');
  typeWrap.style.cssText = 'margin-bottom:14px;';
  const typeLbl = document.createElement('label');
  typeLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  typeLbl.textContent = 'Type';
  const typeInput = document.createElement('input');
  typeInput.id = 'inv-type';
  typeInput.type = 'text';
  typeInput.placeholder = 'e.g. Doors, Windows, Hardware';
  typeInput.style.cssText = _inputStyle();
  if (item) typeInput.value = item.type ?? '';
  typeInput.addEventListener('focus', () => { typeInput.style.borderColor = 'var(--theme-color)'; });
  typeInput.addEventListener('blur',  () => { typeInput.style.borderColor = 'var(--border)'; });
  const typeListId = 'inv-type-list-' + Date.now();
  const typeDatalist = document.createElement('datalist');
  typeDatalist.id = typeListId;
  typeInput.setAttribute('list', typeListId);
  [...new Set(_items.map(it => it.type || '').filter(Boolean))].sort()
    .forEach(v => { const opt = document.createElement('option'); opt.value = v; typeDatalist.appendChild(opt); });
  typeWrap.appendChild(typeLbl);
  typeWrap.appendChild(typeInput);
  typeWrap.appendChild(typeDatalist);
  form.appendChild(typeWrap);

  // 13. Flat Color (hidden when Has Colors checked)
  const colorWrap = document.createElement('div');
  colorWrap.style.cssText = 'margin-bottom:14px;';
  const colorLbl = document.createElement('label');
  colorLbl.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
  colorLbl.textContent = 'Color';
  const colorInput = document.createElement('input');
  colorInput.id = 'inv-color';
  colorInput.type = 'text';
  colorInput.placeholder = 'e.g. White, Grey';
  colorInput.style.cssText = _inputStyle();
  if (item) colorInput.value = item.color ?? '';
  colorInput.addEventListener('focus', () => { colorInput.style.borderColor = 'var(--theme-color)'; });
  colorInput.addEventListener('blur',  () => { colorInput.style.borderColor = 'var(--border)'; });
  colorWrap.appendChild(colorLbl);
  colorWrap.appendChild(colorInput);
  form.appendChild(colorWrap);

  const errEl = document.createElement('p');
  errEl.style.cssText = 'color:var(--danger);font-size:0.85rem;margin:8px 0 0;display:none;';
  form.appendChild(errEl);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';
  saveBtn.className = 'btn btn-primary btn-full';
  saveBtn.style.marginTop = '16px';
  form.appendChild(saveBtn);

  if (onDelete) {
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.className = 'btn btn-danger btn-full';
    delBtn.style.marginTop = '8px';
    const confirmRow = document.createElement('div');
    confirmRow.style.cssText = 'margin-top:8px;display:none;text-align:center;font-size:0.9rem;';
    confirmRow.innerHTML = 'Are you sure? <button id="confirm-del" class="btn btn-danger" style="margin:0 6px;padding:6px 16px;">Yes, delete</button><button id="cancel-del" class="btn btn-secondary" style="padding:6px 16px;">Cancel</button>';
    delBtn.addEventListener('click', () => { delBtn.style.display = 'none'; confirmRow.style.display = 'block'; });
    confirmRow.querySelector('#cancel-del').addEventListener('click', () => { confirmRow.style.display = 'none'; delBtn.style.display = ''; });
    confirmRow.querySelector('#confirm-del').addEventListener('click', async () => {
      try { await onDelete(); _close(); }
      catch (err) { errEl.textContent = err.message; errEl.style.display = 'block'; confirmRow.style.display = 'none'; delBtn.style.display = ''; }
    });
    form.appendChild(delBtn);
    form.appendChild(confirmRow);
  }

  // Phase-13 unit-type state machine
  let _unitType = 'pieces';
  const syncSizes = () => {
    if (hasSizesCb.checked) { sizesSection.style.display = ''; qtyWrap.style.display = 'none'; }
    else                    { sizesSection.style.display = 'none'; qtyWrap.style.display = ''; }
  };
  const setUnitType = type => {
    _unitType = type;
    if (type === 'pieces') {
      btnPieces.classList.add('active');
      btnOther.classList.remove('active');
      customUnitInput.style.display = 'none';
      if (!hasColorsCb.checked) hasSizesWrap.style.display = 'flex';
    } else {
      btnOther.classList.add('active');
      btnPieces.classList.remove('active');
      customUnitInput.style.display = '';
      hasSizesWrap.style.display = 'none';
      hasSizesCb.checked = false;
      sizesSection.style.display = 'none';
      qtyWrap.style.display = '';
    }
  };
  btnPieces.addEventListener('click', () => setUnitType('pieces'));
  btnOther.addEventListener('click',  () => setUnitType('other'));
  hasSizesCb.addEventListener('change', syncSizes);

  // Color-variant mode sync
  const syncColorVariantMode = () => {
    const isColors = hasColorsCb.checked;
    const isSizes  = hasSizesVariantCb.checked;
    hasSizesVariantCb.disabled = !isColors;
    hasSizesVariantLbl.style.color = isColors ? 'var(--text-primary)' : 'var(--text-muted)';
    if (!isColors) hasSizesVariantCb.checked = false;
    colorVariantSection.style.display = isColors ? '' : 'none';
    colorWrap.style.display           = isColors ? 'none' : '';
    if (isColors) {
      qtyWrap.style.display      = 'none';
      sizesSection.style.display = 'none';
      hasSizesWrap.style.display = 'none';
    } else {
      syncSizes();
      hasSizesWrap.style.display = (_unitType === 'pieces') ? 'flex' : 'none';
    }
    colorRowsList.querySelectorAll('.inv-color-row').forEach(row => {
      const sub   = row.querySelector('.inv-color-sizes-sub');
      const qtyEl = row.querySelector('.inv-color-qty-input');
      if (sub)   sub.style.display   = (isColors && isSizes) ? '' : 'none';
      if (qtyEl) qtyEl.style.display = (isColors && isSizes) ? 'none' : '';
    });
  };
  hasColorsCb.addEventListener('change', syncColorVariantMode);
  hasSizesVariantCb.addEventListener('change', syncColorVariantMode);

  // Pre-populate (edit mode)
  if (item) {
    const ut = item.unitType ?? 'other';
    setUnitType(ut);
    if (ut === 'other') customUnitInput.value = item.unit ?? '';
    if (item.has_colors && item.variants) {
      hasColorsCb.checked = true;
      hasSizesVariantCb.disabled = false;
      hasSizesVariantLbl.style.color = 'var(--text-primary)';
      if (item.has_sizes) hasSizesVariantCb.checked = true;
      syncColorVariantMode();
      if (item.has_sizes) {
        const colorGroups = {};
        item.variants.forEach(v => {
          if (!colorGroups[v.color]) colorGroups[v.color] = [];
          colorGroups[v.color].push({ size: v.size, qty: v.qty });
        });
        Object.entries(colorGroups).forEach(([color, sizes]) => {
          _appendColorRow(colorRowsList, { color, qty: 0, sizes }, true);
        });
      } else {
        item.variants.forEach(v => _appendColorRow(colorRowsList, { color: v.color, qty: v.qty }, false));
      }
    } else if (item.hasSizes) {
      hasSizesCb.checked = true;
      syncSizes();
      if (item.sizes) Object.values(item.sizes).forEach(s => _appendSizeRow(sizesList, s));
    } else {
      qtyInput.value = item.stock ?? 0;
    }
    priceInput.value  = item.price ?? '';
    threshInput.value = item.threshold ?? 5;
  } else {
    setUnitType('pieces');
    threshInput.value = 5;
  }

  // Save handler
  saveBtn.addEventListener('click', async () => {
    errEl.style.display = 'none';
    const name      = nameInput.value.trim();
    const price     = parseFloat(priceInput.value);
    const threshold = parseInt(threshInput.value, 10);
    if (!item && !name)                    { errEl.textContent = 'Name is required.';             errEl.style.display = 'block'; return; }
    if (!(price > 0))                      { errEl.textContent = 'Price must be greater than 0.'; errEl.style.display = 'block'; return; }
    if (isNaN(threshold) || threshold < 0) { errEl.textContent = 'Threshold must be 0 or more.'; errEl.style.display = 'block'; return; }

    const hasColors       = hasColorsCb.checked;
    const hasSizesVariant = hasSizesVariantCb.checked;
    let unit, stock, hasSizes, sizes, variants = null;

    if (hasColors) {
      unit     = 'pcs';
      hasSizes = false;
      const colorRows = colorRowsList.querySelectorAll('.inv-color-row');
      if (!colorRows.length) { errEl.textContent = 'Add at least one color variant.'; errEl.style.display = 'block'; return; }
      variants = [];
      if (hasSizesVariant) {
        for (const colorRow of colorRows) {
          const colorName = colorRow.querySelector('.inv-color-name-input').value.trim();
          if (!colorName) { errEl.textContent = 'Each color row must have a color name.'; errEl.style.display = 'block'; return; }
          const sizeSubRows = colorRow.querySelectorAll('.inv-size-sub-row');
          if (!sizeSubRows.length) { errEl.textContent = `Color "${colorName}" must have at least one size.`; errEl.style.display = 'block'; return; }
          for (const sizeRow of sizeSubRows) {
            const sizeName = sizeRow.querySelector('.inv-size-sub-label').value.trim();
            const sizeQty  = parseInt(sizeRow.querySelector('.inv-size-sub-qty').value, 10);
            if (!sizeName)                      { errEl.textContent = 'Each size must have a label.'; errEl.style.display = 'block'; return; }
            if (isNaN(sizeQty) || sizeQty < 0) { errEl.textContent = 'Size qty must be 0 or more.'; errEl.style.display = 'block'; return; }
            variants.push({ color: colorName, size: sizeName, qty: sizeQty });
          }
        }
      } else {
        for (const colorRow of colorRows) {
          const colorName = colorRow.querySelector('.inv-color-name-input').value.trim();
          const colorQty  = parseInt(colorRow.querySelector('.inv-color-qty-input').value, 10);
          if (!colorName)                      { errEl.textContent = 'Each color row must have a color name.'; errEl.style.display = 'block'; return; }
          if (isNaN(colorQty) || colorQty < 0) { errEl.textContent = 'Color qty must be 0 or more.'; errEl.style.display = 'block'; return; }
          variants.push({ color: colorName, qty: colorQty });
        }
      }
      stock = variants.reduce((s, v) => s + v.qty, 0);
    } else if (_unitType === 'pieces') {
      unit     = 'pcs';
      hasSizes = hasSizesCb.checked;
      if (hasSizes) {
        const rows = sizesList.querySelectorAll('.size-row');
        if (!rows.length) { errEl.textContent = 'Add at least one size variant.'; errEl.style.display = 'block'; return; }
        sizes = {};
        for (const row of rows) {
          const lbl  = row.querySelector('.size-label-input').value.trim();
          const col  = row.querySelector('.size-color-input').value.trim();
          const wid  = row.querySelector('.size-width-input').value.trim();
          const ps   = row.querySelector('.size-psi-input').value.trim();
          const stk  = parseInt(row.querySelector('.size-stock-input').value, 10);
          if (!lbl)                   { errEl.textContent = 'Each size must have a label.';   errEl.style.display = 'block'; return; }
          if (isNaN(stk) || stk < 0) { errEl.textContent = 'Size stock must be 0 or more.'; errEl.style.display = 'block'; return; }
          const key = _sizeKey(lbl, col);
          if (sizes[key])             { errEl.textContent = `Duplicate size/color combo: "${lbl}${col ? ' · ' + col : ''}".`; errEl.style.display = 'block'; return; }
          sizes[key] = { label: lbl, color: col || null, width: wid || null, psi: ps || null, stock: stk };
        }
        stock = 0;
      } else {
        stock = parseInt(qtyInput.value, 10);
        if (isNaN(stock) || stock < 0) { errEl.textContent = 'Quantity must be 0 or more.'; errEl.style.display = 'block'; return; }
      }
    } else {
      unit = customUnitInput.value.trim();
      if (!unit) { errEl.textContent = 'Unit is required.'; errEl.style.display = 'block'; return; }
      stock    = parseInt(qtyInput.value, 10);
      hasSizes = false;
      if (isNaN(stock) || stock < 0) { errEl.textContent = 'Quantity must be 0 or more.'; errEl.style.display = 'block'; return; }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    const type  = form.querySelector('#inv-type')?.value.trim()  ?? '';
    const brand = form.querySelector('#inv-brand')?.value.trim() ?? '';
    const color = form.querySelector('#inv-color')?.value.trim() ?? '';
    try {
      await onSave({
        name: item ? item.name : name,
        unitType: _unitType, unit, price, stock, threshold,
        hasSizes, sizes, type, brand, color,
        has_colors: hasColors, has_sizes: hasSizesVariant,
        variants
      });
      _close();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });

  function _close() { document.body.style.overflow = ''; if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  closeBtn.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });
  sheet.appendChild(header);
  sheet.appendChild(form);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

// ── Add Modal ─────────────────────────────────────────────────
function _showAddModal(container) {
  _showPieceModal(
    container, 'Add Item', null,
    async ({ name, unitType, unit, price, stock, threshold, hasSizes, sizes, type, brand, color, has_colors, has_sizes, variants }) => {
      const docData = { name, unitType, unit, price, stock, threshold, hasSizes, type, brand, color,
        has_colors: has_colors ?? false, has_sizes: has_sizes ?? false };
      if (hasSizes && sizes) docData.sizes = sizes;
      if (has_colors && variants) docData.variants = variants;
      await addDoc(collection(db, 'shops', SHOP_ID, 'inventory'), docData);
    },
    null
  );
}

// ── Edit Modal ────────────────────────────────────────────────
function _showEditModal(container, item) {
  _showPieceModal(
    container, `Edit: ${item.name}`, item,
    async ({ unitType, unit, price, stock, threshold, hasSizes, sizes, type, brand, color, has_colors, has_sizes, variants }) => {
      const updates = { unitType, unit, price, stock, threshold, hasSizes, type, brand, color,
        has_colors: has_colors ?? false, has_sizes: has_sizes ?? false };
      if (hasSizes && sizes) updates.sizes = sizes;
      updates.variants = (has_colors && variants) ? variants : null;
      await updateDoc(doc(db, 'shops', SHOP_ID, 'inventory', item.id), updates);
    },
    async () => deleteDoc(doc(db, 'shops', SHOP_ID, 'inventory', item.id))
  );
}