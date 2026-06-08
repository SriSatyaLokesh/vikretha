/**
 * patch-billing-ux.js
 * Phase 27 UX: filter CSS classes, active state, SVG empty states
 */
const fs = require('fs');

// ─── billing.js ───────────────────────────────────────────────────────────
{
  const file = 'modules/billing.js';
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;

  // 1. Filter row: inline style → CSS class
  const OLD1 = `<div id="billing-filter-row" style="display:flex;gap:8px;padding:0 0 8px;flex-wrap:wrap;">\r\n          <select id="billing-type-filter"\r\n            style="flex:1;min-width:110px;height:36px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;">\r\n            <option value="">All Types</option>\r\n          </select>\r\n          <select id="billing-brand-filter"\r\n            style="flex:1;min-width:110px;height:36px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.82rem;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;">\r\n            <option value="">All Brands</option>\r\n          </select>\r\n        </div>`;
  const NEW1 = `<div id="billing-filter-row" class="billing-filter-row">\r\n          <select id="billing-type-filter" class="billing-filter-select" aria-label="Filter by type">\r\n            <option value="">All Types</option>\r\n          </select>\r\n          <select id="billing-brand-filter" class="billing-filter-select" aria-label="Filter by brand">\r\n            <option value="">All Brands</option>\r\n          </select>\r\n        </div>`;
  if (src.includes(OLD1)) { src = src.replace(OLD1, NEW1); changed++; console.log('  [1] Filter row inline styles → CSS classes'); }
  else if (src.includes('class="billing-filter-row"')) { console.log('  [1] Already done'); }
  else { console.error('  [1] MISS - filter row'); process.exit(1); }

  // 2. has-value class after typeEl block
  const OLD2 = `    if (!types.includes(cur)) { typeEl.value = ''; _billingTypeFilter = ''; }\r\n  }`;
  const NEW2 = `    if (!types.includes(cur)) { typeEl.value = ''; _billingTypeFilter = ''; }\r\n    typeEl.classList.toggle('has-value', !!_billingTypeFilter);\r\n  }`;
  if (src.includes(OLD2)) { src = src.replace(OLD2, NEW2); changed++; console.log('  [2] typeEl has-value toggle'); }
  else if (src.includes("typeEl.classList.toggle('has-value'")) { console.log('  [2] Already done'); }
  else { console.error('  [2] MISS - typeEl has-value'); process.exit(1); }

  // 3. has-value class after brandEl block
  const OLD3 = `    if (!brands.includes(cur)) { brandEl.value = ''; _billingbrandFilter = ''; }\r\n  }`;
  const NEW3 = `    if (!brands.includes(cur)) { brandEl.value = ''; _billingbrandFilter = ''; }\r\n    brandEl.classList.toggle('has-value', !!_billingbrandFilter);\r\n  }`;
  if (src.includes(OLD3)) { src = src.replace(OLD3, NEW3); changed++; console.log('  [3] brandEl has-value toggle'); }
  else if (src.includes("brandEl.classList.toggle('has-value'")) { console.log('  [3] Already done'); }
  else { console.error('  [3] MISS - brandEl has-value'); process.exit(1); }

  // 4. Empty state: emoji box icon → SVG
  const OLD4 = `        <div style="font-size:2.5rem;margin-bottom:12px;">📦</div>`;
  const NEW4 = `        <div style="margin-bottom:12px;color:var(--text-muted);"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>`;
  if (src.includes(OLD4)) { src = src.replace(OLD4, NEW4); changed++; console.log('  [4] Empty-box emoji → SVG'); }
  else if (!src.includes('📦')) { console.log('  [4] Already done'); }
  else { console.error('  [4] MISS - box emoji'); process.exit(1); }

  // 5. Empty state: emoji search → SVG
  const OLD5 = `        <div style="font-size:2rem;margin-bottom:12px;">🔍</div>`;
  const NEW5 = `        <div style="margin-bottom:12px;color:var(--text-muted);"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div>`;
  if (src.includes(OLD5)) { src = src.replace(OLD5, NEW5); changed++; console.log('  [5] Search emoji → SVG'); }
  else if (!src.includes('🔍')) { console.log('  [5] Already done'); }
  else { console.error('  [5] MISS - search emoji'); process.exit(1); }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`billing.js: ${changed} change(s). Size: ${fs.statSync(file).size}`);
}

