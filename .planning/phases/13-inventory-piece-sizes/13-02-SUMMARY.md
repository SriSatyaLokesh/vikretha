---
phase: 13
plan: "02"
subsystem: billing, receipt
tags: [billing, receipt, size-picker, cart, canvas]
dependency_graph:
  requires: [hasSizes-schema, size-variant-ui]
  provides: [size-picker-billing, per-size-stock-decrement, receipt-size-label]
  affects: [sale-recording, stock-levels]
tech_stack:
  added: []
  patterns: [composite-cart-key, size-picker-bottom-sheet, canvas-sub-line]
key_files:
  created: []
  modified: [modules/billing.js, modules/receipt.js]
decisions:
  - "cartKey = inv.id + '::' + sizeKey for sized items; null for non-sized"
  - "Sized items show In-cart badge (not stepper) in product grid"
  - "Stock decrement: sizes.{sizeKey}.stock for sized, stock for non-sized"
  - "receipt.js rowH includes extra 12px for size sub-line when sizeText present"
metrics:
  duration: "~90 min (across sessions)"
  completed: "2025-07-13"
---

# Phase 13 Plan 02: Billing & Receipt Size Support Summary

**One-liner:** Added size picker bottom-sheet to billing, composite cart keys for variants, per-size Firestore stock decrement, and canvas size sub-line on receipts.

## Tasks Completed

| Task | Description | Status |
|------|-------------|--------|
| 1 | Detect hasSizes in handleGridClick, route to _showSizePicker | ✅ |
| 2 | Update _renderCartRows for sizeLabel sub-line | ✅ |
| 3 | Update _renderGrid inCartCheck for composite keys | ✅ |
| 4 | Add size_key/size_label to sale items array | ✅ |
| 5 | Per-size stock decrement in batch update | ✅ |
| 6 | Implement _showSizePicker bottom-sheet | ✅ |
| 7 | receipt.js: rows pre-processing with sizeText/rowH | ✅ |
| 8 | receipt.js: canvas size sub-line rendering | ✅ |

## Deviations from Plan

None - plan executed as written.

## Self-Check: PASSED

- modules/billing.js: 709 lines, _showSizePicker present
- modules/receipt.js: size sub-line at line 234, rowH includes 12px extra
- Commit: c488c58
