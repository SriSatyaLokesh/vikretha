/**
 * patch-select-ux.js
 * Custom-styled selects: appearance:none + SVG chevron + proper padding-right
 * Covers: billing-filter-select, month-picker-select, rpt-sort-select,
 *         settings-role-select, inv-filter-select (new class for inventory)
 */
const fs = require('fs');

// ─── inventory.js — replace inline-styled selects with class ─────────────
{
  const file = 'modules/inventory.js';
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;

  // 1. Filter row div: inline style → class
  const OLD1 = `<div id="inv-filter-row" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">`;
  const NEW1 = `<div id="inv-filter-row" class="billing-filter-row" style="margin-bottom:12px;">`;
  if (src.includes(OLD1)) { src = src.replace(OLD1, NEW1); changed++; console.log('  [1] inv-filter-row → billing-filter-row class'); }
  else if (src.includes('class="billing-filter-row"') && src.includes('inv-filter-row')) { console.log('  [1] Already done'); }
  else { console.error('  [1] MISS - inv-filter-row'); process.exit(1); }

  // 2. Type filter select: inline style → class
  const OLD2 = `<select id="inv-type-filter" style="flex:1;min-width:120px;height:36px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.85rem;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;">`;
  const NEW2 = `<select id="inv-type-filter" class="billing-filter-select" aria-label="Filter by type">`;
  if (src.includes(OLD2)) { src = src.replace(OLD2, NEW2); changed++; console.log('  [2] inv-type-filter inline → class'); }
  else if (src.includes('id="inv-type-filter" class=')) { console.log('  [2] Already done'); }
  else { console.error('  [2] MISS - inv-type-filter'); process.exit(1); }

  // 3. Brand filter select: inline style → class
  const OLD3 = `<select id="inv-brand-filter" style="flex:1;min-width:120px;height:36px;padding:0 8px;border:1.5px solid var(--border);border-radius:var(--border-radius);font:inherit;font-size:0.85rem;background:var(--bg-surface);color:var(--text-primary);cursor:pointer;">`;
  const NEW3 = `<select id="inv-brand-filter" class="billing-filter-select" aria-label="Filter by brand">`;
  if (src.includes(OLD3)) { src = src.replace(OLD3, NEW3); changed++; console.log('  [3] inv-brand-filter inline → class'); }
  else if (src.includes('id="inv-brand-filter" class=')) { console.log('  [3] Already done'); }
  else { console.error('  [3] MISS - inv-brand-filter'); process.exit(1); }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`inventory.js: ${changed} change(s). Size: ${fs.statSync(file).size}`);
}

