# Phase 25 — Plan 02 Summary

**Phase:** 25-billing-ux-fixes-payment-mode  
**Plan:** 02  
**Status:** Complete (pending UAT)  
**Commit:** 32a9bcb

## What Was Built

Payment mode capture on the billing screen, Firestore rule enforcement, and CSS styles.

### Task 1 — Billing payment mode (modules/billing.js)

New module-level state:
- `let _paymentMode = 'cash'` — reset to `'cash'` on each `render()` call

New UI (after Customer Name, before Totals):
- 4-button toggle: Cash / UPI / Card / Split
- Split reveals inline inputs for Cash, UPI, Card amounts

Event handling:
- `.pay-mode-group` click handler toggles `.active` class and shows/hides split inputs

Sale submission:
- `payMode` and `paySplit` read from state before batch write
- Added to `batch.set(saleRef, {...})` as `payment_mode` and `payment_split`
- Passed through to `_showConfirmation()`

Confirmation screen:
- `payBadgeText` computed: for split, lists each non-zero amount (e.g. `₹100 Cash + ₹50 UPI`)
- "Paid via: **Cash**" badge shown between the total amount card and sync status badge

### Task 2 — Firestore rules + CSS (firestore.rules, styles/main.css)

**firestore.rules** — `allow create` for `/shops/{shopId}/sales/{saleId}` now requires:
- `payment_mode` in `hasAll([...])` array
- `request.resource.data.payment_mode is string`

**styles/main.css** — Appended:
- `.pay-mode-group` — flex container, matches `.seg-toggle` aesthetics
- `.pay-mode-btn` / `.pay-mode-btn.active` — pill toggle button with primary color active state
- `.pay-split-row`, `.pay-split-label`, `.pay-split-input` — split amount row layout

## Files Modified

- `modules/billing.js` — payment mode state, UI, handler, submit, confirmation badge
- `firestore.rules` — `payment_mode` required on sale create
- `styles/main.css` — payment mode CSS classes appended
