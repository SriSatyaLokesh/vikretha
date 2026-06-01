# Phase 14 Plan 02 — Summary

**Phase:** 14-adhoc-billing-items  
**Plan:** 02  
**Status:** ✅ Complete  
**Date:** 2026-06-02

## What Was Built

Extended `modules/billing.js` with post-submit "Save to Inventory?" prompts for ad-hoc items.

### Changes Made

**Firestore imports:**
- Added `addDoc` to the firebase-firestore import line

**New function `_promptSaveAdhocItems(container, items, onDone)`:**
- Takes array of `{name, price}` unique ad-hoc items
- Shows one bottom-sheet prompt per item sequentially using recursive `_next(idx)` pattern
- Each sheet: item name in subtitle, price read-only display, optional "Starting stock" number input
- "Yes, Add to Inventory": calls `addDoc` to create inventory doc `{name, price, unit:'pc', stock, threshold:5, unitType:'other', hasSizes:false}`; `saveBtn.disabled=true` prevents duplicate writes
- "Skip" / ×  / backdrop tap: proceeds to next item silently
- When all items processed: calls `onDone()`
- Empty items array → calls `onDone()` immediately (no prompt, no regression)

**`_handleSubmit` wiring:**
- After `batch.commit()`, collects unique ad-hoc items via `Map` keyed by name (deduplicates repeated ad-hoc entries with same name)
- Calls `_promptSaveAdhocItems(container, adhocItems, () => _showConfirmation(...))`
- Regular-item-only sales: `adhocItems` is empty → `onDone()` fires immediately → confirmation screen unchanged

## Files Modified

- `modules/billing.js` (+~104 lines net)

## Verification

Checkpoint approved by user on 2026-06-02. All 25 manual verification steps passed:
- Other item button visible, form validates, adds to cart
- Mixed sale submits; stock decremented only for regular items
- Post-submit prompt appears for each unique ad-hoc item
- Accepting saves to inventory (visible in Inventory tab)
- Skipping proceeds silently
- Regular-item-only sales go straight to confirmation
- Firestore sale doc: ad-hoc items have `adhoc:true`, `item_id:null`
