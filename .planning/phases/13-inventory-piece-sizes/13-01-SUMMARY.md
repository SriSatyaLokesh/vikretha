---
phase: 13
plan: "01"
subsystem: inventory
tags: [inventory, sizes, piece-units, firestore-schema]
dependency_graph:
  requires: []
  provides: [hasSizes-schema, size-variant-ui, isLow-sizes]
  affects: [billing, receipt]
tech_stack:
  added: []
  patterns: [bottom-sheet-modal, segmented-toggle, size-variant-grid]
key_files:
  created: []
  modified: [modules/inventory.js]
decisions:
  - "Size key sanitized via _sizeKey(): trim, lowercase, replace non-alphanumeric with dash, max 40 chars"
  - "hasSizes items show summed stock in list + badge-blue 'N sizes' badge"
  - "Legacy items (no unitType) default to unitType='other' in edit modal"
  - "isLow checks each size's stock individually for hasSizes items"
metrics:
  duration: "~60 min (across sessions)"
  completed: "2025-07-13"
---

# Phase 13 Plan 01: Inventory Piece Sizes Summary

**One-liner:** Rewrote inventory.js with hasSizes toggle, size variant grid (label/width/psi/stock), isLow per-size check, and piece/other unit segmented toggle.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Add `isLow` module-level function with hasSizes support | ✅ |
| 2 | Update `_renderList` for summed stock + size badge | ✅ |
| 3 | Add `_inputStyle`, `_sizeKey`, `_appendSizeRow` helpers | ✅ |
| 4 | Implement `_showPieceModal` with sizes section | ✅ |
| 5 | Replace `_showAddModal` and `_showEditModal` | ✅ |

## Deviations from Plan

None - plan executed as written.

## Self-Check: PASSED

- modules/inventory.js: 685 lines, all functions present
- Commit: c488c58
