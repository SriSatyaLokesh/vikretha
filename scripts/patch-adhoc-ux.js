/**
 * patch-adhoc-ux.js
 * Improve "Other item" trigger button + bottom sheet
 */
const fs = require('fs');
const EOL = '\r\n';

// ─── billing.js ────────────────────────────────────────────────────────────
{
  const file = 'modules/billing.js';
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;

  // 1. Replace the trigger button wrapper + button with a class-driven version
  const OLD1 = [
    `        <div style="padding:8px 4px 4px;">`,
    `          <button id="adhoc-item-btn"`,
    `            style="width:100%;padding:11px 16px;border-radius:10px;cursor:pointer;`,
    `                   background:transparent;border:1.5px dashed var(--border);`,
    `                   color:var(--text-secondary);font:inherit;font-size:0.85rem;`,
    `                   display:flex;align-items:center;justify-content:center;gap:6px;">`,
    `            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    `            Other item`,
    `          </button>`,
    `        </div>`,
  ].join(EOL);

  const NEW1 = [
    `        <div class="adhoc-btn-wrap">`,
    `          <button id="adhoc-item-btn" class="adhoc-item-btn" aria-label="Add an unlisted item to cart">`,
    `            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
    `            Other item`,
    `          </button>`,
    `        </div>`,
  ].join(EOL);

  if (src.includes(OLD1)) { src = src.replace(OLD1, NEW1); changed++; console.log('  [1] adhoc trigger button'); }
  else if (src.includes('class="adhoc-item-btn"')) { console.log('  [1] Already done'); }
  else { console.error('  [1] MISS - trigger button'); process.exit(1); }

  // 2. Replace _showAdhocItemForm with improved version
  const OLD2_START = `function _showAdhocItemForm(container) {`;
  const OLD2_END   = `  setTimeout(() => nameInput.focus(), 50);\n}`;

  const startIdx = src.indexOf(OLD2_START);
  const endIdx   = src.indexOf(OLD2_END, startIdx);
  if (startIdx === -1 || endIdx === -1) {
    // Try CRLF variant
    const OLD2_END_CRLF = `  setTimeout(() => nameInput.focus(), 50);\r\n}`;
    const endIdxCrlf = src.indexOf(OLD2_END_CRLF, startIdx);
    if (startIdx === -1 || endIdxCrlf === -1) {
      console.error('  [2] MISS - _showAdhocItemForm boundaries');
      process.exit(1);
    }
    const before = src.slice(0, startIdx);
    const after  = src.slice(endIdxCrlf + OLD2_END_CRLF.length);
    src = before + NEW_ADHOC_FN + after;
  } else {
    const before = src.slice(0, startIdx);
    const after  = src.slice(endIdx + OLD2_END.length);
    src = before + NEW_ADHOC_FN + after;
  }
  changed++;
  console.log('  [2] _showAdhocItemForm rewrite');

  fs.writeFileSync(file, src, 'utf8');
  console.log(`billing.js: ${changed} change(s). Size: ${fs.statSync(file).size}`);
}