// ─── main.css ─────────────────────────────────────────────────────────────
{
  const file = 'styles/main.css';
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;

  // 6. Add .billing-filter-row + .billing-filter-select rules after search focus rule
  const OLD6 = `.billing-search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }`;
  const NEW6 = `.billing-search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.billing-filter-row { display: flex; gap: 8px; padding: 0 0 10px; flex-wrap: wrap; }
.billing-filter-select { flex: 1; min-width: 110px; height: 38px; padding: 0 10px; border: 1.5px solid var(--border); border-radius: var(--border-radius); font: inherit; font-size: 0.82rem; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), color var(--transition-fast); }
.billing-filter-select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-ring); }
.billing-filter-select.has-value { border-color: var(--primary); color: var(--primary); font-weight: 600; background: var(--primary-light); }`;
  if (src.includes(OLD6) && !src.includes('.billing-filter-row')) { src = src.replace(OLD6, NEW6); changed++; console.log('  [6] billing-filter-select CSS added'); }
  else if (src.includes('.billing-filter-row')) { console.log('  [6] Already done'); }
  else { console.error('  [6] MISS - search input focus rule'); process.exit(1); }

  // 7. Add :active press feedback to product card (after :hover rule)
  const OLD7 = `.product-card:hover  { border-color: var(--primary); background: var(--primary-light); box-shadow: var(--shadow-sm); }`;
  const NEW7 = `.product-card:hover  { border-color: var(--primary); background: var(--primary-light); box-shadow: var(--shadow-sm); }
.product-card:active { transform: scale(0.97); transition-duration: 80ms; }`;
  if (src.includes(OLD7) && !src.includes('.product-card:active')) { src = src.replace(OLD7, NEW7); changed++; console.log('  [7] product-card :active press feedback'); }
  else if (src.includes('.product-card:active')) { console.log('  [7] Already done'); }
  else { console.error('  [7] MISS - product-card hover rule'); process.exit(1); }

  // 8. Product name: add 2-line clamp
  const OLD8 = `.product-card-name   { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); line-height: 1.35; }`;
  const NEW8 = `.product-card-name   { font-size: 0.875rem; font-weight: 600; color: var(--text-primary); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: calc(0.875rem * 1.35 * 2); }`;
  if (src.includes(OLD8)) { src = src.replace(OLD8, NEW8); changed++; console.log('  [8] product-card-name 2-line clamp'); }
  else if (src.includes('-webkit-line-clamp: 2')) { console.log('  [8] Already done'); }
  else { console.error('  [8] MISS - product-card-name rule'); process.exit(1); }

  // 9. card-qty-btn: increase from 26px to 32px
  const OLD9 = `.card-qty-btn {\r\n  width: 26px; height: 26px; border-radius: var(--radius-sm); border: 1.5px solid var(--primary);\r\n  background: var(--bg-surface); display: flex; align-items: center; justify-content: center;\r\n  font-size: 1rem; font-weight: 700; color: var(--primary); cursor: pointer; line-height: 1;\r\n  transition: background var(--transition-fast), color var(--transition-fast); flex-shrink: 0;\r\n}`;
  const NEW9 = `.card-qty-btn {\r\n  width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1.5px solid var(--primary);\r\n  background: var(--bg-surface); display: flex; align-items: center; justify-content: center;\r\n  font-size: 1rem; font-weight: 700; color: var(--primary); cursor: pointer; line-height: 1;\r\n  transition: background var(--transition-fast), color var(--transition-fast); flex-shrink: 0;\r\n}`;
  if (src.includes(OLD9)) { src = src.replace(OLD9, NEW9); changed++; console.log('  [9] card-qty-btn 26px → 32px'); }
  else if (src.includes('width: 32px; height: 32px; border-radius: var(--radius-sm); border: 1.5px solid var(--primary)')) { console.log('  [9] Already done'); }
  else { console.error('  [9] MISS - card-qty-btn rule'); process.exit(1); }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`main.css: ${changed} change(s). Size: ${fs.statSync(file).size}`);
}

console.log('Done.');