// ─── main.css — custom chevron for all select classes ────────────────────
{
  const file = 'styles/main.css';
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;

  // SVG chevron data URIs (chevron-down, stroke-width 2, rounded)
  // Light mode: slate-400 = #94a3b8
  // Dark mode:  slate-500 = #64748b
  // has-value:  primary   = #f97316
  const CHEVRON_LT  = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;
  const CHEVRON_DRK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;
  const CHEVRON_ACT = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23f97316' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;
  const BGP = `background-repeat: no-repeat; background-position: right 10px center; background-size: 16px 16px;`;

  // 4. billing-filter-select: add appearance:none + chevron + fix padding
  const OLD4 = `.billing-filter-select { flex: 1; min-width: 110px; height: 38px; padding: 0 10px; border: 1.5px solid var(--border); border-radius: var(--border-radius); font: inherit; font-size: 0.82rem; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), color var(--transition-fast); }`;
  const NEW4 = `.billing-filter-select { flex: 1; min-width: 110px; height: 38px; padding: 0 32px 0 10px; border: 1.5px solid var(--border); border-radius: var(--border-radius); font: inherit; font-size: 0.82rem; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast), color var(--transition-fast); appearance: none; -webkit-appearance: none; background-image: ${CHEVRON_LT}; ${BGP} }`;
  if (src.includes(OLD4)) { src = src.replace(OLD4, NEW4); changed++; console.log('  [4] billing-filter-select: appearance:none + chevron'); }
  else if (src.includes('appearance: none') && src.includes('billing-filter-select')) { console.log('  [4] Already done'); }
  else { console.error('  [4] MISS - billing-filter-select rule'); process.exit(1); }

  // 5. billing-filter-select.has-value: orange chevron
  const OLD5 = `.billing-filter-select.has-value { border-color: var(--primary); color: var(--primary); font-weight: 600; background: var(--primary-light); }`;
  const NEW5 = `.billing-filter-select.has-value { border-color: var(--primary); color: var(--primary); font-weight: 600; background: var(--primary-light); background-image: ${CHEVRON_ACT}; ${BGP} }`;
  if (src.includes(OLD5)) { src = src.replace(OLD5, NEW5); changed++; console.log('  [5] billing-filter-select.has-value: orange chevron'); }
  else if (src.includes('has-value') && src.includes(CHEVRON_ACT)) { console.log('  [5] Already done'); }
  else { console.error('  [5] MISS - has-value rule'); process.exit(1); }

  // 6. month-picker-select: appearance:none + chevron + fix padding
  const OLD6 = `.month-picker-select {\r\n  height: 36px; padding: 0 10px; border: 1.5px solid var(--border); border-radius: var(--radius);\r\n  font-size: 0.875rem; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font: inherit;\r\n}`;
  const NEW6 = `.month-picker-select {\r\n  height: 36px; padding: 0 32px 0 10px; border: 1.5px solid var(--border); border-radius: var(--radius);\r\n  font-size: 0.875rem; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font: inherit;\r\n  appearance: none; -webkit-appearance: none; background-image: ${CHEVRON_LT}; background-repeat: no-repeat; background-position: right 10px center; background-size: 16px 16px;\r\n}`;
  if (src.includes(OLD6)) { src = src.replace(OLD6, NEW6); changed++; console.log('  [6] month-picker-select: appearance:none + chevron'); }
  else if (src.includes('month-picker-select') && src.includes('appearance: none')) { console.log('  [6] Already done'); }
  else { console.error('  [6] MISS - month-picker-select rule'); process.exit(1); }

  // 7. settings-role-select: appearance:none + chevron + fix padding
  const OLD7 = `.settings-role-select {\r\n  height: 44px; padding: 0 10px; border: 1.5px solid var(--border); border-radius: var(--radius);\r\n  font-size: 0.875rem; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font: inherit;\r\n}`;
  const NEW7 = `.settings-role-select {\r\n  height: 44px; padding: 0 32px 0 10px; border: 1.5px solid var(--border); border-radius: var(--radius);\r\n  font-size: 0.875rem; background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font: inherit;\r\n  appearance: none; -webkit-appearance: none; background-image: ${CHEVRON_LT}; background-repeat: no-repeat; background-position: right 10px center; background-size: 16px 16px;\r\n}`;
  if (src.includes(OLD7)) { src = src.replace(OLD7, NEW7); changed++; console.log('  [7] settings-role-select: appearance:none + chevron'); }
  else if (src.includes('settings-role-select') && src.includes('appearance: none')) { console.log('  [7] Already done'); }
  else { console.error('  [7] MISS - settings-role-select rule'); process.exit(1); }

  // 8. rpt-sort-select: appearance:none + chevron + fix padding
  const OLD8 = `.rpt-sort-select {\r\n  padding:6px 10px; font-size:0.85rem; min-height:36px;\r\n  border:1.5px solid var(--border); border-radius:var(--radius-sm);\r\n  background:var(--bg-app); color:var(--text-primary); cursor:pointer;\r\n  width:100%;\r\n}`;
  const NEW8 = `.rpt-sort-select {\r\n  padding: 6px 32px 6px 10px; font-size:0.85rem; min-height:36px;\r\n  border:1.5px solid var(--border); border-radius:var(--radius-sm);\r\n  background:var(--bg-app); color:var(--text-primary); cursor:pointer;\r\n  width:100%; font: inherit;\r\n  appearance: none; -webkit-appearance: none; background-image: ${CHEVRON_LT}; background-repeat: no-repeat; background-position: right 10px center; background-size: 16px 16px;\r\n}`;
  if (src.includes(OLD8)) { src = src.replace(OLD8, NEW8); changed++; console.log('  [8] rpt-sort-select: appearance:none + chevron'); }
  else if (src.includes('rpt-sort-select') && src.includes('appearance: none')) { console.log('  [8] Already done'); }
  else { console.error('  [8] MISS - rpt-sort-select rule'); process.exit(1); }

  // 9. Dark mode chevron override — insert after dark mode block closes
  const DARK_CHVN = `\r\n/* Custom select chevrons — dark mode variant (slate-500 stroke) */\r\n[data-dark="true"] .billing-filter-select,\r\n[data-dark="true"] .billing-filter-select.has-value,\r\n[data-dark="true"] .month-picker-select,\r\n[data-dark="true"] .rpt-sort-select,\r\n[data-dark="true"] .settings-role-select { background-image: ${CHEVRON_DRK}; }\r\n[data-dark="true"] .billing-filter-select.has-value { background-image: ${CHEVRON_ACT}; }`;

  if (!src.includes('Custom select chevrons — dark mode')) {
    // Insert right after the closing brace of [data-dark="true"] block (after line ~1549)
    const ANCHOR = `/* Settings dark mode toggle row */`;
    if (src.includes(ANCHOR)) {
      src = src.replace(ANCHOR, DARK_CHVN + '\r\n\r\n/* Settings dark mode toggle row */');
      changed++;
      console.log('  [9] Dark mode chevron overrides added');
    } else { console.error('  [9] MISS - dark mode anchor'); process.exit(1); }
  } else { console.log('  [9] Already done'); }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`main.css: ${changed} change(s). Size: ${fs.statSync(file).size}`);
}

console.log('Done.');