const NEW_ADHOC_FN = `function _showAdhocItemForm(container) {
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.className = 'bs-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'adhoc-sheet-title');

  const sheet = document.createElement('div');
  sheet.className = 'bs-sheet';

  // ── Header ──
  const header = document.createElement('div');
  header.className = 'bs-header';

  const title = document.createElement('h2');
  title.id = 'adhoc-sheet-title';
  title.className = 'bs-title';
  title.textContent = 'Add Other Item';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'bs-close-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  header.appendChild(title);
  header.appendChild(closeBtn);

  // ── Helper text ──
  const hint = document.createElement('p');
  hint.className = 'bs-hint';
  hint.textContent = 'For items not in your inventory — e.g. labour, packing, misc.';

  // ── Name field ──
  const nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';
  const nameLabel = document.createElement('label');
  nameLabel.className = 'form-label';
  nameLabel.htmlFor = 'adhoc-name-input';
  nameLabel.textContent = 'Item Name';
  const nameInput = document.createElement('input');
  nameInput.id = 'adhoc-name-input';
  nameInput.type = 'text';
  nameInput.placeholder = 'e.g. Labour charge';
  nameInput.autocomplete = 'off';
  nameInput.className = 'form-input';
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);

  // ── Price field ──
  const priceGroup = document.createElement('div');
  priceGroup.className = 'form-group';
  const priceLabel = document.createElement('label');
  priceLabel.className = 'form-label';
  priceLabel.htmlFor = 'adhoc-price-input';
  priceLabel.textContent = 'Price';
  const priceInput = document.createElement('input');
  priceInput.id = 'adhoc-price-input';
  priceInput.type = 'number';
  priceInput.inputMode = 'decimal';
  priceInput.min = '0.01';
  priceInput.step = '0.01';
  priceInput.placeholder = '0.00';
  priceInput.className = 'form-input';
  priceGroup.appendChild(priceLabel);
  priceGroup.appendChild(priceInput);

  // ── Error ──
  const errEl = document.createElement('p');
  errEl.className = 'adhoc-error';
  errEl.setAttribute('role', 'alert');
  errEl.style.display = 'none';
  errEl.textContent = 'Enter a name and a price greater than 0.';

  // ── Actions ──
  const actions = document.createElement('div');
  actions.className = 'bs-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.style.flex = '1';

  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add to Cart';
  addBtn.className = 'btn btn-primary';
  addBtn.style.flex = '2';

  actions.appendChild(cancelBtn);
  actions.appendChild(addBtn);

  // ── Assemble ──
  sheet.appendChild(header);
  sheet.appendChild(hint);
  sheet.appendChild(nameGroup);
  sheet.appendChild(priceGroup);
  sheet.appendChild(errEl);
  sheet.appendChild(actions);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  // Slide in
  requestAnimationFrame(() => sheet.classList.add('bs-sheet--open'));

  function _close() {
    sheet.classList.remove('bs-sheet--open');
    sheet.addEventListener('transitionend', () => {
      document.body.style.overflow = '';
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, { once: true });
  }

  addBtn.addEventListener('click', () => {
    const name  = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    if (!name || !(price > 0)) {
      errEl.style.display = '';
      nameInput.focus();
      return;
    }
    errEl.style.display = 'none';
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
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') _close(); });

  setTimeout(() => nameInput.focus(), 80);
}`;

// ─── main.css ─────────────────────────────────────────────────────────────
{
  const file = 'styles/main.css';
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;

  // 3. Add adhoc button CSS after billing-filter-select rules
  const ANCHOR = `/* In-card qty controls (div, not button — avoids nested-button HTML violation) */`;
  const NEW_CSS = `/* == Adhoc "Other item" trigger == */
.adhoc-btn-wrap { padding: 10px 4px 4px; }
.adhoc-item-btn {
  width: 100%; height: 44px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  border-radius: var(--radius); border: 1.5px dashed var(--border);
  background: var(--surface-subtle); color: var(--text-secondary);
  font: inherit; font-size: 0.875rem; font-weight: 500;
  cursor: pointer; transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
  touch-action: manipulation;
}
.adhoc-item-btn:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-light); }
.adhoc-item-btn:active { background: var(--surface-press); transform: scale(0.98); transition-duration: 80ms; }

/* == Bottom sheet (shared) == */
.bs-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 50;
  display: flex; align-items: flex-end;
}
.bs-sheet {
  background: var(--bg-surface); border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 20px 16px 24px; width: 100%; box-sizing: border-box;
  max-height: 90dvh; overflow-y: auto;
  transform: translateY(100%); transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
}
.bs-sheet--open { transform: translateY(0); }
.bs-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;
}
.bs-title { font-size: 1.0625rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.bs-close-btn {
  width: 32px; height: 32px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); background: none; border: none; cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.bs-close-btn:hover { background: var(--surface-hover); color: var(--text-primary); }
.bs-hint { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 18px; line-height: 1.4; }
.bs-actions { display: flex; gap: 8px; margin-top: 16px; }
.adhoc-error { font-size: 0.8rem; color: var(--danger); margin: 6px 0 0; line-height: 1.4; }

`;

  if (!src.includes('.adhoc-item-btn')) {
    if (src.includes(ANCHOR)) {
      src = src.replace(ANCHOR, NEW_CSS + ANCHOR);
      changed++;
      console.log('  [3] Adhoc button + bottom sheet CSS added');
    } else { console.error('  [3] MISS - CSS anchor'); process.exit(1); }
  } else { console.log('  [3] Already done'); }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`main.css: ${changed} change(s). Size: ${fs.statSync(file).size}`);
}

console.log('Done.');
