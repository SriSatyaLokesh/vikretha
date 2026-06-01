# Phase 14 Plan 01 — Summary

**Phase:** 14-adhoc-billing-items  
**Plan:** 01  
**Status:** ✅ Complete  
**Date:** 2026-06-02

## What Was Built

Modified `modules/billing.js` to support ad-hoc (custom one-off) items in the billing flow.

### Changes Made

**HTML template (`render()`):**
- Added "Other item" dashed button (`#adhoc-item-btn`) below the product grid, styled with a dashed border and plus-icon SVG

**Event listener (`render()`):**
- Wired `#adhoc-item-btn` click → `_showAdhocItemForm(container)`

**New function `_showAdhocItemForm(container)`:**
- Bottom-sheet overlay with "Item Name" (text) and "Price" (number) inputs
- Validates: non-empty name + price > 0, shows inline error if invalid
- On submit: creates cart entry with `cartKey = 'adhoc::' + Date.now().toString(36)`, `id: null`, `adhoc: true`
- Auto-focuses name input after sheet renders

**`_handleSubmit` — cartArr mapping:**
- Added `adhoc: i.adhoc || false` field to each cartArr item

**`_handleSubmit` — stock decrement loop:**
- Added `if (!item.item_id) continue;` guard at top of loop — skips Firestore writes for ad-hoc items

## Files Modified

- `modules/billing.js` (+~120 lines net)

## Decisions

- Used `cartKey = 'adhoc::' + Date.now().toString(36)` for uniqueness (supports multiple ad-hoc items with same name)
- Guard uses `item.item_id` (null check) rather than `item.adhoc` flag — more defensive against future edge cases
