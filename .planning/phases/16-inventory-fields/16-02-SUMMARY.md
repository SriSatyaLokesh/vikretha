---
phase: 16-inventory-fields
plan: "02"
subsystem: billing, export
tags: [billing, export, type, branch, color, filter, xlsx]
dependency_graph:
  requires: []
  provides: [billing-type-branch-filter, billing-color-badge, export-type-branch-color-columns]
  affects: [modules/billing.js, modules/export.js]
tech_stack:
  added: []
  patterns: [escapeHtml XSS safety, SheetJS aoa_to_sheet, delegated event listeners]
key_files:
  created: []
  modified:
    - modules/billing.js
    - modules/export.js
decisions:
  - Filter dropdowns populated from full `_inventory` (not filtered subset) to always show all available types/branches
  - Color badge inserted between stockBadge and product-card-footer — no layout shift when absent
  - Type/Branch/Color columns placed between Name and Unit to group classification fields before numeric fields
metrics:
  duration: ~15min
  completed: 2026-06-02
  tasks_completed: 2
  files_modified: 2
---

# Phase 16 Plan 02: Billing Filter + Export Columns Summary

Extended `modules/billing.js` with type/branch filter dropdowns and color badge on product cards; extended `modules/export.js` inventory export with Type, Branch, Color columns.

## What Was Built

### billing.js
- **Module state**: `_billingTypeFilter` and `_billingBranchFilter` vars added; reset on each `render()` call
- **Filter row HTML**: Two `<select>` dropdowns (All Types / All Branches) inserted above `#product-grid` inside `billing-products-panel`
- **Event listeners**: Change handlers attached for both selects; call `_renderGrid` with current search value
- **`_renderGrid` updates**:
  - Filter options populated from `_inventory` (all items) on each call
  - `filteredItems` derived from `items` after applying `_billingTypeFilter` / `_billingBranchFilter`
  - Empty state and `.map()` use `filteredItems`; `_inventory.length === 0` guard unchanged
  - Color badge inserted between `${stockBadge}` and `.product-card-footer` — only rendered when `item.color` is set

### export.js
- **Header row**: Updated from 7 to 10 columns: ID, Name, **Type, Branch, Color**, Unit, Price, Stock, Threshold, Status
- **Data rows**: Each `dataRows.push` includes `d.type || ''`, `d.branch || ''`, `d.color || ''` between Name and Unit cells via `_safeStr()` (formula injection protection)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all fields wired from Firestore snapshot → filter → display; export reads from live Firestore data.

## Threat Flags

None — T-16-04, T-16-05, T-16-06 all mitigated: `escapeHtml()` on all HTML insertions; `_safeStr()` on all XLSX cells.

## Self-Check: PASSED

- [x] `modules/billing.js` exists and modified
- [x] `modules/export.js` exists and modified
- [x] Commits exist: `ebddef7`
