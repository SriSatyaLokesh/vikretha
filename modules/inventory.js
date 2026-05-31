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
let _items    = [];         // all items from Firestore snapshot
let _sortMode = 'name';    // 'name' | 'lowstock'
let _search   = '';         // filter string
let _unsub    = null;       // onSnapshot unsubscriber

// ── XSS Safety ────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Entry Point ───────────────────────────────────────────────
export function render(container) {
  _unsub?.();           // clean up previous listener
  _items    = [];
  _sortMode = 'name';
  _search   = '';

  container.innerHTML = `
    <div id="inv-screen" style="padding-bottom:96px;">

      <!-- Sticky search + sort bar -->
      <div style="position:sticky;top:0;background:var(--bg-primary);
                  z-index:20;padding:8px 0 12px;">
        <div style="position:relative;margin-bottom:10px;">
          <svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);
                      pointer-events:none;" width="18" height="18"
               viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input id="inv-search" type="search" autocomplete="off"
            placeholder="Search items…"
            style="width:100%;height:44px;padding:0 14px 0 40px;
                   border:1.5px solid var(--border);border-radius:9999px;
                   font:inherit;font-size:0.95rem;background:var(--bg-surface);
                   color:var(--text-primary);outline:none;transition:border-color 0.15s;
                   box-sizing:border-box;"
            onfocus="this.style.borderColor='var(--theme-color)'"
            onblur="this.style.borderColor='var(--border)'">
        </div>
        <div class="seg-toggle" style="width:100%;display:flex;">
          <button id="sort-name" class="active" style="flex:1;">Name</button>
          <button id="sort-low" style="flex:1;">Low Stock</button>
        </div>
      </div>

      <!-- Item list -->
      <div id="inv-list"></div>

    </div>

    <!-- FAB: Add Item -->
    <button id="inv-add-fab"
      style="position:fixed;bottom:80px;right:16px;
             background:var(--theme-color);color:#fff;
             border:none;border-radius:9999px;padding:12px 20px;
             font-weight:600;font-size:0.95rem;font-family:inherit;
             box-shadow:0 4px 12px rgba(0,0,0,0.15);
             z-index:30;cursor:pointer;">
      + Add Item
    </button>
  `;

  // ── Event Listeners ─────────────────────────────────────────
  const searchEl  = container.querySelector('#inv-search');
  const sortName  = container.querySelector('#sort-name');
  const sortLow   = container.querySelector('#sort-low');
  const fab       = container.querySelector('#inv-add-fab');

  searchEl.addEventListener('input', () => {
    _search = searchEl.value;
    _renderList(container);
  });

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
  // Persistent delegated click for item rows — attached once, survives innerHTML updates
  container.querySelector('#inv-list').addEventListener('click', e => {
    const card = e.target.closest('[data-item-id]');
    if (!card) return;
    const item = _items.find(it => it.id === card.dataset.itemId);
    if (item) _showEditModal(container, item);
  });

  // ── Firestore listener ──────────────────────────────────────
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
  const listEl = container.querySelector('#inv-list');
  if (!listEl) return;

  // Filter
  const q = _search.toLowerCase();
  let list = _items.filter(it => it.name.toLowerCase().includes(q));

  // Sort
  if (_sortMode === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // low-stock first, then by name
    const isLow = it => it.stock < (it.threshold ?? 5);
    list.sort((a, b) => {
      const aLow = isLow(a) ? 0 : 1;
      const bLow = isLow(b) ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return a.name.localeCompare(b.name);
    });
  }

  // Empty state
  if (_items.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:48px 24px;color:var(--text-muted);">
        <div style="font-size:2.5rem;margin-bottom:12px;">📦</div>
        <p style="font-size:0.95rem;">No inventory items yet.<br>Tap <strong>+ Add Item</strong> to get started.</p>
      </div>`;
    return;
  }

  if (list.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:32px 24px;color:var(--text-muted);">
        <p style="font-size:0.95rem;">No items match "<strong>${escapeHtml(_search)}</strong>".</p>
      </div>`;
    return;
  }

  listEl.innerHTML = list.map(item => {
    const low       = item.stock < (item.threshold ?? 5);
    const lowBadge  = low
      ? `<span style="background:#fef2f2;color:var(--danger);
                      border:1px solid #fecaca;border-radius:9999px;
                      font-size:0.7rem;padding:1px 8px;margin-left:6px;">Low</span>`
      : '';
    const price     = parseFloat(item.price ?? 0).toFixed(2);
    const stockText = `${escapeHtml(String(item.stock))} ${escapeHtml(item.unit ?? '')}`;

    return `
      <div class="card" data-item-id="${escapeHtml(item.id)}"
           style="margin-bottom:10px;padding:12px 16px;cursor:pointer;
                  display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-weight:600;color:var(--text-primary);">
            ${escapeHtml(item.name)}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
            ${escapeHtml(item.unit ?? '')}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.9rem;color:var(--text-primary);font-variant-numeric:tabular-nums;">
            ${stockText}${lowBadge}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
            ${escapeHtml(CURRENCY)}${price}/${escapeHtml(item.unit ?? '')}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── Generic Bottom-Sheet Modal ────────────────────────────────
function _showModal(container, titleText, fields, onSave, onDelete) {
  // Lock background scroll
  document.body.style.overflow = 'hidden';

  // Overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'background:rgba(0,0,0,0.4)',
    'z-index:50', 'display:flex', 'align-items:flex-end'
  ].join(';');

  // Sheet
  const sheet = document.createElement('div');
  sheet.style.cssText = [
    'background:var(--bg-primary)',
    'border-radius:16px 16px 0 0',
    'padding:24px 16px',
    'width:100%',
    'max-height:85vh',
    'overflow-y:auto',
    'box-sizing:border-box'
  ].join(';');

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
  const title = document.createElement('h2');
  title.style.cssText = 'font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:0;';
  title.textContent = titleText;   // textContent — no XSS risk
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background:none;border:none;font-size:1.5rem;cursor:pointer;color:var(--text-secondary);line-height:1;padding:0;';
  header.appendChild(title);
  header.appendChild(closeBtn);

  // Form
  const form = document.createElement('form');
  form.addEventListener('submit', e => e.preventDefault());

  fields.forEach(f => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom:14px;';

    const label = document.createElement('label');
    label.style.cssText = 'display:block;font-size:0.82rem;font-weight:500;color:var(--text-secondary);margin-bottom:6px;';
    label.textContent = f.label;

    const input = document.createElement('input');
    input.id    = f.id;
    input.type  = f.type ?? 'text';
    if (f.value !== undefined) input.value = f.value;
    if (f.required)  input.required = true;
    if (f.min !== undefined) input.min = f.min;
    if (f.step)      input.step = f.step;
    if (f.placeholder) input.placeholder = f.placeholder;
    if (f.readonly) {
      input.readOnly = true;
      input.style.cssText = 'opacity:0.6;cursor:not-allowed;';
    }
    input.style.cssText += [
      'width:100%', 'height:44px', 'padding:0 12px',
      'border:1.5px solid var(--border)', 'border-radius:var(--border-radius)',
      'font:inherit', 'font-size:0.95rem',
      'background:var(--bg-surface)', 'color:var(--text-primary)',
      'outline:none', 'transition:border-color 0.15s', 'box-sizing:border-box'
    ].join(';');
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

  // Error area
  const errEl = document.createElement('p');
  errEl.style.cssText = 'color:var(--danger);font-size:0.85rem;margin:8px 0 0;display:none;';
  form.appendChild(errEl);

  // Save button
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
    saveBtn.disabled   = true;
    saveBtn.textContent = 'Saving…';
    try {
      await onSave(data, errEl);
      _close();
    } catch (err) {
      errEl.textContent   = err.message;
      errEl.style.display = 'block';
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save';
    }
  });
  form.appendChild(saveBtn);

  // Delete button
  if (onDelete) {
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className   = 'btn btn-danger btn-full';
    delBtn.style.marginTop = '8px';

    const confirmRow = document.createElement('div');
    confirmRow.style.cssText = 'margin-top:8px;display:none;text-align:center;font-size:0.9rem;';
    confirmRow.innerHTML = `Are you sure? ` +
      `<button id="confirm-del" class="btn btn-danger" style="margin:0 6px;padding:6px 16px;">Yes, delete</button>` +
      `<button id="cancel-del"  class="btn btn-secondary" style="padding:6px 16px;">Cancel</button>`;

    delBtn.addEventListener('click', () => {
      delBtn.style.display      = 'none';
      confirmRow.style.display  = 'block';
    });
    confirmRow.querySelector('#cancel-del').addEventListener('click', () => {
      confirmRow.style.display = 'none';
      delBtn.style.display     = '';
    });
    confirmRow.querySelector('#confirm-del').addEventListener('click', async () => {
      try {
        await onDelete();
        _close();
      } catch (err) {
        errEl.textContent   = err.message;
        errEl.style.display = 'block';
        confirmRow.style.display = 'none';
        delBtn.style.display     = '';
      }
    });

    form.appendChild(delBtn);
    form.appendChild(confirmRow);
  }

  // Close helpers
  function _close() {
    document.body.style.overflow = '';
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  closeBtn.addEventListener('click', _close);
  overlay.addEventListener('click', e => { if (e.target === overlay) _close(); });

  sheet.appendChild(header);
  sheet.appendChild(form);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);
}

// ── Add Modal ─────────────────────────────────────────────────
function _showAddModal(container) {
  _showModal(
    container,
    'Add Item',
    [
      { id: 'inv-name',      label: 'Name',              type: 'text',   required: true },
      { id: 'inv-unit',      label: 'Unit (kg/ltr/pcs)', type: 'text',   required: true, placeholder: 'kg / ltr / pcs' },
      { id: 'inv-price',     label: 'Price',             type: 'number', required: true, min: '0.01', step: '0.01' },
      { id: 'inv-qty',       label: 'Quantity (stock)',  type: 'number', required: true, min: '0' },
      { id: 'inv-threshold', label: 'Low-stock threshold', type: 'number', required: true, min: '0', value: 5 },
    ],
    async (data, errEl) => {
      const name      = data['inv-name'];
      const unit      = data['inv-unit'];
      const price     = parseFloat(data['inv-price']);
      const stock     = parseInt(data['inv-qty'], 10);
      const threshold = parseInt(data['inv-threshold'], 10);

      if (!name)          throw new Error('Name is required.');
      if (!unit)          throw new Error('Unit is required.');
      if (!(price > 0))   throw new Error('Price must be greater than 0.');
      if (isNaN(stock) || stock < 0)     throw new Error('Quantity must be 0 or more.');
      if (isNaN(threshold) || threshold < 0) throw new Error('Threshold must be 0 or more.');

      await addDoc(collection(db, 'shops', SHOP_ID, 'inventory'), {
        name, unit, price, stock, threshold
      });
    },
    null   // no delete on add
  );
}

// ── Edit Modal ────────────────────────────────────────────────
function _showEditModal(container, item) {
  _showModal(
    container,
    `Edit: ${item.name}`,   // textContent assignment in _showModal — safe
    [
      {
        id: 'inv-name', label: 'Name', type: 'text',
        value: item.name, readonly: true,
        hint: 'Name is the item identifier — to rename, delete and re-add.'
      },
      { id: 'inv-unit',      label: 'Unit',              type: 'text',   required: true, value: item.unit ?? '' },
      { id: 'inv-price',     label: 'Price',             type: 'number', required: true, min: '0.01', step: '0.01', value: item.price ?? '' },
      { id: 'inv-qty',       label: 'Quantity (stock)',  type: 'number', required: true, min: '0',    value: item.stock ?? 0 },
      { id: 'inv-threshold', label: 'Low-stock threshold', type: 'number', required: true, min: '0', value: item.threshold ?? 5 },
    ],
    async (data) => {
      const unit      = data['inv-unit'];
      const price     = parseFloat(data['inv-price']);
      const stock     = parseInt(data['inv-qty'], 10);
      const threshold = parseInt(data['inv-threshold'], 10);

      if (!unit)          throw new Error('Unit is required.');
      if (!(price > 0))   throw new Error('Price must be greater than 0.');
      if (isNaN(stock) || stock < 0)     throw new Error('Quantity must be 0 or more.');
      if (isNaN(threshold) || threshold < 0) throw new Error('Threshold must be 0 or more.');

      await updateDoc(doc(db, 'shops', SHOP_ID, 'inventory', item.id), {
        unit, price, stock, threshold
      });
    },
    async () => {
      await deleteDoc(doc(db, 'shops', SHOP_ID, 'inventory', item.id));
    }
  );
}
